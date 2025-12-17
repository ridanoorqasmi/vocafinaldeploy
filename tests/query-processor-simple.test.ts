// ===== SIMPLE QUERY PROCESSOR TESTS =====

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { QueryProcessor } from '../lib/query-processor';
import { QueryRequest } from '../lib/query-types';

// Mock Prisma client
const mockPrisma = {
  business: {
    findUnique: vi.fn().mockResolvedValue({
      id: 'business-123',
      name: 'Pizza Palace',
      type: 'restaurant',
      category: 'Italian',
      description: 'Authentic Italian pizza and pasta',
      phone: '555-PIZZA',
      website: 'https://pizzapalace.com',
      timezone: 'America/New_York'
    }),
    findFirst: vi.fn()
  },
  location: {
    findFirst: vi.fn().mockResolvedValue({
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001'
    })
  },
  conversation: {
    findFirst: vi.fn().mockResolvedValue({
      id: 'conv-123',
      businessId: 'business-123',
      sessionId: 'test-session-123',
      startedAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      isActive: true
    }),
    create: vi.fn(),
    update: vi.fn()
  },
  queryLog: {
    create: vi.fn()
  },
  $disconnect: vi.fn()
} as any;

// Mock all services with proper return values
vi.mock('../lib/validation-service', () => ({
  getValidationService: () => ({
    validateQuery: vi.fn().mockResolvedValue({ isValid: true, errors: [] }),
    validateSessionId: vi.fn().mockReturnValue(true),
    validateCustomerId: vi.fn().mockReturnValue(true),
    validateBusinessContext: vi.fn().mockReturnValue(true),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 })
  })
}));

vi.mock('../lib/intent-detector', () => ({
  getIntentDetector: () => ({
    detectIntent: vi.fn().mockResolvedValue({ intent: 'MENU_INQUIRY', confidence: 0.9 })
  })
}));

vi.mock('../lib/conversation-manager', () => ({
  getConversationManager: () => ({
    getOrCreateSession: vi.fn().mockResolvedValue({ 
      sessionId: 'test-session', 
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) 
    }),
    getConversationContext: vi.fn().mockResolvedValue({ messages: [], contextSummary: '' }),
    addMessage: vi.fn().mockResolvedValue(true)
  })
}));

vi.mock('../lib/analytics-logger', () => ({
  getAnalyticsLogger: () => ({
    logQuery: vi.fn().mockResolvedValue(true),
    logError: vi.fn().mockResolvedValue(true),
    getQueryAnalytics: vi.fn().mockResolvedValue({ 
      totalQueries: 100, 
      averageProcessingTime: 200, 
      successfulQueries: 95 
    })
  })
}));

vi.mock('../lib/context-retriever', () => ({
  getContextRetriever: () => ({
    retrieveAllContext: vi.fn().mockResolvedValue({ 
      menuItems: [], 
      businessHours: [], 
      policies: [], 
      faqs: [] 
    })
  })
}));

vi.mock('../lib/cache-manager', () => ({
  getCacheManager: () => ({
    getSearchResults: vi.fn(),
    setSearchResults: vi.fn(),
    isAvailable: vi.fn(() => true)
  })
}));

// Mock Phase 3B services
vi.mock('../lib/llm-service', () => ({
  LLMService: vi.fn().mockImplementation(() => ({
    generateResponse: vi.fn().mockResolvedValue({
      text: 'Our best pizza is the Margherita Pizza! It features fresh mozzarella, basil, and our signature tomato sauce.',
      tokensUsed: 150,
      cost: 0.002,
      model: 'gpt-4o',
      finishReason: 'stop',
      processingTimeMs: 1200
    }),
    getBusinessQuota: vi.fn().mockResolvedValue({
      businessId: 'business-123',
      monthlyLimit: 1000000,
      currentUsage: 1000,
      remainingQuota: 999000,
      resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }),
    generateFallbackResponse: vi.fn().mockReturnValue('Thank you for contacting Pizza Palace! Please contact us directly for assistance.'),
    validateResponse: vi.fn().mockReturnValue({
      isValid: true,
      confidence: 0.9,
      issues: [],
      suggestions: []
    })
  })),
  getLLMService: vi.fn().mockReturnValue({
    generateResponse: vi.fn().mockResolvedValue({
      text: 'Our best pizza is the Margherita Pizza! It features fresh mozzarella, basil, and our signature tomato sauce.',
      tokensUsed: 150,
      cost: 0.002,
      model: 'gpt-4o',
      finishReason: 'stop',
      processingTimeMs: 1200
    }),
    getBusinessQuota: vi.fn().mockResolvedValue({
      businessId: 'business-123',
      monthlyLimit: 1000000,
      currentUsage: 1000,
      remainingQuota: 999000,
      resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }),
    generateFallbackResponse: vi.fn().mockReturnValue('Thank you for contacting Pizza Palace! Please contact us directly for assistance.'),
    validateResponse: vi.fn().mockReturnValue({
      isValid: true,
      confidence: 0.9,
      issues: [],
      suggestions: []
    })
  })
}));

