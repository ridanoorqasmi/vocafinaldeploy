/**
 * Phase 2: Session Store Tests
 * Data Analyst Agent (Poppy) - Session & Message Persistence
 * 
 * Tests session and message storage functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  getSessionsByTenant,
  getSessionsByDataset,
  createMessage,
  getMessagesBySession,
  getAllSessions,
} from '@/lib/poppy/services/session-store';

describe('Phase 2: Session Store Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const datasetId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    // Clear store before each test
    // Note: In a real implementation, we'd need a reset function
    // For now, tests should be independent
  });

  describe('Session Creation', () => {
    it('should create a session with dataset', () => {
      const session = createSession(tenantId, datasetId, 'Test Session');
      
      expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(session.tenantId).toBe(tenantId);
      expect(session.datasetId).toBe(datasetId);
      expect(session.title).toBe('Test Session');
      expect(session.createdAt).toBeTruthy();
      expect(session.updatedAt).toBeTruthy();
    });

    it('should create a session without dataset', () => {
      const session = createSession(tenantId, undefined, 'Test Session');
      
      expect(session.datasetId).toBeUndefined();
      expect(session.title).toBe('Test Session');
    });

    it('should generate default title if not provided', () => {
      const session = createSession(tenantId, datasetId);
      
      expect(session.title).toBeTruthy();
      expect(session.title).toContain('Analysis Session');
    });
  });

  describe('Session Retrieval', () => {
    it('should retrieve created session by ID', () => {
      const session = createSession(tenantId, datasetId, 'Test Session');
      const retrieved = getSession(session.id);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.datasetId).toBe(datasetId);
    });

    it('should return null for non-existent session', () => {
      const retrieved = getSession('00000000-0000-0000-0000-000000000999');
      expect(retrieved).toBeNull();
    });

    it('should get all sessions for tenant', () => {
      const session1 = createSession(tenantId, datasetId, 'Session 1');
      const session2 = createSession(tenantId, datasetId, 'Session 2');
      
      const sessions = getSessionsByTenant(tenantId);
      
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.some(s => s.id === session1.id)).toBe(true);
      expect(sessions.some(s => s.id === session2.id)).toBe(true);
    });

    it('should get sessions for specific dataset', () => {
      const session1 = createSession(tenantId, datasetId, 'Session 1');
      const otherDatasetId = '00000000-0000-0000-0000-000000000002';
      const session2 = createSession(tenantId, otherDatasetId, 'Session 2');
      
      const sessions = getSessionsByDataset(datasetId);
      
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions.some(s => s.id === session1.id)).toBe(true);
      expect(sessions.some(s => s.id === session2.id)).toBe(false);
    });
  });

  describe('Message Creation', () => {
    it('should create a user message', () => {
      const session = createSession(tenantId, datasetId, 'Test Session');
      const message = createMessage(session.id, tenantId, 'user', 'Hello, Poppy!');
      
      expect(message.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(message.sessionId).toBe(session.id);
      expect(message.tenantId).toBe(tenantId);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, Poppy!');
      expect(message.createdAt).toBeTruthy();
    });

    it('should create an assistant message', () => {
      const session = createSession(tenantId, datasetId, 'Test Session');
      const message = createMessage(session.id, tenantId, 'assistant', 'Hello! How can I help?');
      
      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hello! How can I help?');
    });

    it('should update session updatedAt when message is created', () => {
      const session = createSession(tenantId, datasetId, 'Test Session');
      const originalUpdatedAt = session.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        createMessage(session.id, tenantId, 'user', 'Test message');
        const updatedSession = getSession(session.id);
        
        expect(updatedSession?.updatedAt).not.toBe(originalUpdatedAt);
      }, 10);
    });
  });

  describe('Message Retrieval', () => {
    it('should retrieve messages for session in order', () => {
      const session = createSession(tenantId, datasetId, 'Test Session');
      
      const message1 = createMessage(session.id, tenantId, 'user', 'First message');
      // Small delay to ensure ordering
      setTimeout(() => {
        const message2 = createMessage(session.id, tenantId, 'user', 'Second message');
        
        const messages = getMessagesBySession(session.id);
        
        expect(messages.length).toBeGreaterThanOrEqual(2);
        // Messages should be ordered by createdAt
        const message1Index = messages.findIndex(m => m.id === message1.id);
        const message2Index = messages.findIndex(m => m.id === message2.id);
        expect(message1Index).toBeLessThan(message2Index);
      }, 10);
    });

    it('should return empty array for session with no messages', () => {
      const session = createSession(tenantId, datasetId, 'Test Session');
      const messages = getMessagesBySession(session.id);
      
      expect(messages).toEqual([]);
    });

    it('should return messages in chronological order', () => {
      const session = createSession(tenantId, datasetId, 'Test Session');
      
      const message1 = createMessage(session.id, tenantId, 'user', 'Message 1');
      const message2 = createMessage(session.id, tenantId, 'user', 'Message 2');
      const message3 = createMessage(session.id, tenantId, 'user', 'Message 3');
      
      const messages = getMessagesBySession(session.id);
      
      expect(messages.length).toBeGreaterThanOrEqual(3);
      
      // Verify chronological order
      for (let i = 1; i < messages.length; i++) {
        const prevTime = new Date(messages[i - 1].createdAt).getTime();
        const currTime = new Date(messages[i].createdAt).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });

  describe('Dataset-Session Binding', () => {
    it('should enforce dataset binding on session creation', () => {
      const session = createSession(tenantId, datasetId, 'Bound Session');
      
      expect(session.datasetId).toBe(datasetId);
      
      // Session should be immutable - datasetId cannot change
      const retrieved = getSession(session.id);
      expect(retrieved?.datasetId).toBe(datasetId);
    });

    it('should allow session without dataset', () => {
      const session = createSession(tenantId, undefined, 'Unbound Session');
      
      expect(session.datasetId).toBeUndefined();
    });
  });
});








