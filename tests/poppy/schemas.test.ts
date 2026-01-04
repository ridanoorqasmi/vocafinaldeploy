/**
 * Phase 0: Schema Validation Tests
 * Data Analyst Agent (Poppy) - Foundation & Contracts ONLY
 * 
 * Tests schema validation only - no business logic
 */

import { describe, it, expect } from 'vitest';
import {
  tenantSchema,
  datasetSchema,
  datasetVersionSchema,
  analysisSessionSchema,
  chatMessageSchema,
  generatedArtifactSchema,
  uuidSchema,
  timestampSchema,
} from '@/lib/poppy/schemas';

describe('Poppy Phase 0: Schema Validation Tests', () => {
  const validUuid = '00000000-0000-0000-0000-000000000000';
  const validTimestamp = new Date().toISOString();

  describe('Common Schemas', () => {
    it('should validate UUID schema', () => {
      expect(uuidSchema.safeParse(validUuid).success).toBe(true);
      expect(uuidSchema.safeParse('invalid-uuid').success).toBe(false);
      expect(uuidSchema.safeParse('').success).toBe(false);
    });

    it('should validate timestamp schema', () => {
      expect(timestampSchema.safeParse(validTimestamp).success).toBe(true);
      expect(timestampSchema.safeParse('invalid-timestamp').success).toBe(false);
      expect(timestampSchema.safeParse('2024-01-01').success).toBe(false); // Missing time
    });
  });

  describe('Tenant Schema', () => {
    it('should validate valid tenant', () => {
      const validTenant = {
        id: validUuid,
        name: 'Test Tenant',
        createdAt: validTimestamp,
        updatedAt: validTimestamp,
      };
      expect(tenantSchema.safeParse(validTenant).success).toBe(true);
    });

    it('should reject tenant with invalid UUID', () => {
      const invalidTenant = {
        id: 'invalid-uuid',
        name: 'Test Tenant',
        createdAt: validTimestamp,
        updatedAt: validTimestamp,
      };
      expect(tenantSchema.safeParse(invalidTenant).success).toBe(false);
    });

    it('should reject tenant with empty name', () => {
      const invalidTenant = {
        id: validUuid,
        name: '',
        createdAt: validTimestamp,
        updatedAt: validTimestamp,
      };
      expect(tenantSchema.safeParse(invalidTenant).success).toBe(false);
    });
  });

  describe('Dataset Schema', () => {
    it('should validate valid dataset', () => {
      const validDataset = {
        id: validUuid,
        tenantId: validUuid,
        name: 'Test Dataset',
        description: 'Test description',
        createdAt: validTimestamp,
        updatedAt: validTimestamp,
      };
      expect(datasetSchema.safeParse(validDataset).success).toBe(true);
    });

    it('should validate dataset without description', () => {
      const validDataset = {
        id: validUuid,
        tenantId: validUuid,
        name: 'Test Dataset',
        createdAt: validTimestamp,
        updatedAt: validTimestamp,
      };
      expect(datasetSchema.safeParse(validDataset).success).toBe(true);
    });

    it('should reject dataset with name too long', () => {
      const invalidDataset = {
        id: validUuid,
        tenantId: validUuid,
        name: 'a'.repeat(201),
        createdAt: validTimestamp,
        updatedAt: validTimestamp,
      };
      expect(datasetSchema.safeParse(invalidDataset).success).toBe(false);
    });
  });

  describe('DatasetVersion Schema', () => {
    it('should validate valid dataset version', () => {
      const validVersion = {
        id: validUuid,
        datasetId: validUuid,
        tenantId: validUuid,
        version: 1,
        filePath: '/path/to/file.csv',
        fileSize: 1024,
        rowCount: 100,
        columnCount: 5,
        uploadedAt: validTimestamp,
        createdAt: validTimestamp,
      };
      expect(datasetVersionSchema.safeParse(validVersion).success).toBe(true);
    });

    it('should validate version without optional fields', () => {
      const validVersion = {
        id: validUuid,
        datasetId: validUuid,
        tenantId: validUuid,
        version: 1,
        filePath: '/path/to/file.csv',
        fileSize: 0,
        uploadedAt: validTimestamp,
        createdAt: validTimestamp,
      };
      expect(datasetVersionSchema.safeParse(validVersion).success).toBe(true);
    });

    it('should reject version with negative version number', () => {
      const invalidVersion = {
        id: validUuid,
        datasetId: validUuid,
        tenantId: validUuid,
        version: -1,
        filePath: '/path/to/file.csv',
        fileSize: 1024,
        uploadedAt: validTimestamp,
        createdAt: validTimestamp,
      };
      expect(datasetVersionSchema.safeParse(invalidVersion).success).toBe(false);
    });
  });

  describe('AnalysisSession Schema', () => {
    it('should validate valid analysis session', () => {
      const validSession = {
        id: validUuid,
        tenantId: validUuid,
        datasetId: validUuid,
        title: 'Test Session',
        createdAt: validTimestamp,
        updatedAt: validTimestamp,
      };
      expect(analysisSessionSchema.safeParse(validSession).success).toBe(true);
    });

    it('should validate session without optional fields', () => {
      const validSession = {
        id: validUuid,
        tenantId: validUuid,
        createdAt: validTimestamp,
        updatedAt: validTimestamp,
      };
      expect(analysisSessionSchema.safeParse(validSession).success).toBe(true);
    });
  });

  describe('ChatMessage Schema', () => {
    it('should validate valid user message', () => {
      const validMessage = {
        id: validUuid,
        sessionId: validUuid,
        tenantId: validUuid,
        role: 'user',
        content: 'Hello, Poppy!',
        createdAt: validTimestamp,
      };
      expect(chatMessageSchema.safeParse(validMessage).success).toBe(true);
    });

    it('should validate valid assistant message', () => {
      const validMessage = {
        id: validUuid,
        sessionId: validUuid,
        tenantId: validUuid,
        role: 'assistant',
        content: 'Hello! How can I help?',
        createdAt: validTimestamp,
      };
      expect(chatMessageSchema.safeParse(validMessage).success).toBe(true);
    });

    it('should reject message with invalid role', () => {
      const invalidMessage = {
        id: validUuid,
        sessionId: validUuid,
        tenantId: validUuid,
        role: 'invalid-role',
        content: 'Hello!',
        createdAt: validTimestamp,
      };
      expect(chatMessageSchema.safeParse(invalidMessage).success).toBe(false);
    });

    it('should reject message with empty content', () => {
      const invalidMessage = {
        id: validUuid,
        sessionId: validUuid,
        tenantId: validUuid,
        role: 'user',
        content: '',
        createdAt: validTimestamp,
      };
      expect(chatMessageSchema.safeParse(invalidMessage).success).toBe(false);
    });
  });

  describe('GeneratedArtifact Schema', () => {
    it('should validate valid artifact', () => {
      const validArtifact = {
        id: validUuid,
        sessionId: validUuid,
        tenantId: validUuid,
        type: 'chart',
        title: 'Sales Chart',
        data: { x: [1, 2, 3], y: [10, 20, 30] },
        metadata: { format: 'bar' },
        createdAt: validTimestamp,
      };
      expect(generatedArtifactSchema.safeParse(validArtifact).success).toBe(true);
    });

    it('should validate artifact without metadata', () => {
      const validArtifact = {
        id: validUuid,
        sessionId: validUuid,
        tenantId: validUuid,
        type: 'table',
        title: 'Data Table',
        data: { columns: ['col1'], rows: [] },
        createdAt: validTimestamp,
      };
      expect(generatedArtifactSchema.safeParse(validArtifact).success).toBe(true);
    });

    it('should reject artifact with invalid type', () => {
      const invalidArtifact = {
        id: validUuid,
        sessionId: validUuid,
        tenantId: validUuid,
        type: 'invalid-type',
        title: 'Test',
        data: {},
        createdAt: validTimestamp,
      };
      expect(generatedArtifactSchema.safeParse(invalidArtifact).success).toBe(false);
    });
  });
});








