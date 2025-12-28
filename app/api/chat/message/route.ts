// ===== CHAT MESSAGE API =====
// Phase 4: Production hardening - tenant isolation, rate limiting, logging, fallbacks

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
// Phase 4: Import hardening utilities
import { validateTenantId, validateConversationTenant, sanitizeTenantId } from '@/lib/services/agent/tenantIsolation';
import { checkAgentRateLimit } from '@/lib/services/agent/rateLimiter';
import { getCached, setCached } from '@/lib/services/agent/cache';
import { logKbQuery, logAgentError } from '@/lib/services/agent/logging';
import { getFallbackResponse } from '@/lib/services/agent/fallback';

/**
 * Filter out form-like content from KB responses
 */
function filterFormContent(content: string): string {
  const formPatterns = [
    /^[a-z]+:\s*_+$/i,
    /^[a-z]+\s*:\s*$/i,
    /^\s*[a-z]+\s*:\s*[0-9]+\s*$/i,
    /^\s*[a-z]+\s*:\s*[a-z0-9]+\s*$/i,
    /^\s*[a-z]+\s*[:\-]\s*$/i,
  ];
  
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const formLineCount = lines.filter(line => 
    formPatterns.some(pattern => pattern.test(line))
  ).length;
  
  if (formLineCount > lines.length * 0.5 && lines.length <= 5) {
    return '';
  }
  
  const filteredLines = lines.filter(line => 
    !formPatterns.some(pattern => pattern.test(line))
  );
  
  return filteredLines.join('\n').trim();
}

