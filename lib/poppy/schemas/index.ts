/**
 * Phase 0: Core Entity Schemas
 * Data Analyst Agent (Poppy) - Foundation & Contracts ONLY
 * 
 * ⚠️ NO BUSINESS LOGIC
 * ⚠️ NO DATABASE QUERIES
 * ⚠️ SCHEMAS ONLY
 */

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const timestampSchema = z.string().datetime('Invalid timestamp format');
export const tenantIdSchema = uuidSchema;

// ============================================
// TENANT SCHEMA
// ============================================

export const tenantSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, 'Tenant name is required').max(200, 'Tenant name too long'),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Tenant = z.infer<typeof tenantSchema>;

// ============================================
// DATASET SCHEMA
// ============================================

export const datasetSchema = z.object({
  id: uuidSchema,
  tenantId: tenantIdSchema,
  name: z.string().min(1, 'Dataset name is required').max(200, 'Dataset name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Dataset = z.infer<typeof datasetSchema>;

// ============================================
// DATASET VERSION SCHEMA
// ============================================

export const datasetVersionSchema = z.object({
  id: uuidSchema,
  datasetId: uuidSchema,
  tenantId: tenantIdSchema,
  version: z.number().int().positive('Version must be positive'),
  filePath: z.string().min(1, 'File path is required'),
  fileSize: z.number().int().nonnegative('File size must be non-negative'),
  rowCount: z.number().int().nonnegative('Row count must be non-negative').optional(),
  columnCount: z.number().int().nonnegative('Column count must be non-negative').optional(),
  uploadedAt: timestampSchema,
  createdAt: timestampSchema,
});

export type DatasetVersion = z.infer<typeof datasetVersionSchema>;

// ============================================
// ANALYSIS SESSION SCHEMA
// ============================================

export const analysisSessionSchema = z.object({
  id: uuidSchema,
  tenantId: tenantIdSchema,
  datasetId: uuidSchema.optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type AnalysisSession = z.infer<typeof analysisSessionSchema>;

// ============================================
// CHAT MESSAGE SCHEMA
// ============================================

export const chatMessageRoleSchema = z.enum(['user', 'assistant']);

export const chatMessageSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  tenantId: tenantIdSchema,
  role: chatMessageRoleSchema,
  content: z.string().min(1, 'Message content is required'),
  createdAt: timestampSchema,
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;

// ============================================
// GENERATED ARTIFACT SCHEMA
// ============================================

export const artifactTypeSchema = z.enum(['chart', 'table', 'insight', 'report']);

export const generatedArtifactSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  tenantId: tenantIdSchema,
  type: artifactTypeSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  data: z.record(z.unknown()), // Flexible data structure
  metadata: z.record(z.unknown()).optional(),
  createdAt: timestampSchema,
});

export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;








