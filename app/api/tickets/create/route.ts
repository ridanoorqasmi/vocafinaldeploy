// ===== CREATE SUPPORT TICKET API =====
// Phase 3: Create a new support ticket
// Phase 4: Production hardening - tenant isolation, rate limiting, logging

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
// Phase 4: Import hardening utilities
import { validateTenantId, sanitizeTenantId, validateConversationTenant } from '@/lib/services/agent/tenantIsolation';
import { checkAgentRateLimit } from '@/lib/services/agent/rateLimiter';
import { logEscalation, logAgentError } from '@/lib/services/agent/logging';
import { getFallbackResponse } from '@/lib/services/agent/fallback';

const prisma = getPrismaClient();

/**
 * POST /api/tickets/create - Create a new support ticket
 * Phase 4: Hardened with tenant isolation, rate limiting, and logging
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tenantId: string | null = null;

  try {
    const body = await request.json();
    const { tenantId: rawTenantId, conversationId, title, description } = body;

    // Phase 4: Sanitize and validate inputs
    const sanitizedTenantId = sanitizeTenantId(rawTenantId);
    if (!sanitizedTenantId) {
      return NextResponse.json(
        { success: false, error: 'Invalid tenantId format' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'title is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    tenantId = sanitizedTenantId;
    const sanitizedTitle = title.trim().substring(0, 200); // Limit title length
    const sanitizedDescription = description ? String(description).trim().substring(0, 5000) : null; // Limit description length

    // Phase 4: Validate tenantId exists and is active
    const tenantValidation = await validateTenantId(tenantId);
    if (!tenantValidation.valid) {
      logAgentError(tenantId, conversationId, tenantValidation.error || 'Tenant validation failed');
      return NextResponse.json(
        { success: false, error: tenantValidation.error || 'Invalid tenant' },
        { status: 403 }
      );
    }

    // Phase 4: Validate conversation belongs to tenant if provided
    if (conversationId) {
      const conversationValidation = await validateConversationTenant(conversationId, tenantId);
      if (!conversationValidation.valid) {
        logAgentError(tenantId, conversationId, conversationValidation.error || 'Conversation validation failed');
        return NextResponse.json(
          { success: false, error: conversationValidation.error || 'Conversation not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Phase 4: Rate limiting (per-tenant)
    const rateLimitResult = await checkAgentRateLimit(tenantId, 'ticket_create');
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
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
            'Retry-After': String(rateLimitResult.retryAfter || 60)
          }
        }
      );
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId,
        conversationId: conversationId || null,
        title: sanitizedTitle,
        description: sanitizedDescription,
        status: 'open'
      }
    });

    const duration = Date.now() - startTime;
    logEscalation(tenantId, conversationId || undefined, 'ticket_create', ticket.id, duration);

    return NextResponse.json({
      success: true,
      data: ticket
    }, {
      headers: {
        'X-Response-Time': `${duration}ms`
      }
    });

  } catch (error: any) {
    // Phase 4: Log error and return safe response
    logAgentError(tenantId || 'unknown', conversationId || undefined, error, {
      endpoint: '/api/tickets/create',
      title: title?.substring(0, 50)
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create ticket',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


