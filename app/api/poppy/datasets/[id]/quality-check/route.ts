/**
 * Phase 7: Data Quality Check API Route
 * Data Analyst Agent (Poppy) - Quality Check Retrieval
 * 
 * Returns cached quality check results for a dataset
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  dataQualityCheckResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';
import { requireAuth, requireTenantOwnership } from '@/lib/auth/middleware';
import { z } from 'zod';

/**
 * GET /api/poppy/datasets/:id/quality-check
 * Get data quality check results for a dataset (latest version)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle Next.js 14 async params
    const resolvedParams = params instanceof Promise ? await params : params;
    
    // Validate dataset ID
    const datasetIdValidation = z.string().uuid().safeParse(resolvedParams.id);
    if (!datasetIdValidation.success) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: `Invalid dataset ID format: ${resolvedParams.id}`,
            code: 'VALIDATION_ERROR',
          },
        }),
        { status: 400 }
      );
    }

    const datasetId = datasetIdValidation.data;

    // Phase 6: Require authentication
    const auth = await requireAuth(request);

    // Get dataset from database
    const datasetStoreModule = await import('@/lib/poppy/services/dataset-store-db');
    const dataset = await datasetStoreModule.getDataset(datasetId);
    
    if (!dataset) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Dataset not found',
            code: 'NOT_FOUND',
          },
        }),
        { status: 404 }
      );
    }

    // Phase 6: Verify tenant ownership
    requireTenantOwnership(auth.tenantId, dataset.tenantId, 'dataset');

    // Get quality check for latest version
    const qualityCheckStoreModule = await import('@/lib/poppy/services/quality-check-store-db');
    const qualityCheck = await qualityCheckStoreModule.getQualityCheckByDataset(datasetId);

    if (!qualityCheck) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Quality check not found. Quality checks are generated when a dataset is uploaded.',
            code: 'NOT_FOUND',
          },
        }),
        { status: 404 }
      );
    }

    const response = dataQualityCheckResponseSchema.parse(qualityCheck);

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





