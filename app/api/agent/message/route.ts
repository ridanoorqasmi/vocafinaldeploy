// ===== UNIFIED AGENT MESSAGE ROUTER =====
// Phase 3: Routes messages to KB, DB lookup, or escalation based on intent
// Phase 4: Production hardening - tenant isolation, rate limiting, logging, fallbacks

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { classifyIntent, IntentType } from '@/lib/services/agent/intentClassifier';
import {
  formatKbResponse,
  formatDbResponse,
  formatEscalationResponse,
  formatGreetingResponse,
  formatFallbackResponse
} from '@/lib/services/agent/responseFormatter';
// Phase 4: Import hardening utilities
import { validateTenantId, validateConversationTenant, sanitizeTenantId } from '@/lib/services/agent/tenantIsolation';
import { checkAgentRateLimit } from '@/lib/services/agent/rateLimiter';
import { logAgentOperation, logKbQuery, logDbLookup, logEscalation, logAgentError } from '@/lib/services/agent/logging';
import { getFallbackResponse, withFallback } from '@/lib/services/agent/fallback';

const prisma = getPrismaClient();

/**
 * POST /api/agent/message - Unified agent message router
 * Routes messages based on intent classification
 * Phase 4: Hardened with tenant isolation, rate limiting, logging, and fallbacks
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tenantId: string | null = null;
  let conversationId: string | null = null;

  try {
    const body = await request.json();
    const { conversationId: rawConversationId, text, tenantId: rawTenantId, chatSessionId } = body;

    // Phase 4: Sanitize and validate inputs
    const sanitizedTenantId = sanitizeTenantId(rawTenantId);
    if (!sanitizedTenantId) {
      return NextResponse.json(
        { success: false, error: 'Invalid tenantId format' },
        { status: 400 }
      );
    }

    if (!rawConversationId || !text) {
      return NextResponse.json(
        { success: false, error: 'conversationId and text are required' },
        { status: 400 }
      );
    }

    tenantId = sanitizedTenantId;
    conversationId = String(rawConversationId);

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
    const rateLimitResult = await checkAgentRateLimit(tenantId, 'agent_message');
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
            'X-RateLimit-Limit': '30',
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
    await prisma.message.create({
      data: {
        conversationId,
        sender: 'user',
        text
      }
    });

    // Phase 4: Classify intent with fallback
    const intentResult = await withFallback(
      () => Promise.resolve(classifyIntent(text)),
      'intent_classification',
      { intent: 'fallback' as IntentType, extractedValue: null }
    );
    const { intent, extractedValue } = intentResult;

    let formattedResponse;
    let ticketId: string | undefined;
    const responseStartTime = Date.now();

    // Phase 4: Route based on intent with safe fallbacks
    try {
      switch (intent) {
        case 'greeting':
          formattedResponse = await withFallback(
            () => Promise.resolve(formatGreetingResponse()),
            'response_formatting',
            getFallbackResponse('general')
          );
          logAgentOperation({
            tenantId,
            conversationId,
            intent: 'greeting',
            responseSource: 'greeting',
            duration: Date.now() - responseStartTime
          });
          break;

        case 'kb_question':
          // Phase 4: Ensure KB queries use tenantId from session (if available)
          const kbTenantId = chatSessionId 
            ? await (await import('@/lib/services/chat/sessionService')).getTenantIdFromSession(chatSessionId) || tenantId
            : tenantId;
          // Use Intelligent RAG for ChatGPT-level document reasoning (with conversation context)
          formattedResponse = await withFallback(
            () => handleKbQueryWithIntelligentRAG(text, kbTenantId, conversationId),
            'kb_query',
            getFallbackResponse('kb_query')
          );
          logKbQuery(
            tenantId,
            conversationId,
            text,
            0, // Will be updated in handleKbQueryWithRAG if available
            null,
            Date.now() - responseStartTime
          );
          break;

        case 'db_lookup':
          formattedResponse = await withFallback(
            () => handleDbLookup(tenantId, extractedValue || text),
            'db_lookup',
            getFallbackResponse('db_lookup')
          );
          logDbLookup(
            tenantId,
            conversationId,
            extractedValue || text,
            false, // Will be updated in handleDbLookup if available
            Date.now() - responseStartTime
          );
          break;

        case 'action_request':
        case 'complaint':
          // Escalate and create ticket
          const ticketStartTime = Date.now();
          ticketId = await withFallback(
            () => createSupportTicket(tenantId, conversationId, intent, text),
            'general',
            undefined
          );
          formattedResponse = await withFallback(
            () => Promise.resolve(formatEscalationResponse(intent, ticketId)),
            'response_formatting',
            getFallbackResponse('general')
          );
          logEscalation(
            tenantId,
            conversationId,
            intent,
            ticketId,
            Date.now() - ticketStartTime
          );
          break;

        case 'fallback':
        default:
          formattedResponse = await withFallback(
            () => Promise.resolve(formatFallbackResponse()),
            'response_formatting',
            getFallbackResponse('general')
          );
          logAgentOperation({
            tenantId,
            conversationId,
            intent: 'fallback',
            responseSource: 'fallback',
            duration: Date.now() - responseStartTime
          });
          break;
      }
    } catch (routeError) {
      // Phase 4: Catch any routing errors and use fallback
      logAgentError(tenantId, conversationId, routeError, { intent });
      formattedResponse = getFallbackResponse('general', routeError);
    }

    // Phase 4: Ensure we always have a response
    if (!formattedResponse) {
      formattedResponse = getFallbackResponse('general');
    }

    // Save agent response
    await prisma.message.create({
      data: {
        conversationId,
        sender: 'agent',
        text: formattedResponse.text
      }
    });

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        text: formattedResponse.text,
        intent,
        metadata: formattedResponse.metadata,
        ticketId
      }
    }, {
      headers: {
        'X-Response-Time': `${totalDuration}ms`
      }
    });

  } catch (error: any) {
    // Phase 4: Log error and return safe fallback
    logAgentError(tenantId || 'unknown', conversationId || 'unknown', error, {
      endpoint: '/api/agent/message'
    });
    
    const fallbackResponse = getFallbackResponse('general', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process message',
        data: {
          text: fallbackResponse.text,
          intent: 'fallback',
          metadata: fallbackResponse.metadata
        }
      },
      { status: 500 }
    );
  }
}

/**
 * Handle KB query using Intelligent RAG
 * ChatGPT-level document reasoning with multi-query retrieval, re-ranking, and structured outputs
 */