vi.mock('../lib/prompt-builder', () => ({
  PromptBuilder: vi.fn().mockImplementation(() => ({
    buildPrompt: vi.fn().mockReturnValue({
      systemMessage: 'You are a helpful assistant for Pizza Palace, a restaurant business.',
      businessContext: 'Business: Pizza Palace | Type: restaurant | Description: Authentic Italian pizza and pasta',
      conversationHistory: 'No previous conversation.',
      currentQuery: 'What is your best pizza?',
      responseGuidelines: 'Be helpful and professional.',
      constraints: 'Only provide information about this specific business.'
    }),
    validatePrompt: vi.fn().mockReturnValue({
      isValid: true,
      issues: [],
      estimatedTokens: 200
    })
  })),
  getPromptBuilder: vi.fn().mockReturnValue({
    buildPrompt: vi.fn().mockReturnValue({
      systemMessage: 'You are a helpful assistant for Pizza Palace, a restaurant business.',
      businessContext: 'Business: Pizza Palace | Type: restaurant | Description: Authentic Italian pizza and pasta',
      conversationHistory: 'No previous conversation.',
      currentQuery: 'What is your best pizza?',
      responseGuidelines: 'Be helpful and professional.',
      constraints: 'Only provide information about this specific business.'
    }),
    validatePrompt: vi.fn().mockReturnValue({
      isValid: true,
      issues: [],
      estimatedTokens: 200
    })
  })
}));

vi.mock('../lib/response-processor', () => ({
  ResponseProcessor: vi.fn().mockImplementation(() => ({
    processResponse: vi.fn().mockResolvedValue({
      text: 'Our best pizza is the Margherita Pizza! It features fresh mozzarella, basil, and our signature tomato sauce.',
      confidence: 0.9,
      sources: ['menu-1'],
      suggestions: ['What other pizzas do you have?', 'Do you have any specials today?'],
      businessInfoExtracted: {
        name: 'Pizza Palace',
        phone: '555-PIZZA',
        website: 'https://pizzapalace.com'
      },
      processingTimeMs: 50,
      validationResult: {
        isValid: true,
        confidence: 0.9,
        issues: [],
        suggestions: []
      }
    })
  })),
  getResponseProcessor: vi.fn().mockReturnValue({
    processResponse: vi.fn().mockResolvedValue({
      text: 'Our best pizza is the Margherita Pizza! It features fresh mozzarella, basil, and our signature tomato sauce.',
      confidence: 0.9,
      sources: ['menu-1'],
      suggestions: ['What other pizzas do you have?', 'Do you have any specials today?'],
      businessInfoExtracted: {
        name: 'Pizza Palace',
        phone: '555-PIZZA',
        website: 'https://pizzapalace.com'
      },
      processingTimeMs: 50,
      validationResult: {
        isValid: true,
        confidence: 0.9,
        issues: [],
        suggestions: []
      }
    })
  })
}));