const prisma = getPrismaClient();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tenantId: string | null = null;

  try {
    const body = await request.json();
    const { conversationId, text, tenantId: rawTenantId, chatSessionId } = body;

    // Phase 4: Sanitize and validate inputs
    const sanitizedTenantId = sanitizeTenantId(rawTenantId);
    if (!sanitizedTenantId) {
      return NextResponse.json(
        { success: false, error: 'Invalid tenantId format' },
        { status: 400 }
      );
    }

    if (!conversationId || !text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'conversationId and text are required' },
        { status: 400 }
      );
    }

    tenantId = sanitizedTenantId;
    const sanitizedText = text.trim().substring(0, 2000); // Limit text length

    // Phase 4: Validate tenantId exists and is active
    const tenantValidation = await validateTenantId(tenantId);
    if (!tenantValidation.valid) {
      logAgentError(tenantId, conversationId, tenantValidation.error || 'Tenant validation failed');
      return NextResponse.json(
        { success: false, error: tenantValidation.error || 'Invalid tenant' },
        { status: 403 }
      );
    }

    // Phase 4: Rate limiting (per-tenant)
    const rateLimitResult = await checkAgentRateLimit(tenantId, 'kb_query');
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimitResult.error || 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
            'Retry-After': String(rateLimitResult.retryAfter || 60)
          }
        }
      );
    }

    // Phase 4: Validate chat session if provided (required for authenticated chats)
    if (chatSessionId) {
      const { validateChatSession } = await import('@/lib/services/chat/sessionService');
      const sessionValidation = await validateChatSession(chatSessionId, tenantId, conversationId);
      
      if (!sessionValidation.success) {
        logAgentError(tenantId, conversationId, `Invalid chat session: ${sessionValidation.error}`);
        return NextResponse.json(
          { success: false, error: sessionValidation.error || 'Invalid chat session' },
          { status: 403 }
        );
      }
    }

    // Phase 4: Validate conversation belongs to tenant (defensive check)
    const conversationValidation = await validateConversationTenant(conversationId, tenantId);
    if (!conversationValidation.valid) {
      logAgentError(tenantId, conversationId, conversationValidation.error || 'Conversation validation failed');
      return NextResponse.json(
        { success: false, error: conversationValidation.error || 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId
      }
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        sender: 'user',
        text
      }
    });

    // Phase 4: Classify intent first to handle greetings and other intents properly
    const { classifyIntent } = await import('@/lib/services/agent/intentClassifier');
    const { formatGreetingResponse, formatKbResponse } = await import('@/lib/services/agent/responseFormatter');
    const intentResult = classifyIntent(sanitizedText);
    const { intent } = intentResult;
    
    // Get support intent for analytics
    const { classifySupportIntent } = await import('@/lib/services/agent/supportIntentClassifier');
    const supportIntent = classifySupportIntent(sanitizedText);

    // Handle greetings directly without KB query
    if (intent === 'greeting') {
      const greetingResponse = formatGreetingResponse();
      const agentMessage = await prisma.message.create({
        data: {
          conversationId,
          sender: 'agent',
          text: greetingResponse.text
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          messageId: agentMessage.id,
          text: greetingResponse.text,
          score: 0,
          intent: 'greeting'
        }
      });
    }

    // Phase 4: Query KB using RAG (Retrieval-Augmented Generation) for intelligent answers
    let agentText = "I don't have specific information about that in my knowledge base. Could you please rephrase your question or provide more details?";
    let score = 0;
    const kbStartTime = Date.now();

    try {
      // Phase 4: Check cache first
      const cachedResult = getCached<{ answer: string; score: number }>(tenantId, 'kb_query', sanitizedText);
      if (cachedResult) {
        agentText = cachedResult.answer;
        score = cachedResult.score;
        const duration = Date.now() - kbStartTime;
        logKbQuery(tenantId, conversationId, sanitizedText, 1, score, duration);
      } else {
        // Use Intelligent RAG for ChatGPT-level document reasoning (with conversation context)
        const { generateIntelligentRAGAnswer } = await import('@/lib/services/agent/intelligentRAG');
        const ragResult = await generateIntelligentRAGAnswer(sanitizedText, tenantId, conversationId);
        
        // Build answer with citations
        agentText = ragResult.answer;
        if (ragResult.citations.length > 0 && ragResult.confidence !== 'Low') {
          const citationText = ragResult.citations
            .slice(0, 3)
            .map(c => c.sectionHeading ? `${c.documentName} (${c.sectionHeading})` : c.documentName)
            .join(', ');
          agentText += `\n\n*Sources: ${citationText}*`;
        }
        
        if (ragResult.followUpQuestion) {
          agentText += `\n\n${ragResult.followUpQuestion}`;
        }
        
        // Convert confidence to score
        score = ragResult.confidence === 'High' ? 0.9 : ragResult.confidence === 'Medium' ? 0.7 : 0.5;
        
        // Phase 4: Cache the result
        setCached(tenantId, 'kb_query', sanitizedText, { answer: agentText, score });
        
        const duration = Date.now() - kbStartTime;
        logKbQuery(tenantId, conversationId, sanitizedText, ragResult.relevantChunks, score, duration);

        // Track analytics for admin insights (non-blocking)
        try {
          const { trackQuestionAnalytics, normalizeQuestion } = await import('@/lib/services/agent/analyticsTracker');
          
          const coverageStatus = ragResult.coverage === 'complete' 
            ? 'covered' 
            : ragResult.coverage === 'partial' 
              ? 'partially_covered' 
              : 'not_covered';

          trackQuestionAnalytics({
            conversationId,
            tenantId,
            questionText: sanitizedText,
            normalizedQuestion: normalizeQuestion(sanitizedText),
            detectedIntent: intent,
            confidenceLevel: ragResult.confidence,
            coverageStatus: coverageStatus as 'covered' | 'partially_covered' | 'not_covered',
            supportIntent: supportIntent.intent,
            sentiment: supportIntent.sentiment,
            timestamp: new Date()
          }).catch(err => console.error('Analytics tracking error:', err)); // Non-blocking
        } catch (error) {
          // Silently fail - analytics should not break chat
          console.error('Error tracking analytics:', error);
        }
      }
    } catch (error) {
      const duration = Date.now() - kbStartTime;
      logAgentError(tenantId, conversationId, error, { operation: 'kb_query_rag', question: sanitizedText.substring(0, 100) });
      // Use fallback message
      const fallback = getFallbackResponse('kb_query', error);
      agentText = fallback.text;
    }

    // Save agent message
    const agentMessage = await prisma.message.create({
      data: {
        conversationId,
        sender: 'agent',
        text: agentText
      }
    });

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        messageId: agentMessage.id,
        text: agentText,
        score
      }
    }, {
      headers: {
        'X-Response-Time': `${totalDuration}ms`
      }
    });

  } catch (error: any) {
    // Phase 4: Log error and return safe fallback
    logAgentError(tenantId || 'unknown', conversationId || undefined, error, {
      endpoint: '/api/chat/message'
    });
    
    const fallbackResponse = getFallbackResponse('general', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process message',
        data: {
          text: fallbackResponse.text,
          score: 0
        }
      },
      { status: 500 }
    );
  }
}

