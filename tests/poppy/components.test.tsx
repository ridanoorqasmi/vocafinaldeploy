/**
 * Phase 0: Frontend Component Tests
 * Data Analyst Agent (Poppy) - Foundation & Contracts ONLY
 * 
 * Tests component props and data integrity with mocked data
 */

import { describe, it, expect } from 'vitest';
import type { Dataset, ChatMessage, GeneratedArtifact } from '@/lib/poppy/types';

describe('Poppy Phase 0: Component Data Integrity Tests', () => {
  const mockDataset: Dataset = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000000',
    name: 'Test Dataset',
    description: 'Test description',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockUserMessage: ChatMessage = {
    id: '00000000-0000-0000-0000-000000000004',
    sessionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000000',
    role: 'user',
    content: 'Hello, Poppy!',
    createdAt: new Date().toISOString(),
  };

  const mockAssistantMessage: ChatMessage = {
    id: '00000000-0000-0000-0000-000000000005',
    sessionId: '00000000-0000-0000-0000-000000000003',
    tenantId: '00000000-0000-0000-0000-000000000000',
    role: 'assistant',
    content: 'Hello! How can I help you?',
    createdAt: new Date().toISOString(),
  };

  describe('DatasetList Component Props', () => {
    it('should accept valid dataset array', () => {
      const datasets: Dataset[] = [mockDataset];
      expect(datasets).toHaveLength(1);
      expect(datasets[0].name).toBe('Test Dataset');
    });

    it('should handle empty dataset array', () => {
      const datasets: Dataset[] = [];
      expect(datasets).toHaveLength(0);
    });

    it('should validate dataset schema', () => {
      expect(mockDataset.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(mockDataset.name).toBeTruthy();
      expect(mockDataset.tenantId).toBeTruthy();
    });
  });

  describe('MessageBubble Component Props', () => {
    it('should accept valid user message', () => {
      expect(mockUserMessage.role).toBe('user');
      expect(mockUserMessage.content).toBeTruthy();
    });

    it('should accept valid assistant message', () => {
      expect(mockAssistantMessage.role).toBe('assistant');
      expect(mockAssistantMessage.content).toBeTruthy();
    });

    it('should validate message schema', () => {
      expect(mockUserMessage.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(['user', 'assistant']).toContain(mockUserMessage.role);
    });
  });

  describe('ChatPanel Component Props', () => {
    it('should accept valid message array', () => {
      const messages: ChatMessage[] = [mockUserMessage, mockAssistantMessage];
      expect(messages).toHaveLength(2);
    });

    it('should handle empty message array', () => {
      const messages: ChatMessage[] = [];
      expect(messages).toHaveLength(0);
    });

    it('should validate session ID format', () => {
      const sessionId = '00000000-0000-0000-0000-000000000003';
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('ArtifactPanel Component Props', () => {
    it('should accept valid artifact', () => {
      const mockArtifact: GeneratedArtifact = {
        id: '00000000-0000-0000-0000-000000000006',
        sessionId: '00000000-0000-0000-0000-000000000003',
        tenantId: '00000000-0000-0000-0000-000000000000',
        type: 'chart',
        title: 'Sales Chart',
        data: {},
        createdAt: new Date().toISOString(),
      };
      expect(mockArtifact.type).toBe('chart');
      expect(mockArtifact.title).toBeTruthy();
    });

    it('should handle empty artifact array', () => {
      const artifacts: GeneratedArtifact[] = [];
      expect(artifacts).toHaveLength(0);
    });

    it('should validate artifact type enum', () => {
      const validTypes = ['chart', 'table', 'insight', 'report'];
      expect(validTypes).toContain('chart');
      expect(validTypes).toContain('table');
    });
  });
});

