/**
 * Drill-Down API Route
 * Data Analyst Agent (Poppy) - Metric-Scoped Drill-Down Analysis
 * 
 * Provides deeper views of ranked metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorResponseSchema } from '@/lib/poppy/api/contracts';
import { requireAuth, requireTenantOwnership } from '@/lib/auth/middleware';
import { generateDrillDown } from '@/lib/poppy/services/drill-down-service';
import { z } from 'zod';

const drillDownRequestSchema = z.object({
  datasetId: z.string().uuid(),
  metricColumn: z.string().min(1),
});

// Simple in-memory cache keyed by datasetVersionId + metricColumn
const drillDownCache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/poppy/drill-down
 * Generate drill-down analysis for a metric
 */
export async function POST(request: NextRequest) {
  try {
    // Phase 6: Require authentication
    const auth = await requireAuth(request);

    const body = await request.json();
    
    // Validate request
    const validation = drillDownRequestSchema.safeParse(body);
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

    const { datasetId, metricColumn } = validation.data;

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

    // Check if metric is in key differences (safety check - should be called only for ranked metrics)
    // We'll allow it anyway but log a warning if not found in key differences

    // Check cache
    const cacheKey = `${latestVersion.id}:${metricColumn}`;
    const cached = drillDownCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[DrillDown] Cache hit for metric: ${metricColumn}`);
      return NextResponse.json(cached.result, { status: 200 });
    }

    // Detect outcome column from profile (same logic as baseline analysis)
    // For now, we'll get it from the baseline analysis result if available
    // Or detect it using the same logic
    const { detectOutcomeColumn } = await import('@/lib/poppy/services/baseline-analysis-service');
    const { parseFile } = await import('@/lib/poppy/services/data-parser');
    const data = parseFile(latestVersion.filePath);
    const outcomeColumn = detectOutcomeColumn(profile, data);

    if (!outcomeColumn) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'No outcome column detected. Drill-down is only available for metrics with outcome groups.',
            code: 'NO_OUTCOME',
          },
        }),
        { status: 400 }
      );
    }

    // Generate drill-down
    console.log(`[DrillDown] Generating drill-down for metric: ${metricColumn}, outcome: ${outcomeColumn}`);
    const drillDown = await generateDrillDown(
      {
        datasetVersionId: latestVersion.id,
        filePath: latestVersion.filePath,
        metricColumn,
        outcomeColumn,
      },
      profile
    );

    // Cache the result
    drillDownCache.set(cacheKey, {
      result: drillDown,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (Math.random() < 0.1) {
      const cutoff = Date.now() - (CACHE_TTL * 2);
      for (const [key, value] of drillDownCache.entries()) {
        if (value.timestamp < cutoff) {
          drillDownCache.delete(key);
        }
      }
    }

    return NextResponse.json(drillDown, { status: 200 });
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
    
    console.error('[DrillDown] Error:', error);
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



