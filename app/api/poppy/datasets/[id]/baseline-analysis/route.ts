/**
 * Baseline Analysis API Route
 * Data Analyst Agent (Poppy) - Baseline Analysis Template
 * 
 * Returns deterministic baseline analysis for datasets
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorResponseSchema } from '@/lib/poppy/api/contracts';
import { requireAuth, requireTenantOwnership } from '@/lib/auth/middleware';
import { z } from 'zod';
import { generateBaselineAnalysis } from '@/lib/poppy/services/baseline-analysis-service';

// Simple in-memory cache keyed by datasetVersionId
const analysisCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/poppy/datasets/:id/baseline-analysis
 * Get baseline analysis for a dataset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Phase 6: Require authentication
    const auth = await requireAuth(request);
    
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

    // Use database-backed store
    const storeModule = await import('@/lib/poppy/services/dataset-store-db');
    const dataset = await storeModule.getDataset(datasetId);
    
    if (!dataset) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: `Dataset not found: ${datasetId}`,
            code: 'NOT_FOUND',
          },
        }),
        { status: 404 }
      );
    }

    // Phase 6: Verify tenant ownership
    requireTenantOwnership(auth.tenantId, dataset.tenantId, 'dataset');

    // Get latest version and profile
    const latestVersion = await storeModule.getLatestVersion(datasetId);
    if (!latestVersion) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'No data version found for this dataset',
            code: 'NO_VERSION',
          },
        }),
        { status: 404 }
      );
    }

    const profile = await storeModule.getProfile(latestVersion.id);
    if (!profile) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'No profile found for this dataset version',
            code: 'NO_PROFILE',
          },
        }),
        { status: 404 }
      );
    }

    // Check cache
    const cacheKey = latestVersion.id;
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[BaselineAnalysis] Cache hit for version: ${latestVersion.id}`);
      return NextResponse.json(cached.result, { status: 200 });
    }

    // Generate baseline analysis
    console.log(`[BaselineAnalysis] Generating analysis for dataset: ${datasetId}, version: ${latestVersion.id}`);
    const analysis = await generateBaselineAnalysis(profile, latestVersion.filePath);

    // Cache the result
    analysisCache.set(cacheKey, {
      result: analysis,
      timestamp: Date.now(),
    });

    // Clean up old cache entries (simple cleanup - remove entries older than 2x TTL)
    if (Math.random() < 0.1) { // 10% chance to cleanup
      const cutoff = Date.now() - (CACHE_TTL * 2);
      for (const [key, value] of analysisCache.entries()) {
        if (value.timestamp < cutoff) {
          analysisCache.delete(key);
        }
      }
    }

    return NextResponse.json(analysis, { status: 200 });
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
    
    console.error('[BaselineAnalysis] Error:', error);
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