vi.mock('../lib/streaming-manager', () => ({
  StreamingManager: vi.fn().mockImplementation(() => ({
    startStreaming: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'chunk',
          data: {
            chunk: 'Our best pizza is the ',
            sessionId: 'test-session-123',
            tokensUsed: 10,
            cost: 0.001,
            timestamp: new Date()
          }
        };
        yield {
          type: 'chunk',
          data: {
            chunk: 'Margherita Pizza!',
            sessionId: 'test-session-123',
            tokensUsed: 20,
            cost: 0.002,
            timestamp: new Date()
          }
        };
        yield {
          type: 'complete',
          data: {
            sessionId: 'test-session-123',
            tokensUsed: 30,
            cost: 0.003,
            completed: true,
            timestamp: new Date()
          }
        };
      }
    })
  })),
  getStreamingManager: vi.fn().mockReturnValue({
    startStreaming: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'chunk',
          data: {
            chunk: 'Our best pizza is the ',
            sessionId: 'test-session-123',
            tokensUsed: 10,
            cost: 0.001,
            timestamp: new Date()
          }
        };
        yield {
          type: 'chunk',
          data: {
            chunk: 'Margherita Pizza!',
            sessionId: 'test-session-123',
            tokensUsed: 20,
            cost: 0.002,
            timestamp: new Date()
          }
        };
        yield {
          type: 'complete',
          data: {
            sessionId: 'test-session-123',
            tokensUsed: 30,
            cost: 0.003,
            completed: true,
            timestamp: new Date()
          }
        };
      }
    })
  })
}));

describe('QueryProcessor - Simple Tests', () => {
  let queryProcessor: QueryProcessor;

  beforeEach(() => {
    queryProcessor = new QueryProcessor(mockPrisma);
    vi.clearAllMocks();
  });

  describe('processQuery', () => {
    it('should process a valid query successfully', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const result = await queryProcessor.processQuery('business-123', request);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response.text).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle validation errors', async () => {
      // Create a mock validation service that fails
      const mockValidationService = {
        validateQuery: vi.fn().mockResolvedValue({
          isValid: false,
          errors: ['Query cannot be empty']
        }),
        validateSessionId: vi.fn().mockReturnValue(true),
        validateCustomerId: vi.fn().mockReturnValue(true),
        validateBusinessContext: vi.fn().mockReturnValue(true),
        checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 })
      };

      // Create a new processor with the mock validation service
      const testProcessor = new QueryProcessor(mockPrisma, undefined, {
        validationService: mockValidationService
      });

      const request: QueryRequest = {
        query: '',
        sessionId: 'test-session-123'
      };

      await expect(
        testProcessor.processQuery('business-123', request)
      ).rejects.toThrow('Validation failed: Query cannot be empty');
    });

    it('should handle rate limiting', async () => {
      // Create a mock validation service that fails rate limiting
      const mockValidationService = {
        validateQuery: vi.fn().mockResolvedValue({
          isValid: true,
          errors: []
        }),
        validateSessionId: vi.fn().mockReturnValue(true),
        validateCustomerId: vi.fn().mockReturnValue(true),
        validateBusinessContext: vi.fn().mockReturnValue(true),
        checkRateLimit: vi.fn().mockResolvedValue({
          allowed: false,
          retryAfter: 60
        })
      };

      // Create a new processor with the mock validation service
      const testProcessor = new QueryProcessor(mockPrisma, undefined, {
        validationService: mockValidationService
      });

      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      await expect(
        testProcessor.processQuery('business-123', request)
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration correctly', () => {
      const validConfig = {
        enableContextRetrieval: true,
        enableConversationHistory: true,
        maxProcessingTimeMs: 5000
      };

      expect(() => {
        queryProcessor.validateConfig(validConfig);
      }).not.toThrow();
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        maxProcessingTimeMs: -1000 // should be positive
      };

      // Create a new processor with invalid config
      const invalidProcessor = new QueryProcessor(mockPrisma, invalidConfig);
      const result = invalidProcessor.validateConfig();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxProcessingTimeMs must be between 1000 and 30000');
    });
  });

  describe('getProcessorStats', () => {
    it('should return processor statistics', async () => {
      const stats = await queryProcessor.getProcessorStats('business-123');

      expect(stats).toBeDefined();
      expect(stats.totalQueries).toBeDefined();
      expect(stats.averageProcessingTime).toBeDefined();
      expect(stats.successRate).toBeDefined();
    });
  });
});
