// ===== KB QUERY API =====
// Phase 4: Production hardening - tenant isolation, rate limiting, caching, logging

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/services/kb/generateEmbedding';
import { cosineSimilarity } from '@/lib/openai-client';
// Phase 4: Import hardening utilities
import { validateTenantId, sanitizeTenantId } from '@/lib/services/agent/tenantIsolation';
import { checkAgentRateLimit } from '@/lib/services/agent/rateLimiter';
import { getCached, setCached } from '@/lib/services/agent/cache';
import { logKbQuery, logAgentError } from '@/lib/services/agent/logging';
import { getFallbackResponse } from '@/lib/services/agent/fallback';

const prisma = getPrismaClient();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tenantId: string | null = null;

  try {
    const body = await request.json();
    const { question, tenantId: rawTenantId } = body;

    // Phase 4: Sanitize and validate inputs
    const sanitizedTenantId = sanitizeTenantId(rawTenantId);
    if (!sanitizedTenantId) {
      return NextResponse.json(
        { success: false, error: 'Invalid tenantId format' },
        { status: 400 }
      );
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'question is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    tenantId = sanitizedTenantId;
    const sanitizedQuestion = question.trim().substring(0, 1000); // Limit question length

    // Phase 4: Validate tenantId exists and is active
    const tenantValidation = await validateTenantId(tenantId);
    if (!tenantValidation.valid) {
      logAgentError(tenantId, undefined, tenantValidation.error || 'Tenant validation failed');
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

    // Phase 4: Check cache first
    const cachedResult = getCached<{ answer: string; score: number }>(tenantId, 'kb_query', sanitizedQuestion);
    if (cachedResult) {
      const duration = Date.now() - startTime;
      logKbQuery(tenantId, undefined, sanitizedQuestion, 1, cachedResult.score, duration);
      return NextResponse.json({
        success: true,
        data: {
          answer: cachedResult.answer,
          score: cachedResult.score,
          cached: true
        }
      });
    }

    // Use Intelligent RAG for ChatGPT-level document reasoning
    const { generateIntelligentRAGAnswer } = await import('@/lib/services/agent/intelligentRAG');
    const ragResult = await generateIntelligentRAGAnswer(sanitizedQuestion, tenantId);

    // Build answer with citations
    let answerText = ragResult.answer;
    if (ragResult.citations.length > 0 && ragResult.confidence !== 'Low') {
      const citationText = ragResult.citations
        .slice(0, 3)
        .map(c => c.sectionHeading ? `${c.documentName} (${c.sectionHeading})` : c.documentName)
        .join(', ');
      answerText += `\n\n*Sources: ${citationText}*`;
    }

    if (ragResult.followUpQuestion) {
      answerText += `\n\n${ragResult.followUpQuestion}`;
    }

    // Convert confidence to score
    const score = ragResult.confidence === 'High' ? 0.9 : ragResult.confidence === 'Medium' ? 0.7 : 0.5;

    // Phase 4: Cache the result
    setCached(tenantId, 'kb_query', sanitizedQuestion, { answer: answerText, score });

    const duration = Date.now() - startTime;
    logKbQuery(tenantId, undefined, sanitizedQuestion, ragResult.relevantChunks, score, duration);

    // Return the synthesized answer with metadata
    return NextResponse.json({
      success: true,
      data: {
        answer: answerText,
        score,
        confidence: ragResult.confidence,
        coverage: ragResult.coverage,
        relevantChunks: ragResult.relevantChunks,
        citations: ragResult.citations,
        missingInfo: ragResult.missingInfo
      }
    }, {
      headers: {
        'X-Response-Time': `${duration}ms`
      }
    });

  } catch (error: any) {
    // Phase 4: Log error and return safe fallback
    logAgentError(tenantId || 'unknown', undefined, error, {
      endpoint: '/api/kb/query',
      question: question?.substring(0, 100)
    });
    
    const fallbackResponse = getFallbackResponse('kb_query', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query knowledge base',
        data: {
          answer: fallbackResponse.text,
          score: 0
        }
      },
      { status: 500 }
    );
  }
}



