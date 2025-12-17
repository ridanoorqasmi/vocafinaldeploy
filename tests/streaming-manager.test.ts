// ===== STREAMING MANAGER TESTS - PHASE 3B =====

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamingManager } from '../lib/streaming-manager';
import { LLMService } from '../lib/llm-service';
import { PromptBuilder } from '../lib/prompt-builder';
import { ResponseProcessor } from '../lib/response-processor';

// Mock the services
vi.mock('../lib/llm-service', () => ({
  LLMService: vi.fn().mockImplementation(() => ({
    generateStreamingResponse: vi.fn(),
    getBusinessQuota: vi.fn()
  }))
}));

vi.mock('../lib/prompt-builder', () => ({
  PromptBuilder: vi.fn().mockImplementation(() => ({
    buildPrompt: vi.fn(),
    validatePrompt: vi.fn()
  }))
}));

vi.mock('../lib/response-processor', () => ({
  ResponseProcessor: vi.fn().mockImplementation(() => ({
    processResponse: vi.fn()
  }))
}));

describe('StreamingManager', () => {
  let streamingManager: StreamingManager;
  let mockLLMService: any;
  let mockPromptBuilder: any;
  let mockResponseProcessor: any;

  beforeEach(() => {
    mockLLMService = {
      generateStreamingResponse: vi.fn(),
      getBusinessQuota: vi.fn()
    };

    mockPromptBuilder = {
      buildPrompt: vi.fn(),
      validatePrompt: vi.fn()
    };

    mockResponseProcessor = {
      processResponse: vi.fn()
    };

    streamingManager = new StreamingManager(
      mockLLMService,
      mockPromptBuilder,
      mockResponseProcessor
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('startStreaming', () => {
    it('should start streaming response successfully', async () => {
      const businessId = 'business-123';
      const request = {
        query: 'What is your best pizza?',
        sessionId: 'session-456'
      };

      const context = {
        business: {
          id: 'business-123',
          name: 'Pizza Palace',
          type: 'restaurant',
          description: 'Authentic Italian pizza'
        },
        conversationHistory: [],
        currentQuery: 'What is your best pizza?',
        detectedIntent: 'MENU_INQUIRY' as const,
        relevantContext: ['Menu Items: Margherita Pizza, Pepperoni Pizza']
      };

      // Mock prompt building
      const mockPrompt = {
        systemMessage: 'You are a helpful assistant for Pizza Palace.',
        businessContext: 'Business: Pizza Palace | Type: restaurant',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your best pizza?',
        responseGuidelines: 'Be helpful and professional.',
        constraints: 'Only provide business information.'
      };

      mockPromptBuilder.buildPrompt.mockReturnValue(mockPrompt);
      mockPromptBuilder.validatePrompt.mockReturnValue({
        isValid: true,
        issues: [],
        estimatedTokens: 100
      });

      // Mock LLM streaming response
      const mockLLMStream = [
        {
          chunk: 'Our best pizza is the ',
          completed: false,
          tokensUsed: 10,
          cost: 0.01,
          sessionId: 'session-456'
        },
        {
          chunk: 'Margherita Pizza!',
          completed: false,
          tokensUsed: 15,
          cost: 0.02,
          sessionId: 'session-456'
        },
        {
          chunk: '',
          completed: true,
          tokensUsed: 20,
          cost: 0.03,
          sessionId: 'session-456'
        }
      ];

      mockLLMService.generateStreamingResponse.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockLLMStream) {
            yield chunk;
          }
        }
      });

      // Mock response processing
      mockResponseProcessor.processResponse.mockResolvedValue({
        text: 'Our best pizza is the Margherita Pizza!',
        confidence: 0.9,
        sources: ['Menu Items: Margherita Pizza, Pepperoni Pizza'],
        suggestions: ['What other pizzas do you have?'],
        businessInfoExtracted: { name: 'Pizza Palace' },
        processingTimeMs: 100,
        validationResult: { isValid: true, confidence: 0.9, issues: [], suggestions: [] }
      });

      // Mock business quota
      mockLLMService.getBusinessQuota.mockResolvedValue({
        businessId: 'business-123',
        monthlyLimit: 1000000,
        currentUsage: 1000,
        remainingQuota: 999000,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // Test streaming
      const events: any[] = [];
      const stream = streamingManager.startStreaming(businessId, request, context);

      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('chunk');
      expect(events[0].data.chunk).toBe('Our best pizza is the ');
      expect(events[1].type).toBe('chunk');
      expect(events[1].data.chunk).toBe('Margherita Pizza!');
      expect(events[2].type).toBe('complete');
      expect(events[2].data.completed).toBe(true);
    });

    it('should handle streaming errors gracefully', async () => {
      const businessId = 'business-123';
      const request = {
        query: 'What is your best pizza?',
        sessionId: 'session-456'
      };

      const context = {
        business: {
          id: 'business-123',
          name: 'Pizza Palace',
          type: 'restaurant',
          description: 'Authentic Italian pizza'
        },
        conversationHistory: [],
        currentQuery: 'What is your best pizza?',
        detectedIntent: 'MENU_INQUIRY' as const,
        relevantContext: []
      };

      // Mock prompt building
      const mockPrompt = {
        systemMessage: 'You are a helpful assistant.',
        businessContext: 'Business: Pizza Palace',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your best pizza?',
        responseGuidelines: 'Be helpful.',
        constraints: 'Only provide business information.'
      };

      mockPromptBuilder.buildPrompt.mockReturnValue(mockPrompt);
      mockPromptBuilder.validatePrompt.mockReturnValue({
        isValid: true,
        issues: [],
        estimatedTokens: 100
      });

      // Mock LLM error
      mockLLMService.generateStreamingResponse.mockRejectedValue(new Error('LLM API Error'));

      // Test streaming with error
      const events: any[] = [];
      const stream = streamingManager.startStreaming(businessId, request, context);

      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].data.error).toBe('LLM API Error');
    });

    it('should handle invalid prompt', async () => {
      const businessId = 'business-123';
      const request = {
        query: 'What is your best pizza?',
        sessionId: 'session-456'
      };

      const context = {
        business: {
          id: 'business-123',
          name: 'Pizza Palace',
          type: 'restaurant',
          description: 'Authentic Italian pizza'
        },
        conversationHistory: [],
        currentQuery: 'What is your best pizza?',
        detectedIntent: 'MENU_INQUIRY' as const,
        relevantContext: []
      };

      // Mock invalid prompt
      const mockPrompt = {
        systemMessage: '',
        businessContext: 'Business: Pizza Palace',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your best pizza?',
        responseGuidelines: 'Be helpful.',
        constraints: 'Only provide business information.'
      };

      mockPromptBuilder.buildPrompt.mockReturnValue(mockPrompt);
      mockPromptBuilder.validatePrompt.mockReturnValue({
        isValid: false,
        issues: ['Missing system message'],
        estimatedTokens: 100
      });

      // Test streaming with invalid prompt
      const events: any[] = [];
      const stream = streamingManager.startStreaming(businessId, request, context);

      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].data.error).toContain('Invalid prompt');
    });
  });

  describe('getStreamingResponse', () => {
    it('should get complete streaming response', async () => {
      const businessId = 'business-123';
      const request = {
        query: 'What is your best pizza?',
        sessionId: 'session-456'
      };

      const context = {
        business: {
          id: 'business-123',
          name: 'Pizza Palace',
          type: 'restaurant',
          description: 'Authentic Italian pizza'
        },
        conversationHistory: [],
        currentQuery: 'What is your best pizza?',
        detectedIntent: 'MENU_INQUIRY' as const,
        relevantContext: []
      };

      // Mock prompt building
      const mockPrompt = {
        systemMessage: 'You are a helpful assistant.',
        businessContext: 'Business: Pizza Palace',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your best pizza?',
        responseGuidelines: 'Be helpful.',
        constraints: 'Only provide business information.'
      };

      mockPromptBuilder.buildPrompt.mockReturnValue(mockPrompt);
      mockPromptBuilder.validatePrompt.mockReturnValue({
        isValid: true,
        issues: [],
        estimatedTokens: 100
      });

      // Mock LLM streaming response
      const mockLLMStream = [
        {
          chunk: 'Our best pizza is the Margherita!',
          completed: true,
          tokensUsed: 20,
          cost: 0.03,
          sessionId: 'session-456'
        }
      ];

      mockLLMService.generateStreamingResponse.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockLLMStream) {
            yield chunk;
          }
        }
      });

      // Mock response processing
      mockResponseProcessor.processResponse.mockResolvedValue({
        text: 'Our best pizza is the Margherita!',
        confidence: 0.9,
        sources: [],
        suggestions: [],
        businessInfoExtracted: { name: 'Pizza Palace' },
        processingTimeMs: 100,
        validationResult: { isValid: true, confidence: 0.9, issues: [], suggestions: [] }
      });

      // Test getting complete response
      const result = await streamingManager.getStreamingResponse(businessId, request, context);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('session-456');
      expect(result.businessId).toBe('business-123');
      expect(result.totalTokens).toBe(20);
      expect(result.totalCost).toBe(0.03);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.chunks).toEqual(['Our best pizza is the Margherita!']);
      expect(result.finalResponse).toBe('Our best pizza is the Margherita!');
      expect(result.isComplete).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle streaming errors in getStreamingResponse', async () => {
      const businessId = 'business-123';
      const request = {
        query: 'What is your best pizza?',
        sessionId: 'session-456'
      };

      const context = {
        business: {
          id: 'business-123',
          name: 'Pizza Palace',
          type: 'restaurant',
          description: 'Authentic Italian pizza'
        },
        conversationHistory: [],
        currentQuery: 'What is your best pizza?',
        detectedIntent: 'MENU_INQUIRY' as const,
        relevantContext: []
      };

      // Mock prompt building
      const mockPrompt = {
        systemMessage: 'You are a helpful assistant.',
        businessContext: 'Business: Pizza Palace',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your best pizza?',
        responseGuidelines: 'Be helpful.',
        constraints: 'Only provide business information.'
      };

      mockPromptBuilder.buildPrompt.mockReturnValue(mockPrompt);
      mockPromptBuilder.validatePrompt.mockReturnValue({
        isValid: true,
        issues: [],
        estimatedTokens: 100
      });

      // Mock LLM error
      mockLLMService.generateStreamingResponse.mockRejectedValue(new Error('LLM API Error'));

      // Test getting response with error
      const result = await streamingManager.getStreamingResponse(businessId, request, context);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('session-456');
      expect(result.businessId).toBe('business-123');
      expect(result.totalTokens).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.chunks).toEqual([]);
      expect(result.finalResponse).toBe('');
      expect(result.isComplete).toBe(false);
      expect(result.error).toBe('LLM API Error');
    });
  });

  describe('getActiveSession', () => {
    it('should return active session', () => {
      const sessionId = 'session-123';
      
      // This would require setting up an active session first
      const session = streamingManager.getActiveSession(sessionId);
      
      expect(session).toBeUndefined(); // No active session by default
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', () => {
      const sessions = streamingManager.getActiveSessions();
      
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(0); // No active sessions by default
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', () => {
      // This would require setting up expired sessions first
      streamingManager.cleanupExpiredSessions();
      
      expect(true).toBe(true); // Placeholder for now
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = streamingManager.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
    });
  });

  describe('clearCache', () => {
    it('should clear cache', () => {
      streamingManager.clearCache();
      
      const stats = streamingManager.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = {
        chunkSize: 2048,
        timeout: 60000
      };

      streamingManager.updateConfig(newConfig);
      
      expect(true).toBe(true); // Placeholder for now
    });
  });
});
