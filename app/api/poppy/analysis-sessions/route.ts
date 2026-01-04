/**
 * Phase 3: Analysis Session API Routes
 * Data Analyst Agent (Poppy) - Real Implementation
 * 
 * Creates real analysis sessions with dataset binding
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAnalysisSessionRequestSchema,
  createAnalysisSessionResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';
import { validateRequestBody } from '@/lib/input-validation';
import { requireAuth, requireTenantOwnership } from '@/lib/auth/middleware';
import { createAuditLog } from '@/lib/auth/store-db';
import { z } from 'zod';
// Import will be done dynamically to ensure fresh store state

/**
 * GET /api/poppy/analysis-sessions
 * Get analysis sessions (optionally filtered by dataset)
 */
export async function GET(request: NextRequest) {
  try {
    // Phase 6: Require authentication
    const auth = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('dataset');

    const sessionStoreModule = await import('@/lib/poppy/services/session-store-db');
    
    let sessions;
    if (datasetId) {
      // Verify dataset belongs to tenant using database store
      const datasetStoreModule = await import('@/lib/poppy/services/dataset-store-db');
      const dataset = await datasetStoreModule.getDataset(datasetId);
      if (dataset) {
        requireTenantOwnership(auth.tenantId, dataset.tenantId, 'dataset');
      }
      // Get sessions for specific dataset (already filtered by tenant via dataset)
      sessions = await sessionStoreModule.getSessionsByDataset(datasetId);
      // Additional tenant filter for security
      sessions = sessions.filter(s => s.tenantId === auth.tenantId);
    } else {
      // Get all sessions for tenant
      sessions = await sessionStoreModule.getSessionsByTenant(auth.tenantId);
    }

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (error) {
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

/**
 * POST /api/poppy/analysis-sessions
 * Create a new analysis session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequestBody(body, createAnalysisSessionRequestSchema);

    if (!validation.success) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Invalid request',
            code: 'VALIDATION_ERROR',
            details: validation.errors,
          },
        }),
        { status: 400 }
      );
    }

    // Phase 6: Require authentication
    const auth = await requireAuth(request);
    const datasetId = validation.data!.datasetId;

    // Validate dataset exists and belongs to tenant if datasetId is provided
    if (datasetId) {
      // Phase 6: Database-backed validation - must check database since session creation uses database
      const datasetStoreModule = await import('@/lib/poppy/services/dataset-store-db');
      
      // Validate UUID format first
      const uuidSchema = z.string().uuid();
      const uuidValidation = uuidSchema.safeParse(datasetId);
      if (!uuidValidation.success) {
        return NextResponse.json(
          errorResponseSchema.parse({
            error: {
              message: `Invalid dataset ID format: ${datasetId}`,
              code: 'VALIDATION_ERROR',
            },
          }),
          { status: 400 }
        );
      }
      
      // Check if dataset exists in database
      const dataset = await datasetStoreModule.getDataset(datasetId);
      
      if (!dataset) {
        return NextResponse.json(
          errorResponseSchema.parse({
            error: {
              message: `Dataset not found: ${datasetId}. Please ensure the dataset exists and belongs to your tenant.`,
              code: 'DATASET_NOT_FOUND',
            },
          }),
          { status: 404 }
        );
      }
      
      // Phase 6: Verify tenant ownership
      requireTenantOwnership(auth.tenantId, dataset.tenantId, 'dataset');
    }

    // Create session using database-backed session store
    const sessionStoreModule = await import('@/lib/poppy/services/session-store-db');
    const session = await sessionStoreModule.createSession(
      auth.tenantId,
      datasetId,
      validation.data!.title
    );

    console.log(`[Create Session] Successfully created session: ${session.id} for dataset: ${datasetId || 'none'} (tenant: ${auth.tenantId})`);

    // Phase 6: Audit log
    await createAuditLog(auth.userId, auth.tenantId, 'session_created', 'session', session.id, {
      datasetId: datasetId || null,
      title: validation.data!.title,
    });

    const response = createAnalysisSessionResponseSchema.parse({
      session,
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // Handle Prisma foreign key constraint violations
    if (error instanceof Error && error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Dataset not found. Please ensure the dataset exists and belongs to your tenant.',
            code: 'DATASET_NOT_FOUND',
          },
        }),
        { status: 404 }
      );
    }
    
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