async function handleKbQueryWithIntelligentRAG(question: string, tenantId: string, conversationId?: string) {
  const queryStartTime = Date.now();
  
  try {
    // Phase 4: Check cache first
    const { getCached, setCached } = await import('@/lib/services/agent/cache');
    const cachedResult = getCached<{ text: string; score: number; confidence?: string }>(tenantId, 'kb_query', question);
    
    if (cachedResult) {
      const duration = Date.now() - queryStartTime;
      const score = typeof cachedResult.score === 'number' ? cachedResult.score : 0.7;
      logKbQuery(tenantId, undefined, question, 1, score, duration);
      return formatKbResponse(cachedResult.text, score);
    }

    // Use Intelligent RAG for ChatGPT-level reasoning (with conversation context)
    const { generateIntelligentRAGAnswer } = await import('@/lib/services/agent/intelligentRAG');
    const ragResult = await generateIntelligentRAGAnswer(question, tenantId, conversationId);

    // Build answer with citations if available
    let answerText = ragResult.answer;
    if (ragResult.citations.length > 0 && ragResult.confidence !== 'Low') {
      const citationText = ragResult.citations
        .slice(0, 3)
        .map(c => c.sectionHeading ? `${c.documentName} (${c.sectionHeading})` : c.documentName)
        .join(', ');
      answerText += `\n\n*Sources: ${citationText}*`;
    }

    // Add follow-up question if provided
    if (ragResult.followUpQuestion) {
      answerText += `\n\n${ragResult.followUpQuestion}`;
    }

    // Cache the result (convert confidence to score for caching)
    const confidenceScore = ragResult.confidence === 'High' ? 0.9 : ragResult.confidence === 'Medium' ? 0.7 : 0.5;
    setCached(tenantId, 'kb_query', question, { 
      text: answerText, 
      score: confidenceScore,
      confidence: ragResult.confidence
    });
    
    const duration = Date.now() - queryStartTime;
    logKbQuery(tenantId, undefined, question, ragResult.relevantChunks, confidenceScore, duration);
    
    // Track analytics for admin insights (non-blocking)
    if (conversationId) {
      try {
        const { trackQuestionAnalytics, normalizeQuestion } = await import('@/lib/services/agent/analyticsTracker');
        const { classifySupportIntent } = await import('@/lib/services/agent/supportIntentClassifier');
        const supportIntent = classifySupportIntent(question);
        
        const coverageStatus = ragResult.coverage === 'complete' 
          ? 'covered' 
          : ragResult.coverage === 'partial' 
            ? 'partially_covered' 
            : 'not_covered';

        trackQuestionAnalytics({
          conversationId,
          tenantId,
          questionText: question,
          normalizedQuestion: normalizeQuestion(question),
          detectedIntent: 'kb_question',
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
    
    return formatKbResponse(answerText, confidenceScore);

  } catch (error) {
    const duration = Date.now() - queryStartTime;
    logAgentError(tenantId, undefined, error, { operation: 'kb_query_intelligent_rag', question });
    return formatKbResponse(null, 0);
  }
}

/**
 * Handle KB query by calling existing KB query logic internally
 * Phase 4: Enhanced with caching and better error handling
 * @deprecated Use handleKbQueryWithRAG for better ChatGPT-like behavior
 */
async function handleKbQuery(question: string, tenantId: string) {
  const queryStartTime = Date.now();
  
  try {
    // Phase 4: Check cache first
    const { getCached, setCached } = await import('@/lib/services/agent/cache');
    const cachedResult = getCached<{ text: string; score: number }>(tenantId, 'kb_query', question);
    
    if (cachedResult) {
      const duration = Date.now() - queryStartTime;
      logKbQuery(tenantId, undefined, question, 1, cachedResult.score, duration);
      return formatKbResponse(cachedResult.text, cachedResult.score);
    }

    const { generateEmbedding } = await import('@/lib/services/kb/generateEmbedding');
    const { cosineSimilarity } = await import('@/lib/openai-client');
    const kbPrisma = getPrismaClient();

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);

    // Get all chunks for the tenant (Phase 4: tenantId already validated)
    const chunks = await kbPrisma.kbChunk.findMany({
      where: { tenantId },
      select: {
        id: true,
        content: true,
        embedding: true
      }
    });

    if (chunks.length === 0) {
      const duration = Date.now() - queryStartTime;
      logKbQuery(tenantId, undefined, question, 0, null, duration);
      return formatKbResponse(null, 0);
    }

    // Calculate similarity scores
    const similarities = chunks
      .map((chunk: any) => {
        let embeddingArray: number[];
        if (Array.isArray(chunk.embedding)) {
          embeddingArray = chunk.embedding as number[];
        } else if (typeof chunk.embedding === 'string') {
          embeddingArray = JSON.parse(chunk.embedding);
        } else {
          return null;
        }

        try {
          const similarity = cosineSimilarity(questionEmbedding, embeddingArray);
          return {
            chunk,
            similarity
          };
        } catch (error) {
          console.error('Error calculating similarity:', error);
          return null;
        }
      })
      .filter((item: any): item is { chunk: any; similarity: number } => item !== null);

    if (similarities.length === 0) {
      const duration = Date.now() - queryStartTime;
      logKbQuery(tenantId, undefined, question, 0, null, duration);
      return formatKbResponse(null, 0);
    }

    // Sort by similarity (highest first)
    similarities.sort((a: any, b: any) => b.similarity - a.similarity);

    // Filter out chunks with very small content
    const validSimilarities = similarities.filter((item: any) => {
      const content = item.chunk.content?.trim() || '';
      return content.length >= 50;
    });

    if (validSimilarities.length === 0) {
      const duration = Date.now() - queryStartTime;
      logKbQuery(tenantId, undefined, question, 0, null, duration);
      return formatKbResponse(null, 0);
    }

    // Get best match with minimum similarity threshold
    const MIN_SIMILARITY_THRESHOLD = 0.65; // Only return answers if similarity is reasonably high
    const bestMatch = validSimilarities[0];
    
    if (!bestMatch || !bestMatch.chunk.content || bestMatch.chunk.content.trim().length === 0) {
      const duration = Date.now() - queryStartTime;
      logKbQuery(tenantId, undefined, question, 0, null, duration);
      return formatKbResponse(null, 0);
    }

    // Check if similarity is high enough
    if (bestMatch.similarity < MIN_SIMILARITY_THRESHOLD) {
      const duration = Date.now() - queryStartTime;
      logKbQuery(tenantId, undefined, question, validSimilarities.length, bestMatch.similarity, duration);
      // Return null to trigger "not found" message
      return formatKbResponse(null, bestMatch.similarity);
    }

    let answerContent = bestMatch.chunk.content.trim();
    
    // Phase 4: Filter out form-like content (fields, templates, etc.)
    answerContent = filterFormContent(answerContent);
    
    // If after filtering we have no meaningful content, return null
    if (answerContent.length < 50) {
      const duration = Date.now() - queryStartTime;
      logKbQuery(tenantId, undefined, question, validSimilarities.length, bestMatch.similarity, duration);
      return formatKbResponse(null, bestMatch.similarity);
    }
    
    // Phase 4: Try to get additional context from top 3 matches if available
    if (validSimilarities.length > 1) {
      const topMatches = validSimilarities.slice(0, 3).filter(m => m.similarity >= MIN_SIMILARITY_THRESHOLD);
      if (topMatches.length > 1) {
        // Combine context from multiple relevant chunks
        const additionalContext = topMatches
          .slice(1)
          .map(m => m.chunk.content.trim())
          .filter(c => c.length > 50 && !isFormContent(c))
          .slice(0, 2); // Max 2 additional chunks
        
        if (additionalContext.length > 0) {
          answerContent = `${answerContent}\n\n${additionalContext.join('\n\n')}`;
        }
      }
    }
    
    const score = bestMatch.similarity;
    
    // Phase 4: Cache the result
    setCached(tenantId, 'kb_query', question, { text: answerContent, score });
    
    const duration = Date.now() - queryStartTime;
    logKbQuery(tenantId, undefined, question, validSimilarities.length, score, duration);
    
    return formatKbResponse(answerContent, score);

  } catch (error) {
    const duration = Date.now() - queryStartTime;
    logAgentError(tenantId, undefined, error, { operation: 'kb_query', question });
    return formatKbResponse(null, 0);
  }
}

/**
 * Filter out form-like content from KB responses
 * Removes content that looks like form fields, templates, or placeholders
 */
function filterFormContent(content: string): string {
  // Patterns that indicate form-like content
  const formPatterns = [
    /^[a-z]+:\s*_+$/i, // "name: ____"
    /^[a-z]+\s*:\s*$/i, // "name:"
    /^\s*[a-z]+\s*:\s*[0-9]+\s*$/i, // "date: 8"
    /^\s*[a-z]+\s*:\s*[a-z0-9]+\s*$/i, // Simple key:value pairs that look like forms
    /^\s*[a-z]+\s*[:\-]\s*$/i, // "name -" or "name:"
  ];
  
  // Check if content looks like a form field
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // If most lines match form patterns, it's likely a form
  const formLineCount = lines.filter(line => 
    formPatterns.some(pattern => pattern.test(line))
  ).length;
  
  if (formLineCount > lines.length * 0.5 && lines.length <= 5) {
    // This looks like a form, return empty to trigger "not found"
    return '';
  }
  
  // Remove individual form-like lines
  const filteredLines = lines.filter(line => 
    !formPatterns.some(pattern => pattern.test(line))
  );
  
  return filteredLines.join('\n').trim();
}

/**
 * Check if content looks like form content
 */
function isFormContent(content: string): boolean {
  const formPatterns = [
    /^[a-z]+:\s*_+$/i,
    /^[a-z]+\s*:\s*$/i,
  ];
  
  return formPatterns.some(pattern => pattern.test(content.trim()));
}

/**
 * Handle DB lookup by calling existing DB query logic internally
 * Phase 4: Enhanced with caching and better error handling
 */
async function handleDbLookup(tenantId: string, identifierValue: string) {
  const lookupStartTime = Date.now();
  
  try {
    // Phase 4: Check cache first
    const { getCached, setCached } = await import('@/lib/services/agent/cache');
    const cacheKey = `${tenantId}:${identifierValue}`;
    const cachedResult = getCached<any>(tenantId, 'db_query', cacheKey);
    
    if (cachedResult) {
      const duration = Date.now() - lookupStartTime;
      logDbLookup(tenantId, undefined, identifierValue, !!cachedResult, duration);
      return formatDbResponse(cachedResult, identifierValue);
    }

    const { queryRecord, validateTableMapping } = await import('@/lib/services/db/queryRecord');
    const { DatabaseConfig } = await import('@/lib/services/db/connection');
    const dbPrisma = getPrismaClient();

    // Get database configuration (Phase 4: tenantId already validated)
    const dbConfig = await (dbPrisma as any).tenantDatabaseConfig.findUnique({
      where: { tenantId }
    });

    if (!dbConfig) {
      const duration = Date.now() - lookupStartTime;
      logDbLookup(tenantId, undefined, identifierValue, false, duration);
      return formatDbResponse(null, identifierValue);
    }

    // Get table mapping
    const mapping = await (dbPrisma as any).tenantTableMapping.findUnique({
      where: { tenantId }
    });

    if (!mapping) {
      const duration = Date.now() - lookupStartTime;
      logDbLookup(tenantId, undefined, identifierValue, false, duration);
      return formatDbResponse(null, identifierValue);
    }

    // Validate mapping structure
    const mappingValidation = validateTableMapping({
      tableName: mapping.tableName,
      primaryKeyColumn: mapping.primaryKeyColumn,
      displayFields: mapping.displayFields
    });

    if (!mappingValidation.valid) {
      const duration = Date.now() - lookupStartTime;
      logDbLookup(tenantId, undefined, identifierValue, false, duration);
      return formatDbResponse(null, identifierValue);
    }

    // Prepare database config
    const dbConfigForQuery: DatabaseConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password, // Encrypted, will be decrypted in connection service
      database: dbConfig.database
    };

    // Prepare mapping
    const tableMapping = {
      tableName: mapping.tableName!,
      primaryKeyColumn: mapping.primaryKeyColumn!,
      displayFields: mapping.displayFields as string[]
    };

    // Execute read-only query
    const result = await queryRecord(
      dbConfigForQuery,
      tableMapping,
      String(identifierValue)
    );

    if (!result.success || !result.data) {
      const duration = Date.now() - lookupStartTime;
      logDbLookup(tenantId, undefined, identifierValue, false, duration);
      return formatDbResponse(null, identifierValue);
    }

    // Phase 4: Cache the result
    setCached(tenantId, 'db_query', cacheKey, result.data);
    
    const duration = Date.now() - lookupStartTime;
    logDbLookup(tenantId, undefined, identifierValue, true, duration);
    
    return formatDbResponse(result.data, identifierValue);

  } catch (error) {
    const duration = Date.now() - lookupStartTime;
    logAgentError(tenantId, undefined, error, { operation: 'db_lookup', identifierValue });
    return formatDbResponse(null, identifierValue);
  }
}

/**
 * Create support ticket for escalation
 */
async function createSupportTicket(
  tenantId: string,
  conversationId: string | null,
  intent: IntentType,
  userMessage: string
): Promise<string> {
  try {
    // Generate ticket title from intent and message
    const title = intent === 'action_request'
      ? `Action Request: ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`
      : `Complaint: ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId,
        conversationId,
        title,
        description: userMessage,
        status: 'open'
      }
    });

    return ticket.id;
  } catch (error) {
    console.error('Error creating support ticket:', error);
    // Return empty string if ticket creation fails (non-blocking)
    return '';
  }
}


