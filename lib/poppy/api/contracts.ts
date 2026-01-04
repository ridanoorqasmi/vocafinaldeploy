/**
 * Phase 0: API Route Contracts
 * Data Analyst Agent (Poppy) - Foundation & Contracts ONLY
 * 
 * ⚠️ NO IMPLEMENTATION
 * ⚠️ SCHEMAS ONLY
 */

import { z } from 'zod';
import {
  tenantIdSchema,
  uuidSchema,
  datasetSchema,
  datasetVersionSchema,
  analysisSessionSchema,
  chatMessageSchema,
  generatedArtifactSchema,
} from '../schemas';

// ============================================
// ERROR RESPONSE SCHEMA
// ============================================

export const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ============================================
// POST /api/poppy/datasets
// ============================================

export const createDatasetRequestSchema = z.object({
  name: z.string().min(1, 'Dataset name is required').max(200, 'Dataset name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
});

export const createDatasetResponseSchema = z.object({
  dataset: datasetSchema,
});

export type CreateDatasetRequest = z.infer<typeof createDatasetRequestSchema>;
export type CreateDatasetResponse = z.infer<typeof createDatasetResponseSchema>;

// ============================================
// POST /api/poppy/datasets/:id/upload
// ============================================

export const uploadDatasetRequestSchema = z.object({
  // File upload will be handled via FormData, this is for metadata
  version: z.number().int().positive('Version must be positive').optional(),
});

export const uploadDatasetResponseSchema = z.object({
  version: datasetVersionSchema,
});

export type UploadDatasetRequest = z.infer<typeof uploadDatasetRequestSchema>;
export type UploadDatasetResponse = z.infer<typeof uploadDatasetResponseSchema>;

// ============================================
// GET /api/poppy/datasets/:id/profile
// ============================================

export const columnProfileSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'date']),
  nullCount: z.number().int().nonnegative(),
  nullRatio: z.number().min(0).max(1),
  distinctCount: z.number().int().nonnegative(),
  min: z.number().optional(),
  max: z.number().optional(),
  mean: z.number().optional(),
});

export const datasetProfileResponseSchema = z.object({
  dataset: datasetSchema,
  latestVersion: datasetVersionSchema.optional(),
  versionCount: z.number().int().nonnegative(),
  totalRows: z.number().int().nonnegative().optional(),
  totalColumns: z.number().int().nonnegative().optional(),
  columnNames: z.array(z.string()).optional(),
  dataTypes: z.record(z.string()).optional(),
  columns: z.array(columnProfileSchema).optional(),
});

export type DatasetProfileResponse = z.infer<typeof datasetProfileResponseSchema>;

// ============================================
// GET /api/poppy/datasets/:id/quality-check
// ============================================

export const qualityWarningSchema = z.object({
  code: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  message: z.string(),
});

export const timeCoverageSchema = z.object({
  column: z.string(),
  minDate: z.string(),
  maxDate: z.string(),
  expectedGranularity: z.enum(['daily', 'weekly', 'monthly']),
  missingPeriodsCount: z.number().int().nonnegative(),
  coverageRatio: z.number().min(0).max(1),
  isPartialLatestPeriod: z.boolean(),
});

export const nullIssueSchema = z.object({
  column: z.string(),
  nullRatio: z.number().min(0).max(1),
});

export const outlierSummarySchema = z.object({
  metric: z.string(),
  method: z.enum(['IQR', 'Z_SCORE']),
  outlierRatio: z.number().min(0).max(1),
});

export const dataQualityCheckResponseSchema = z.object({
  datasetVersionId: z.string().uuid(),
  checksRunAt: z.string(),
  rowCount: z.number().int().nonnegative(),
  timeCoverage: timeCoverageSchema.optional(),
  nullIssues: z.array(nullIssueSchema),
  outlierSummary: z.array(outlierSummarySchema).optional(),
  warnings: z.array(qualityWarningSchema),
});

export type DataQualityCheckResponse = z.infer<typeof dataQualityCheckResponseSchema>;

// ============================================
// POST /api/poppy/analysis-sessions
// ============================================

export const createAnalysisSessionRequestSchema = z.object({
  datasetId: uuidSchema.optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
});

export const createAnalysisSessionResponseSchema = z.object({
  session: analysisSessionSchema,
});

export type CreateAnalysisSessionRequest = z.infer<typeof createAnalysisSessionRequestSchema>;
export type CreateAnalysisSessionResponse = z.infer<typeof createAnalysisSessionResponseSchema>;

// ============================================
// GET /api/poppy/analysis-sessions/:id
// ============================================

export const getAnalysisSessionResponseSchema = z.object({
  session: analysisSessionSchema,
  messages: z.array(chatMessageSchema),
  artifacts: z.array(generatedArtifactSchema),
});

export type GetAnalysisSessionResponse = z.infer<typeof getAnalysisSessionResponseSchema>;

// ============================================
// POST /api/poppy/analysis-sessions/:id/messages
// ============================================

export const createMessageRequestSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
});

// Phase 4.5: Intelligent Explanation schema
export const explanationSchema = z.object({
  summary: z.string(),
  implications: z.array(z.string()).optional(),
  caveats: z.array(z.string()).optional(),
});

export type Explanation = z.infer<typeof explanationSchema>;

export const createMessageResponseSchema = z.object({
  message: chatMessageSchema,
  // Phase 3: Artifacts generated from deterministic analysis
  artifacts: z.array(generatedArtifactSchema).optional(),
  // Phase 4: Explanation generated from artifacts
  explanation: explanationSchema.optional(),
  // Phase 4: Assistant message with explanation
  assistantMessage: chatMessageSchema.optional(),
});

export type CreateMessageRequest = z.infer<typeof createMessageRequestSchema>;
export type CreateMessageResponse = z.infer<typeof createMessageResponseSchema>;

