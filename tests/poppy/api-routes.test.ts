/**
 * Phase 0: API Route Tests
 * Data Analyst Agent (Poppy) - Foundation & Contracts ONLY
 * 
 * Tests that API routes return valid mocked responses
 */

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createDatasetResponseSchema,
  uploadDatasetResponseSchema,
  datasetProfileResponseSchema,
  createAnalysisSessionResponseSchema,
  getAnalysisSessionResponseSchema,
  createMessageResponseSchema,
} from '@/lib/poppy/api/contracts';

// Mock the route handlers
async function mockPostDatasets(body: any) {
  const { POST } = await import('@/app/api/poppy/datasets/route');
  const request = new NextRequest('http://localhost/api/poppy/datasets', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return POST(request);
}

async function mockPostUpload(datasetId: string, body: any = {}) {
  const { POST } = await import('@/app/api/poppy/datasets/[id]/upload/route');
  const request = new NextRequest(`http://localhost/api/poppy/datasets/${datasetId}/upload`, {
    method: 'POST',
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
  return POST(request, { params: { id: datasetId } });
}

async function mockGetProfile(datasetId: string) {
  const { GET } = await import('@/app/api/poppy/datasets/[id]/profile/route');
  const request = new NextRequest(`http://localhost/api/poppy/datasets/${datasetId}/profile`);
  return GET(request, { params: { id: datasetId } });
}

async function mockPostSession(body: any) {
  const { POST } = await import('@/app/api/poppy/analysis-sessions/route');
  const request = new NextRequest('http://localhost/api/poppy/analysis-sessions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return POST(request);
}

async function mockGetSession(sessionId: string) {
  const { GET } = await import('@/app/api/poppy/analysis-sessions/[id]/route');
  const request = new NextRequest(`http://localhost/api/poppy/analysis-sessions/${sessionId}`);
  return GET(request, { params: { id: sessionId } });
}

async function mockPostMessage(sessionId: string, body: any) {
  const { POST } = await import('@/app/api/poppy/analysis-sessions/[id]/messages/route');
  const request = new NextRequest(
    `http://localhost/api/poppy/analysis-sessions/${sessionId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return POST(request, { params: { id: sessionId } });
}

describe('Poppy Phase 0: API Route Tests', () => {
  const validUuid = '00000000-0000-0000-0000-000000000000';

  describe('POST /api/poppy/datasets', () => {
    it('should return valid mocked dataset response', async () => {
      const response = await mockPostDatasets({ name: 'Test Dataset' });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(createDatasetResponseSchema.safeParse(data).success).toBe(true);
    });

    it('should return error for invalid request', async () => {
      const response = await mockPostDatasets({ name: '' });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/poppy/datasets/:id/upload', () => {
    it('should return valid mocked upload response', async () => {
      const response = await mockPostUpload(validUuid, { version: 1 });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(uploadDatasetResponseSchema.safeParse(data).success).toBe(true);
    });

    it('should return error for invalid dataset ID', async () => {
      const response = await mockPostUpload('invalid-uuid');
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/poppy/datasets/:id/profile', () => {
    it('should return valid mocked profile response', async () => {
      const response = await mockGetProfile(validUuid);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(datasetProfileResponseSchema.safeParse(data).success).toBe(true);
    });

    it('should return error for invalid dataset ID', async () => {
      const response = await mockGetProfile('invalid-uuid');
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/poppy/analysis-sessions', () => {
    it('should return valid mocked session response', async () => {
      const response = await mockPostSession({ title: 'Test Session' });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(createAnalysisSessionResponseSchema.safeParse(data).success).toBe(true);
    });
  });

  describe('GET /api/poppy/analysis-sessions/:id', () => {
    it('should return valid mocked session with messages', async () => {
      const response = await mockGetSession(validUuid);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(getAnalysisSessionResponseSchema.safeParse(data).success).toBe(true);
    });

    it('should return error for invalid session ID', async () => {
      const response = await mockGetSession('invalid-uuid');
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/poppy/analysis-sessions/:id/messages', () => {
    it('should return valid mocked message response', async () => {
      const response = await mockPostMessage(validUuid, { content: 'Hello, Poppy!' });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(createMessageResponseSchema.safeParse(data).success).toBe(true);
    });

    it('should return error for invalid session ID', async () => {
      const response = await mockPostMessage('invalid-uuid', { content: 'Hello' });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return error for empty message', async () => {
      const response = await mockPostMessage(validUuid, { content: '' });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});








