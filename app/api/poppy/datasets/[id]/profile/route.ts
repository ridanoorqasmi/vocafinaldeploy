/**
 * Phase 1: Dataset Profile API Route
 * Data Analyst Agent (Poppy) - Real Profile Data
 * 
 * Returns real profiling data for datasets
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  datasetProfileResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';
import { requireAuth, requireTenantOwnership } from '@/lib/auth/middleware';
import { z } from 'zod';
// Import will be done dynamically to ensure fresh store state

/**
 * GET /api/poppy/datasets/:id/profile
 * Get dataset profile information
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

    // Use database-backed store - no retries needed, database is immediately consistent
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

    // Get versions using the same store module instance
    const versions = await storeModule.getVersionsByDataset(datasetId);
    const latestVersion = await storeModule.getLatestVersion(datasetId);
    const profile = latestVersion ? await storeModule.getLatestProfile(datasetId) : null;

    console.log(`[Profile GET] Dataset: ${dataset.name}, Versions: ${versions.length}, Latest: ${latestVersion?.id}, Has Profile: ${!!profile}`);

    // Build response
    const responseData: any = {
      dataset,
      versionCount: versions.length,
    };

    if (latestVersion) {
      responseData.latestVersion = latestVersion;
    }

    if (profile) {
      console.log(`[Profile GET] Profile found: ${profile.rowCount} rows, ${profile.columnCount} columns`);
      responseData.totalRows = profile.rowCount;
      responseData.totalColumns = profile.columnCount;
      responseData.columnNames = profile.columns.map(c => c.name);
      responseData.dataTypes = profile.columns.reduce((acc, col) => {
        acc[col.name] = col.type;
        return acc;
      }, {} as Record<string, string>);
      // Include full column profiles for detailed view
      responseData.columns = profile.columns.map(col => ({
        name: col.name,
        type: col.type,
        nullCount: col.nullCount,
        nullRatio: col.nullRatio,
        distinctCount: col.distinctCount,
        ...(col.min !== undefined && { min: col.min }),
        ...(col.max !== undefined && { max: col.max }),
        ...(col.mean !== undefined && { mean: col.mean }),
      }));
    }

    const response = datasetProfileResponseSchema.parse(responseData);

    return NextResponse.json(response, { status: 200 });
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
