// ===== QUERY PROCESSOR TESTS =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { QueryProcessor } from '../lib/query-processor';
import { QueryRequest, QueryIntent } from '../lib/query-types';

// Mock Prisma client
const mockPrisma = {
  business: {
    findUnique: vi.fn(),
    findFirst: vi.fn()
  },
  location: {
    findFirst: vi.fn()
  },
  $disconnect: vi.fn()
} as any;

// Mock services
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
    getOrCreateSession: vi.fn().mockResolvedValue({ sessionId: 'test-session', expiresAt: new Date() }),
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

describe('QueryProcessor', () => {
  let queryProcessor: QueryProcessor;


  beforeEach(() => {
    queryProcessor = new QueryProcessor(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processQuery', () => {
    it('should process a valid query successfully', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      // Mock successful validation
      const { getValidationService } = await import('../lib/validation-service');
      const validationService = getValidationService();
      vi.mocked(validationService.validateQuery).mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedQuery: request.query
      });

      vi.mocked(validationService.validateSessionId).mockReturnValue(true);
      vi.mocked(validationService.checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 59,
        resetTime: new Date()
      });

      // Mock session management
      const { getConversationManager } = await import('../lib/conversation-manager');
      const conversationManager = getConversationManager(mockPrisma);
      vi.mocked(conversationManager.getOrCreateSession).mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: 'test-session-123',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true
      });

      // Mock intent detection
      mockServices.intent.detectIntent.mockResolvedValue({
        intent: 'MENU_INQUIRY' as QueryIntent,
        confidence: 0.9
      });

      // Mock context retrieval
      mockServices.context.retrieveAllContext.mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              id: 'embedding-1',
              contentType: 'MENU',
              content: 'Pepperoni Pizza - Our best seller',
              similarity: 0.85,
              confidence: 0.9,
              textSnippet: 'Pepperoni Pizza - Our best seller',
              metadata: { price: 15.99 }
            }
          ],
          total: 1,
          query: request.query,
          averageConfidence: 0.9,
          retrievalTime: 150
        }
      });

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great pizza place',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      // Mock conversation context
      mockServices.conversation.getConversationContext.mockResolvedValue({
        session: {
          sessionId: 'test-session-123',
          contextSummary: 'Customer asking about pizza'
        },
        messages: [],
        contextSummary: 'Customer asking about pizza',
        userPreferences: []
      });

      const result = await queryProcessor.processQuery('business-123', request);

      expect(result.response.text).toContain('menu');
      expect(result.response.intent).toBe('MENU_INQUIRY');
      expect(result.response.confidence).toBe(0.9);
      expect(result.session.sessionId).toBe('test-session-123');
      expect(result.metadata.contextSources).toContain('menu');
    });

    it('should handle validation errors', async () => {
      const request: QueryRequest = {
        query: '', // Invalid empty query
        sessionId: 'test-session-123'
      };

      mockServices.validation.validateQuery.mockResolvedValue({
        isValid: false,
        errors: ['Query cannot be empty']
      });

      await expect(
        queryProcessor.processQuery('business-123', request)
      ).rejects.toThrow('Validation failed: Query cannot be empty');
    });

    it('should handle rate limiting', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      mockServices.validation.validateQuery.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedQuery: request.query
      });

      mockServices.validation.validateSessionId.mockReturnValue(true);
      mockServices.validation.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: new Date(),
        retryAfter: 60
      });

      await expect(
        queryProcessor.processQuery('business-123', request)
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle intent detection failure gracefully', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      // Mock successful validation and rate limiting
      mockServices.validation.validateQuery.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedQuery: request.query
      });

      mockServices.validation.validateSessionId.mockReturnValue(true);
      mockServices.validation.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 59,
        resetTime: new Date()
      });

      mockServices.conversation.getOrCreateSession.mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: 'test-session-123',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true
      });

      // Mock intent detection failure
      mockServices.intent.detectIntent.mockRejectedValue(new Error('Intent detection failed'));

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great pizza place',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      const result = await queryProcessor.processQuery('business-123', request);

      // Should still work with fallback intent
      expect(result.response.intent).toBe('UNKNOWN');
      expect(result.response.confidence).toBeLessThan(0.5);
    });

    it('should handle context retrieval failure gracefully', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      // Mock successful validation, rate limiting, and session management
      mockServices.validation.validateQuery.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedQuery: request.query
      });

      mockServices.validation.validateSessionId.mockReturnValue(true);
      mockServices.validation.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 59,
        resetTime: new Date()
      });

      mockServices.conversation.getOrCreateSession.mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: 'test-session-123',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true
      });

      mockServices.intent.detectIntent.mockResolvedValue({
        intent: 'MENU_INQUIRY' as QueryIntent,
        confidence: 0.9
      });

      // Mock context retrieval failure
      mockServices.context.retrieveAllContext.mockResolvedValue({
        success: false,
        error: { message: 'Context retrieval failed' }
      });

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great pizza place',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      const result = await queryProcessor.processQuery('business-123', request);

      // Should still work without context
      expect(result.response.text).toContain('menu');
      expect(result.metadata.contextSources).toEqual([]);
    });
  });

  describe('generatePlaceholderResponse', () => {
    it('should generate appropriate responses for different intents', async () => {
      const testCases = [
        { intent: 'MENU_INQUIRY' as QueryIntent, expectedText: 'menu' },
        { intent: 'HOURS_POLICY' as QueryIntent, expectedText: 'hours' },
        { intent: 'PRICING_QUESTION' as QueryIntent, expectedText: 'pricing' },
        { intent: 'DIETARY_RESTRICTIONS' as QueryIntent, expectedText: 'dietary' },
        { intent: 'LOCATION_INFO' as QueryIntent, expectedText: 'location' },
        { intent: 'GENERAL_CHAT' as QueryIntent, expectedText: 'Hello' },
        { intent: 'COMPLAINT_FEEDBACK' as QueryIntent, expectedText: 'sorry' },
        { intent: 'UNKNOWN' as QueryIntent, expectedText: 'help' }
      ];

      for (const testCase of testCases) {
        const request: QueryRequest = {
          query: 'Test query',
          sessionId: 'test-session-123'
        };

        // Mock all services for successful processing
        mockServices.validation.validateQuery.mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedQuery: request.query
        });

        mockServices.validation.validateSessionId.mockReturnValue(true);
        mockServices.validation.checkRateLimit.mockResolvedValue({
          allowed: true,
          remaining: 59,
          resetTime: new Date()
        });

        mockServices.conversation.getOrCreateSession.mockResolvedValue({
          id: 'conv-123',
          businessId: 'business-123',
          sessionId: 'test-session-123',
          startedAt: new Date(),
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          isActive: true
        });

        mockServices.intent.detectIntent.mockResolvedValue({
          intent: testCase.intent,
          confidence: 0.9
        });

        mockServices.context.retrieveAllContext.mockResolvedValue({
          success: true,
          data: { results: [], total: 0, query: request.query, averageConfidence: 0.9, retrievalTime: 100 }
        });

        mockPrisma.business.findUnique.mockResolvedValue({
          name: 'Test Restaurant',
          description: 'Great pizza place',
          phone: '555-1234',
          website: 'https://test.com',
          timezone: 'UTC'
        });

        mockPrisma.location.findFirst.mockResolvedValue({
          address: '123 Main St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345'
        });

        const result = await queryProcessor.processQuery('business-123', request);

        expect(result.response.text.toLowerCase()).toContain(testCase.expectedText);
        expect(result.response.intent).toBe(testCase.intent);
      }
    });
  });

  describe('generateSuggestions', () => {
    it('should generate appropriate suggestions for different intents', async () => {
      const testCases = [
        { intent: 'MENU_INQUIRY' as QueryIntent, expectedSuggestions: ['popular', 'specials', 'ingredients'] },
        { intent: 'HOURS_POLICY' as QueryIntent, expectedSuggestions: ['delivery', 'pickup', 'cancellation'] },
        { intent: 'PRICING_QUESTION' as QueryIntent, expectedSuggestions: ['deals', 'included', 'discounts'] },
        { intent: 'DIETARY_RESTRICTIONS' as QueryIntent, expectedSuggestions: ['vegan', 'gluten', 'allergies'] },
        { intent: 'LOCATION_INFO' as QueryIntent, expectedSuggestions: ['delivery', 'radius', 'locations'] }
      ];

      for (const testCase of testCases) {
        const request: QueryRequest = {
          query: 'Test query',
          sessionId: 'test-session-123'
        };

        // Mock all services for successful processing
        mockServices.validation.validateQuery.mockResolvedValue({
          isValid: true,
          errors: [],
          sanitizedQuery: request.query
        });

        mockServices.validation.validateSessionId.mockReturnValue(true);
        mockServices.validation.checkRateLimit.mockResolvedValue({
          allowed: true,
          remaining: 59,
          resetTime: new Date()
        });

        mockServices.conversation.getOrCreateSession.mockResolvedValue({
          id: 'conv-123',
          businessId: 'business-123',
          sessionId: 'test-session-123',
          startedAt: new Date(),
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          isActive: true
        });

        mockServices.intent.detectIntent.mockResolvedValue({
          intent: testCase.intent,
          confidence: 0.9
        });

        mockServices.context.retrieveAllContext.mockResolvedValue({
          success: true,
          data: { results: [], total: 0, query: request.query, averageConfidence: 0.9, retrievalTime: 100 }
        });

        mockPrisma.business.findUnique.mockResolvedValue({
          name: 'Test Restaurant',
          description: 'Great pizza place',
          phone: '555-1234',
          website: 'https://test.com',
          timezone: 'UTC'
        });

        mockPrisma.location.findFirst.mockResolvedValue({
          address: '123 Main St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345'
        });

        const result = await queryProcessor.processQuery('business-123', request);

        expect(result.response.suggestions).toBeDefined();
        expect(result.response.suggestions!.length).toBeGreaterThan(0);
        
        // Check that suggestions contain expected keywords
        const suggestionsText = result.response.suggestions!.join(' ').toLowerCase();
        for (const expected of testCase.expectedSuggestions) {
          expect(suggestionsText).toContain(expected);
        }
      }
    });
  });

  describe('getProcessorStats', () => {
    it('should return processor statistics', async () => {
      mockServices.analytics.getQueryAnalytics.mockResolvedValue({
        totalQueries: 100,
        successfulQueries: 95,
        averageProcessingTime: 250,
        intentDistribution: {
          MENU_INQUIRY: 40,
          HOURS_POLICY: 20,
          PRICING_QUESTION: 15,
          DIETARY_RESTRICTIONS: 10,
          LOCATION_INFO: 8,
          GENERAL_CHAT: 5,
          COMPLAINT_FEEDBACK: 2,
          UNKNOWN: 0
        }
      });

      const stats = await queryProcessor.getProcessorStats('business-123');

      expect(stats.totalQueries).toBe(100);
      expect(stats.averageProcessingTime).toBe(250);
      expect(stats.successRate).toBe(0.95);
      expect(stats.intentDistribution.MENU_INQUIRY).toBe(40);
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration correctly', () => {
      const validation = queryProcessor.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidProcessor = new QueryProcessor(mockPrisma, {
        maxProcessingTimeMs: 500 // Too low
      });

      const validation = invalidProcessor.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
