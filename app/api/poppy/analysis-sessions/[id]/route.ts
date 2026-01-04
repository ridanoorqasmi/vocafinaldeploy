/**
 * Phase 2: Analysis Session Detail API Route
 * Data Analyst Agent (Poppy) - Real Implementation
 * 
 * Returns real session data with messages
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAnalysisSessionResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';
import { requireAuth, requireTenantOwnership } from '@/lib/auth/middleware';
import { z } from 'zod';
// Import will be done dynamically to ensure fresh store state

/**
 * GET /api/poppy/analysis-sessions/:id
 * Get analysis session with messages and artifacts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle Next.js 14 async params
    const resolvedParams = params instanceof Promise ? await params : params;
    
    // Validate session ID
    const sessionIdValidation = z.string().uuid().safeParse(resolvedParams.id);
    if (!sessionIdValidation.success) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: `Invalid session ID format: ${resolvedParams.id}`,
            code: 'VALIDATION_ERROR',
          },
        }),
        { status: 400 }
      );
    }

    const sessionId = sessionIdValidation.data;

    // Phase 6: Require authentication
    const auth = await requireAuth(request);

    // Get session from database-backed store
    const sessionStoreModule = await import('@/lib/poppy/services/session-store-db');
    const session = await sessionStoreModule.getSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Session not found',
            code: 'NOT_FOUND',
          },
        }),
        { status: 404 }
      );
    }

    // Phase 6: Verify session belongs to tenant
    requireTenantOwnership(auth.tenantId, session.tenantId, 'session');

    // Get messages for session (ordered by createdAt)
    const messages = await sessionStoreModule.getMessagesBySession(sessionId);

    // Phase 6: Get artifacts for session from database
    const artifactStoreModule = await import('@/lib/poppy/services/artifact-store-db');
    const artifacts = await artifactStoreModule.getArtifactsBySession(sessionId);

    const response = getAnalysisSessionResponseSchema.parse({
      session,
      messages,
      artifacts,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Handle auth errors
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message.startsWith('FORBIDDEN'))) {
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

