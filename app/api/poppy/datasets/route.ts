/**
 * Phase 1: Dataset API Routes
 * Data Analyst Agent (Poppy) - Real Implementation
 * 
 * Creates datasets with real storage
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createDatasetRequestSchema,
  createDatasetResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';
import { validateRequestBody } from '@/lib/input-validation';
import { requirePermission, requireAuth } from '@/lib/auth/middleware';
import { createAuditLog } from '@/lib/auth/store-db';
// Import will be done dynamically to ensure fresh store state

/**
 * GET /api/poppy/datasets
 * Get all datasets for tenant
 */
export async function GET(request: NextRequest) {
  try {
    // Phase 6: Require authentication
    const auth = await requireAuth(request);

    // Use database-backed store
    const storeModule = await import('@/lib/poppy/services/dataset-store-db');
    const datasets = await storeModule.getDatasetsByTenant(auth.tenantId);

    return NextResponse.json({ datasets }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: error.message === 'UNAUTHORIZED' ? 'Authentication required' : 'Access denied',
            code: error.message,
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
 * POST /api/poppy/datasets
 * Create a new dataset
 */
export async function POST(request: NextRequest) {
  try {
    // Phase 6: Require authentication and permission
    const auth = await requirePermission(request, 'upload_dataset');

    const body = await request.json();
    const validation = validateRequestBody(body, createDatasetRequestSchema);

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

    // Use database-backed store - no retries needed, database is immediately consistent
    const storeModule = await import('@/lib/poppy/services/dataset-store-db');
    const dataset = await storeModule.createDataset(
      auth.tenantId,
      validation.data!.name,
      validation.data!.description
    );

    console.log(`[Create Dataset] Successfully created dataset: ${dataset.id} - ${dataset.name} for tenant: ${auth.tenantId}`);

    // Phase 6: Audit log
    await createAuditLog(auth.userId, auth.tenantId, 'dataset_created', 'dataset', dataset.id, {
      datasetName: dataset.name,
    });

    const response = createDatasetResponseSchema.parse({
      dataset,
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: error.message === 'UNAUTHORIZED' ? 'Authentication required' : 'Access denied',
            code: error.message,
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
