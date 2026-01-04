/**
 * Phase 2: Session API Route Tests
 * Data Analyst Agent (Poppy) - Real Implementation Tests
 * 
 * Tests session and message API routes with real persistence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createAnalysisSessionResponseSchema,
  getAnalysisSessionResponseSchema,
  createMessageResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';

// Helper to create a dataset first (required for session creation)
async function createTestDataset() {
  const { POST } = await import('@/app/api/poppy/datasets/route');
  const request = new NextRequest('http://localhost/api/poppy/datasets', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test Dataset for Session' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const response = await POST(request);
  const data = await response.json();
  return data.dataset.id;
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

describe('Phase 2: Session API Route Tests', () => {
  let testDatasetId: string;

  beforeEach(async () => {
    // Create a test dataset for session binding
    testDatasetId = await createTestDataset();
  });

  describe('POST /api/poppy/analysis-sessions', () => {
    it('should create session with valid dataset', async () => {
      const response = await mockPostSession({
        datasetId: testDatasetId,
        title: 'Test Session',
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(createAnalysisSessionResponseSchema.safeParse(data).success).toBe(true);
      expect(data.session.datasetId).toBe(testDatasetId);
      expect(data.session.title).toBe('Test Session');
    });

    it('should create session without dataset', async () => {
      const response = await mockPostSession({
        title: 'Unbound Session',
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(createAnalysisSessionResponseSchema.safeParse(data).success).toBe(true);
      expect(data.session.datasetId).toBeUndefined();
    });

    it('should return error for non-existent dataset', async () => {
      const response = await mockPostSession({
        datasetId: '00000000-0000-0000-0000-000000000999',
        title: 'Invalid Session',
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(errorResponseSchema.safeParse(data).success).toBe(true);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should return error for invalid request', async () => {
      const response = await mockPostSession({
        title: '', // Invalid: empty title
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/poppy/analysis-sessions/:id', () => {
    it('should return session with messages', async () => {
      // Create session
      const createResponse = await mockPostSession({
        datasetId: testDatasetId,
        title: 'Test Session',
      });
      const createData = await createResponse.json();
      const sessionId = createData.session.id;

      // Get session
      const response = await mockGetSession(sessionId);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(getAnalysisSessionResponseSchema.safeParse(data).success).toBe(true);
      expect(data.session.id).toBe(sessionId);
      expect(data.messages).toEqual([]); // New session has no messages
      expect(data.artifacts).toEqual([]); // Phase 2: No artifacts
    });

    it('should return error for non-existent session', async () => {
      const response = await mockGetSession('00000000-0000-0000-0000-000000000999');
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should return error for invalid session ID format', async () => {
      const response = await mockGetSession('invalid-uuid');
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/poppy/analysis-sessions/:id/messages', () => {
    it('should create and persist user message', async () => {
      // Create session
      const createResponse = await mockPostSession({
        datasetId: testDatasetId,
        title: 'Test Session',
      });
      const createData = await createResponse.json();
      const sessionId = createData.session.id;

      // Create message
      const response = await mockPostMessage(sessionId, {
        content: 'Hello, Poppy!',
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(createMessageResponseSchema.safeParse(data).success).toBe(true);
      expect(data.message.role).toBe('user');
      expect(data.message.content).toBe('Hello, Poppy!');
      expect(data.message.sessionId).toBe(sessionId);
      expect(data.artifacts).toEqual([]); // Phase 2: No artifacts
    });

    it('should persist message and retrieve it in session', async () => {
      // Create session
      const createResponse = await mockPostSession({
        datasetId: testDatasetId,
        title: 'Test Session',
      });
      const createData = await createResponse.json();
      const sessionId = createData.session.id;

      // Create message
      const messageResponse = await mockPostMessage(sessionId, {
        content: 'Test message',
      });
      const messageData = await messageResponse.json();
      const messageId = messageData.message.id;

      // Get session and verify message is included
      const getResponse = await mockGetSession(sessionId);
      const sessionData = await getResponse.json();
      
      expect(sessionData.messages.length).toBe(1);
      expect(sessionData.messages[0].id).toBe(messageId);
      expect(sessionData.messages[0].content).toBe('Test message');
    });

    it('should return messages in chronological order', async () => {
      // Create session
      const createResponse = await mockPostSession({
        datasetId: testDatasetId,
        title: 'Test Session',
      });
      const createData = await createResponse.json();
      const sessionId = createData.session.id;

      // Create multiple messages
      await mockPostMessage(sessionId, { content: 'First message' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await mockPostMessage(sessionId, { content: 'Second message' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await mockPostMessage(sessionId, { content: 'Third message' });

      // Get session
      const getResponse = await mockGetSession(sessionId);
      const sessionData = await getResponse.json();
      
      expect(sessionData.messages.length).toBe(3);
      
      // Verify chronological order
      for (let i = 1; i < sessionData.messages.length; i++) {
        const prevTime = new Date(sessionData.messages[i - 1].createdAt).getTime();
        const currTime = new Date(sessionData.messages[i].createdAt).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it('should return error for non-existent session', async () => {
      const response = await mockPostMessage('00000000-0000-0000-0000-000000000999', {
        content: 'Hello',
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should return error for empty message content', async () => {
      // Create session
      const createResponse = await mockPostSession({
        datasetId: testDatasetId,
        title: 'Test Session',
      });
      const createData = await createResponse.json();
      const sessionId = createData.session.id;

      const response = await mockPostMessage(sessionId, {
        content: '',
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should store messages verbatim without transformation', async () => {
      // Create session
      const createResponse = await mockPostSession({
        datasetId: testDatasetId,
        title: 'Test Session',
      });
      const createData = await createResponse.json();
      const sessionId = createData.session.id;

      const originalContent = 'Original message with special chars: !@#$%^&*()';
      const response = await mockPostMessage(sessionId, {
        content: originalContent,
      });

      const data = await response.json();
      expect(data.message.content).toBe(originalContent); // Verbatim storage
    });
  });
});








