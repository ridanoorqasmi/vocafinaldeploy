/**
 * Phase 1: Dataset Upload API Route
 * Data Analyst Agent (Poppy) - Real File Upload & Profiling
 * 
 * Handles real file uploads, parsing, and profiling
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadDatasetResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';
import { z } from 'zod';
import { requirePermission, requireTenantOwnership, requireAuth } from '@/lib/auth/middleware';
import { createAuditLog } from '@/lib/auth/store-db';
import { saveDatasetFile } from '@/lib/poppy/services/file-storage';
import { parseFile } from '@/lib/poppy/services/data-parser';
import { profileDataset } from '@/lib/poppy/services/data-profiler';
// Import will be done dynamically to ensure fresh store state

/**
 * POST /api/poppy/datasets/:id/upload
 * Upload a new version of a dataset
 */
export async function POST(
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

    // Use database-backed store - no retries needed, database is immediately consistent
    const storeModule = await import('@/lib/poppy/services/dataset-store-db');
    const dataset = await storeModule.getDataset(datasetId);
    
    if (!dataset) {
      // Log for debugging
      console.error(`[Upload POST] Dataset not found: ${datasetId} for tenant: ${auth.tenantId}`);
      
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: `Dataset not found: ${datasetId}. Please ensure the dataset exists and belongs to your tenant.`,
            code: 'NOT_FOUND',
          },
        }),
        { status: 404 }
      );
    }
    
    // Phase 6: Verify tenant ownership
    requireTenantOwnership(auth.tenantId, dataset.tenantId, 'dataset');
    
    console.log(`[Upload POST] Dataset found: ${dataset.id} - ${dataset.name}`);

    // Get file from FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'No file provided',
            code: 'VALIDATION_ERROR',
          },
        }),
        { status: 400 }
      );
    }

    // Validate file type
    const filename = file.name || 'upload';
    const ext = filename.toLowerCase().split('.').pop();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Unsupported file format. Supported formats: CSV, XLSX',
            code: 'VALIDATION_ERROR',
          },
        }),
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'File too large. Maximum size is 50MB',
            code: 'VALIDATION_ERROR',
          },
        }),
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Create temporary file path for parsing
    const path = require('path');
    const fs = require('fs');
    const tempDir = path.join(process.cwd(), 'tmp', 'poppy');
    
    // Ensure temp directory exists
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      // Verify directory is writable
      fs.accessSync(tempDir, fs.constants.W_OK);
    } catch (error) {
      console.error(`[Upload] Failed to create/access temp directory: ${tempDir}`, error);
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: `Failed to create temporary directory: ${tempDir}`,
            code: 'FILE_ERROR',
          },
        }),
        { status: 500 }
      );
    }
    
    // Sanitize filename to avoid issues with spaces and special characters
    // Keep only alphanumeric, dots, hyphens, and underscores
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempFilePath = path.join(tempDir, `${Date.now()}-${sanitizedFilename}`);
    
    console.log(`[Upload] Original filename: ${filename}`);
    console.log(`[Upload] Sanitized filename: ${sanitizedFilename}`);
    console.log(`[Upload] Temp file path: ${tempFilePath}`);

    try {
      // Save temporary file
      fs.writeFileSync(tempFilePath, fileBuffer);

      // Verify file was written correctly
      if (!fs.existsSync(tempFilePath)) {
        return NextResponse.json(
          errorResponseSchema.parse({
            error: {
              message: `Failed to create temporary file at: ${tempFilePath}`,
              code: 'FILE_ERROR',
            },
          }),
          { status: 500 }
        );
      }
      
      // Check file size
      const stats = fs.statSync(tempFilePath);
      if (stats.size === 0) {
        return NextResponse.json(
          errorResponseSchema.parse({
            error: {
              message: 'Uploaded file is empty',
              code: 'VALIDATION_ERROR',
            },
          }),
          { status: 400 }
        );
      }
      
      console.log(`[Upload] Temp file created: ${tempFilePath} (${stats.size} bytes)`);
      
      // Parse file
      let parsedData;
      try {
        parsedData = parseFile(tempFilePath, { hasHeaders: true });
        console.log(`[Upload] File parsed successfully: ${parsedData.rowCount} rows, ${parsedData.columnCount} columns`);
      } catch (parseError) {
        console.error(`[Upload] Parse error:`, parseError);
        return NextResponse.json(
          errorResponseSchema.parse({
            error: {
              message: parseError instanceof Error ? parseError.message : 'Failed to parse file',
              code: 'PARSE_ERROR',
            },
          }),
          { status: 400 }
        );
      }

      // Create version ID
      const versionId = require('uuid').v4();

      // Save file to permanent storage
      const filePath = saveDatasetFile(
        fileBuffer,
        filename,
        datasetId,
        versionId
      );

      // Phase 6: Create dataset version using the same store module instance
      const version = await storeModule.createDatasetVersion(
        datasetId,
        dataset.tenantId,
        filePath,
        file.size,
        parsedData.rowCount,
        parsedData.columnCount
      );

      // Profile dataset
      const profile = profileDataset(parsedData, version.id);
      await storeModule.saveProfile(profile);
      
      // Phase 7: Run data quality checks
      try {
        const { runDataQualityChecks } = await import('@/lib/poppy/services/data-quality-checker');
        const { saveQualityCheck } = await import('@/lib/poppy/services/quality-check-store-db');
        
        const qualityCheck = runDataQualityChecks(parsedData, profile, version.id);
        await saveQualityCheck(qualityCheck);
        
        console.log(`[Upload] Quality check completed: ${qualityCheck.warnings.length} warnings found`);
      } catch (qualityCheckError) {
        console.error(`[Upload] Error running quality checks:`, qualityCheckError);
        // Don't fail upload if quality checks fail - they're informational only
      }
      
      // Phase 6: Audit log
      await createAuditLog(auth.userId, auth.tenantId, 'dataset_uploaded', 'dataset', datasetId, {
        versionId: version.id,
        fileName: file.name,
        fileSize: file.size,
        rowCount: parsedData.rowCount,
        columnCount: parsedData.columnCount,
      });
      
      // Verify profile was saved
      const savedProfile = await storeModule.getProfile(version.id);
      if (!savedProfile) {
        console.error(`[Upload] Failed to verify profile save for version: ${version.id}`);
      } else {
        console.log(`[Upload] Profile saved successfully: ${savedProfile.rowCount} rows, ${savedProfile.columnCount} columns`);
      }

      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      const response = uploadDatasetResponseSchema.parse({
        version,
      });

      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }

      throw error;
    }
  } catch (error) {
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
