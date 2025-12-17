/**
 * Phase 4B: Usage Enforcement API
 * POST /api/v1/internal/usage/check - Usage Validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { UsageEnforcementService, EnforcementContext } from '@/lib/usage-enforcement-service';
import { z } from 'zod';

const UsageCheckSchema = z.object({
  business_id: z.string().uuid(),
  operation_type: z.enum(['query', 'embedding', 'api_call']),
  estimated_tokens: z.number().optional(),
  feature_required: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = UsageCheckSchema.parse(body);

    const { business_id, operation_type, estimated_tokens, feature_required } = validatedData;

    // Create enforcement context
    const context: EnforcementContext = {
      businessId: business_id,
      userId: request.headers.get('x-user-id') || undefined,
      sessionId: request.headers.get('x-session-id') || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || request.ip,
      userAgent: request.headers.get('user-agent') || undefined
    };

    const usageEnforcement = new UsageEnforcementService();

    // Check usage limits
    const usageCheck = await usageEnforcement.enforceUsageLimit(
      context,
      operation_type,
      estimated_tokens,
      feature_required
    );

    // Apply rate limiting
    const rateLimit = await usageEnforcement.applyRateLimit(context, operation_type);

    // Combine results
    const result = {
      allowed: usageCheck.allowed && rateLimit.allowed,
      reason: !usageCheck.allowed ? usageCheck.reason : 
              !rateLimit.allowed ? 'Rate limit exceeded' : undefined,
      current_usage: usageCheck.current_usage,
      rate_limit: {
        remaining: rateLimit.remaining,
        reset_time: rateLimit.reset_time,
        retry_after: rateLimit.retry_after
      },
      recommendations: usageCheck.recommendations,
      emergency_options: usageCheck.emergency_options
    };

    // Set rate limit headers
    const response = NextResponse.json({
      success: true,
      data: result
    });

    if (rateLimit.remaining !== undefined) {
      response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
      response.headers.set('X-RateLimit-Reset', rateLimit.reset_time.toString());
    }

    if (rateLimit.retry_after) {
      response.headers.set('Retry-After', rateLimit.retry_after.toString());
    }

    return response;

  } catch (error) {
    console.error('Usage check error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to check usage limits',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
