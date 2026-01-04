/**
 * Phase 0: API Contract Tests
 * Data Analyst Agent (Poppy) - Foundation & Contracts ONLY
 * 
 * Tests API request/response schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  createDatasetRequestSchema,
  createDatasetResponseSchema,
  uploadDatasetRequestSchema,
  uploadDatasetResponseSchema,
  datasetProfileResponseSchema,
  createAnalysisSessionRequestSchema,
  createAnalysisSessionResponseSchema,
  getAnalysisSessionResponseSchema,
  createMessageRequestSchema,
  createMessageResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';

describe('Poppy Phase 0: API Contract Tests', () => {
  const validUuid = '00000000-0000-0000-0000-000000000000';
  const validTimestamp = new Date().toISOString();

  describe('POST /api/poppy/datasets', () => {
    it('should validate create dataset request', () => {
      const validRequest = {
        name: 'Test Dataset',
        description: 'Test description',
      };
      expect(createDatasetRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it('should validate request without description', () => {
      const validRequest = {
        name: 'Test Dataset',
      };
      expect(createDatasetRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it('should reject request with empty name', () => {
      const invalidRequest = {
        name: '',
      };
      expect(createDatasetRequestSchema.safeParse(invalidRequest).success).toBe(false);
    });

    it('should validate create dataset response', () => {
      const validResponse = {
        dataset: {
          id: validUuid,
          tenantId: validUuid,
          name: 'Test Dataset',
          description: 'Test',
          createdAt: validTimestamp,
          updatedAt: validTimestamp,
        },
      };
      expect(createDatasetResponseSchema.safeParse(validResponse).success).toBe(true);
    });
  });

  describe('POST /api/poppy/datasets/:id/upload', () => {
    it('should validate upload request', () => {
      const validRequest = {
        version: 1,
      };
      expect(uploadDatasetRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it('should validate empty upload request', () => {
      expect(uploadDatasetRequestSchema.safeParse({}).success).toBe(true);
    });

    it('should validate upload response', () => {
      const validResponse = {
        version: {
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
        },
      };
      expect(uploadDatasetResponseSchema.safeParse(validResponse).success).toBe(true);
    });
  });

  describe('GET /api/poppy/datasets/:id/profile', () => {
    it('should validate profile response', () => {
      const validResponse = {
        dataset: {
          id: validUuid,
          tenantId: validUuid,
          name: 'Test Dataset',
          createdAt: validTimestamp,
          updatedAt: validTimestamp,
        },
        latestVersion: {
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
        },
        versionCount: 1,
        totalRows: 100,
        totalColumns: 5,
        columnNames: ['col1', 'col2'],
        dataTypes: { col1: 'string', col2: 'number' },
      };
      expect(datasetProfileResponseSchema.safeParse(validResponse).success).toBe(true);
    });

    it('should validate profile response without optional fields', () => {
      const validResponse = {
        dataset: {
          id: validUuid,
          tenantId: validUuid,
          name: 'Test Dataset',
          createdAt: validTimestamp,
          updatedAt: validTimestamp,
        },
        versionCount: 0,
      };
      expect(datasetProfileResponseSchema.safeParse(validResponse).success).toBe(true);
    });
  });

  describe('POST /api/poppy/analysis-sessions', () => {
    it('should validate create session request', () => {
      const validRequest = {
        datasetId: validUuid,
        title: 'Test Session',
      };
      expect(createAnalysisSessionRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it('should validate empty create session request', () => {
      expect(createAnalysisSessionRequestSchema.safeParse({}).success).toBe(true);
    });

    it('should validate create session response', () => {
      const validResponse = {
        session: {
          id: validUuid,
          tenantId: validUuid,
          datasetId: validUuid,
          title: 'Test Session',
          createdAt: validTimestamp,
          updatedAt: validTimestamp,
        },
      };
      expect(createAnalysisSessionResponseSchema.safeParse(validResponse).success).toBe(true);
    });
  });

  describe('GET /api/poppy/analysis-sessions/:id', () => {
    it('should validate get session response', () => {
      const validResponse = {
        session: {
          id: validUuid,
          tenantId: validUuid,
          datasetId: validUuid,
          title: 'Test Session',
          createdAt: validTimestamp,
          updatedAt: validTimestamp,
        },
        messages: [
          {
            id: validUuid,
            sessionId: validUuid,
            tenantId: validUuid,
            role: 'user',
            content: 'Hello',
            createdAt: validTimestamp,
          },
        ],
        artifacts: [],
      };
      expect(getAnalysisSessionResponseSchema.safeParse(validResponse).success).toBe(true);
    });
  });

  describe('POST /api/poppy/analysis-sessions/:id/messages', () => {
    it('should validate create message request', () => {
      const validRequest = {
        content: 'Hello, Poppy!',
      };
      expect(createMessageRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it('should reject empty message', () => {
      const invalidRequest = {
        content: '',
      };
      expect(createMessageRequestSchema.safeParse(invalidRequest).success).toBe(false);
    });

    it('should validate create message response', () => {
      const validResponse = {
        message: {
          id: validUuid,
          sessionId: validUuid,
          tenantId: validUuid,
          role: 'user',
          content: 'Hello',
          createdAt: validTimestamp,
        },
        artifacts: [],
      };
      expect(createMessageResponseSchema.safeParse(validResponse).success).toBe(true);
    });
  });

  describe('Error Response Schema', () => {
    it('should validate error response', () => {
      const validError = {
        error: {
          message: 'Something went wrong',
          code: 'ERROR_CODE',
          details: { field: 'value' },
        },
      };
      expect(errorResponseSchema.safeParse(validError).success).toBe(true);
    });

    it('should validate error without optional fields', () => {
      const validError = {
        error: {
          message: 'Something went wrong',
        },
      };
      expect(errorResponseSchema.safeParse(validError).success).toBe(true);
    });
  });
});








