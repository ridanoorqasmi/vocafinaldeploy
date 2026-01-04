/**
 * Explain Difference API Route
 * Data Analyst Agent (Poppy) - Scoped Explanation Layer
 * 
 * Generates plain-language explanations for metric differences
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorResponseSchema } from '@/lib/poppy/api/contracts';
import { requireAuth } from '@/lib/auth/middleware';
import { explainDifference } from '@/lib/poppy/services/explanation/difference-explainer';
import { z } from 'zod';

const explainDifferenceRequestSchema = z.object({
  metricName: z.string().min(1),
  groupALabel: z.string().min(1),
  groupBLabel: z.string().min(1),
  groupAAverage: z.number(),
  groupBAverage: z.number(),
  absoluteDifference: z.number(),
  relativeDifference: z.number(),
});

/**
 * POST /api/poppy/explain-difference
 * Generate explanation for a metric difference
 */
export async function POST(request: NextRequest) {
  try {
    // Phase 6: Require authentication
    const auth = await requireAuth(request);

    const body = await request.json();
    
    // Validate request
    const validation = explainDifferenceRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Invalid request data',
            code: 'VALIDATION_ERROR',
            details: validation.error.errors,
          },
        }),
        { status: 400 }
      );
    }

    // Generate explanation (deterministic, no LLM)
    const explanation = explainDifference(validation.data);

    return NextResponse.json(explanation, { status: 200 });
  } catch (error) {
    // Phase 6: Handle auth errors
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN' || error.message.startsWith('FORBIDDEN'))) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: error.message === 'UNAUTHORIZED' ? 'Authentication required' : error.message,
            code: error.message.startsWith('FORBIDDEN') ? 'FORBIDDEN' : error.message,
          },
        }),
        { status: error.message === 'UNAUTHORIZED' ? 401 : 403 }
      );
    }
    
    console.error('[ExplainDifference] Error:', error);
    return NextResponse.json(
      errorResponseSchema.parse({
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      }),
      { status: 500 }
    );
  }
}



