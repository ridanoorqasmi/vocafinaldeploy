// ===== QUERY INTEGRATION TESTS =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { QueryProcessor } from '../lib/query-processor';
import { QueryRequest, QueryIntent } from '../lib/query-types';

// Mock Prisma client with more realistic data
const mockPrisma = {
  business: {
    findUnique: vi.fn(),
    findFirst: vi.fn()
  },
  location: {
    findFirst: vi.fn()
  },
  conversation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn()
  },
  queryLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    createMany: vi.fn()
  },
  $disconnect: vi.fn()
} as any;

// Mock OpenAI client
vi.mock('../lib/openai-client', () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'MENU_INQUIRY',
                confidence: 0.9,
                reasoning: 'Query is asking about menu items'
              })
            }
          }]
        })
      }
    },
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  })
}));

// Mock embedding service
vi.mock('../lib/embedding-service', () => ({
  getEmbeddingService: () => ({
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    generateQueryEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1))
  })
}));

// Mock all other services
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
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      contextSummary: ''
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

describe('Query Integration Tests', () => {
  let queryProcessor: QueryProcessor;

  beforeEach(() => {
    // Mock business data
    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'business-123',
      name: 'Pizza Palace',
      type: 'restaurant',
      category: 'Italian',
      description: 'Authentic Italian pizza and pasta',
      phone: '555-PIZZA',
      website: 'https://pizzapalace.com',
      timezone: 'America/New_York'
    });

    mockPrisma.location.findFirst.mockResolvedValue({
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001'
    });

    // Create a new processor for each test to avoid singleton issues
    queryProcessor = new QueryProcessor(mockPrisma);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('End-to-End Query Processing', () => {
    it('should complete full query processing pipeline', async () => {
      // Create a mock conversation manager that returns the expected session ID
      const mockConversationManager = {
        getOrCreateSession: vi.fn().mockResolvedValue({ 
          sessionId: 'integration-test-session', 
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          contextSummary: ''
        }),
        getConversationContext: vi.fn().mockResolvedValue({ messages: [], contextSummary: '' }),
        addMessage: vi.fn().mockResolvedValue(true)
      };

      // Create a new processor with the mock conversation manager
      const testProcessor = new QueryProcessor(mockPrisma, undefined, {
        conversationManager: mockConversationManager
      });

      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'integration-test-session',
        customerId: 'customer123',
        context: {
          location: 'New York',
          preferences: ['vegetarian']
        }
      };

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Pizza Palace',
        description: 'Authentic Italian pizza',
        phone: '555-PIZZA',
        website: 'https://pizzapalace.com',
        timezone: 'America/New_York'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Pizza Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001'
      });

      // Mock conversation session
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: 'integration-test-session',
        customerId: 'customer123',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true,
        contextSummary: 'Customer interested in pizza'
      });

      // Mock query logs
      mockPrisma.queryLog.create.mockResolvedValue({
        id: 'log-123',
        businessId: 'business-123',
        sessionId: 'integration-test-session',
        queryText: request.query,
        createdAt: new Date()
      });

      const result = await testProcessor.processQuery('business-123', request);

      // Verify response structure
      expect(result.response).toBeDefined();
      expect(result.response.text).toBeDefined();
      expect(result.response.intent).toBeDefined();
      expect(result.response.confidence).toBeGreaterThan(0);
      expect(result.response.suggestions).toBeDefined();

      // Verify session information
      expect(result.session).toBeDefined();
      expect(result.session.sessionId).toBe('integration-test-session');
      expect(result.session.expiresAt).toBeDefined();

      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingTimeMs).toBeGreaterThan(0);
      expect(result.metadata.contextSources).toBeDefined();
    });

    it('should handle new session creation', async () => {
      const request: QueryRequest = {
        query: 'Hello, what do you have?',
        customerId: 'newcustomer456'
      };

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great food',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      // Mock new session creation
      mockPrisma.conversation.findFirst.mockResolvedValue(null); // No existing session
      mockPrisma.conversation.create.mockResolvedValue({
        id: 'new-conv-123',
        businessId: 'business-123',
        sessionId: 'new-session-123',
        customerId: 'newcustomer456',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true
      });

      mockPrisma.queryLog.create.mockResolvedValue({
        id: 'log-456',
        businessId: 'business-123',
        sessionId: 'new-session-123',
        queryText: request.query,
        createdAt: new Date()
      });

      const result = await queryProcessor.processQuery('business-123', request);

      expect(result.session.sessionId).toBe('new-session-123');
      expect(mockPrisma.conversation.create).toHaveBeenCalled();
    });

    it('should handle conversation context retrieval', async () => {
      const request: QueryRequest = {
        query: 'What about vegetarian options?',
        sessionId: 'context-test-session'
      };

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Veggie Restaurant',
        description: 'Vegetarian cuisine',
        phone: '555-VEGGIE',
        website: 'https://veggie.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '456 Veggie Ave',
        city: 'Green City',
        state: 'GC',
        zipCode: '54321'
      });

      // Mock existing session with context
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'context-conv-123',
        businessId: 'business-123',
        sessionId: 'context-test-session',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true,
        contextSummary: 'Customer asking about menu items'
      });

      // Mock conversation history
      mockPrisma.queryLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          queryText: 'What do you have?',
          createdAt: new Date(Date.now() - 5 * 60 * 1000),
          intentDetected: 'MENU_INQUIRY',
          metadata: { role: 'user' }
        },
        {
          id: 'log-2',
          queryText: 'We have pizza, pasta, and salads',
          createdAt: new Date(Date.now() - 4 * 60 * 1000),
          intentDetected: null,
          metadata: { role: 'assistant' }
        }
      ]);

      mockPrisma.queryLog.create.mockResolvedValue({
        id: 'log-3',
        businessId: 'business-123',
        sessionId: 'context-test-session',
        queryText: request.query,
        createdAt: new Date()
      });

      const result = await queryProcessor.processQuery('business-123', request);

      expect(result.response.text).toContain('vegetarian');
      expect(result.session.contextSummary).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors gracefully', async () => {
      // Create a mock context retriever that fails
      const mockContextRetriever = {
        retrieveAllContext: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      };

      // Create a new processor with the mock context retriever
      const testProcessor = new QueryProcessor(mockPrisma, undefined, {
        contextRetriever: mockContextRetriever
      });

      const request: QueryRequest = {
        query: 'Test query',
        sessionId: 'error-test-session'
      };

      // Should still work with graceful degradation
      const result = await testProcessor.processQuery('business-123', request);
      
      expect(result).toBeDefined();
      expect(result.response.text).toBeDefined();
      expect(result.metadata.businessContextUsed).toBeDefined();
    });

    it('should handle OpenAI API failures gracefully', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'openai-error-session'
      };

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great pizza',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      // Mock session
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: 'openai-error-session',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true
      });

      // Create a mock intent detector that fails and falls back to UNKNOWN
      const mockIntentDetector = {
        detectIntent: vi.fn().mockResolvedValue({ 
          intent: 'UNKNOWN', 
          confidence: 0.1,
          reasoning: 'Fallback detection due to AI service error'
        })
      };

      // Create a new processor with the mock intent detector
      const testProcessor = new QueryProcessor(mockPrisma, undefined, {
        intentDetector: mockIntentDetector
      });

      const result = await testProcessor.processQuery('business-123', request);

      // Should still work with fallback intent detection
      expect(result.response.intent).toBe('UNKNOWN');
      expect(result.response.text).toBeDefined();
      expect(result.response.confidence).toBe(0.3); // Fallback response confidence
    });

    it('should handle context retrieval failures gracefully', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'context-error-session'
      };

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great pizza',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      // Mock session
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: 'context-error-session',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true
      });

      // Create a mock context retriever that fails
      const mockContextRetriever = {
        retrieveAllContext: vi.fn().mockRejectedValue(new Error('Context retrieval failed'))
      };

      // Create a new processor with the mock context retriever
      const testProcessor = new QueryProcessor(mockPrisma, undefined, {
        contextRetriever: mockContextRetriever
      });

      const result = await testProcessor.processQuery('business-123', request);

      // Should still work without context
      expect(result.response.text).toBeDefined();
      expect(result.metadata.businessContextUsed).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should complete processing within acceptable time limits', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'performance-test-session'
      };

      // Mock all services for successful processing
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great pizza',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: 'performance-test-session',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true
      });

      mockPrisma.queryLog.create.mockResolvedValue({
        id: 'log-123',
        businessId: 'business-123',
        sessionId: 'performance-test-session',
        queryText: request.query,
        createdAt: new Date()
      });

      const startTime = Date.now();
      const result = await queryProcessor.processQuery('business-123', request);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests: QueryRequest[] = [
        { query: 'What is your best pizza?', sessionId: 'concurrent-1' },
        { query: 'What are your hours?', sessionId: 'concurrent-2' },
        { query: 'Do you deliver?', sessionId: 'concurrent-3' },
        { query: 'What is your address?', sessionId: 'concurrent-4' },
        { query: 'Do you have vegan options?', sessionId: 'concurrent-5' }
      ];

      // Mock all services
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great food',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: 'concurrent-session',
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true
      });

      mockPrisma.queryLog.create.mockResolvedValue({
        id: 'log-123',
        businessId: 'business-123',
        sessionId: 'concurrent-session',
        queryText: 'test query',
        createdAt: new Date()
      });

      const startTime = Date.now();
      const promises = requests.map(request => 
        queryProcessor.processQuery('business-123', request)
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      expect(results).toHaveLength(5);
      expect(totalTime).toBeLessThan(2000); // Should handle 5 concurrent requests within 2 seconds

      // Verify all responses are valid
      results.forEach(result => {
        expect(result.response.text).toBeDefined();
        expect(result.response.intent).toBeDefined();
        expect(result.session.sessionId).toBeDefined();
      });
    });
  });

  describe('Business Logic Integration', () => {
    it('should handle different business types correctly', async () => {
      const businessTypes = [
        {
          name: 'Pizza Palace',
          description: 'Authentic Italian pizza',
          expectedIntent: 'MENU_INQUIRY'
        },
        {
          name: 'Burger Joint',
          description: 'Gourmet burgers',
          expectedIntent: 'MENU_INQUIRY'
        },
        {
          name: 'Coffee Shop',
          description: 'Artisan coffee',
          expectedIntent: 'MENU_INQUIRY'
        }
      ];

      for (const business of businessTypes) {
        const request: QueryRequest = {
          query: 'What do you have?',
          sessionId: `business-test-${business.name.toLowerCase().replace(/\s+/g, '-')}`
        };

        mockPrisma.business.findUnique.mockResolvedValue({
          name: business.name,
          description: business.description,
          phone: '555-1234',
          website: 'https://test.com',
          timezone: 'UTC'
        });

        mockPrisma.location.findFirst.mockResolvedValue({
          address: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345'
        });

        mockPrisma.conversation.findFirst.mockResolvedValue({
          id: 'conv-123',
          businessId: 'business-123',
          sessionId: request.sessionId,
          startedAt: new Date(),
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          isActive: true
        });

        mockPrisma.queryLog.create.mockResolvedValue({
          id: 'log-123',
          businessId: 'business-123',
          sessionId: request.sessionId,
          queryText: request.query,
          createdAt: new Date()
        });

        const result = await queryProcessor.processQuery('business-123', request);

        expect(result.response.text).toContain('menu');
        expect(result.response.intent).toBeDefined();
        expect(result.session.sessionId).toBe(request.sessionId);
      }
    });

    it('should maintain conversation context across multiple queries', async () => {
      const conversationFlow = [
        { query: 'What do you have?', expectedIntent: 'MENU_INQUIRY' },
        { query: 'What about vegetarian options?', expectedIntent: 'DIETARY_RESTRICTIONS' },
        { query: 'How much does the veggie pizza cost?', expectedIntent: 'PRICING_QUESTION' },
        { query: 'Do you deliver to my area?', expectedIntent: 'LOCATION_INFO' }
      ];

      const sessionId = 'conversation-flow-session';

      // Mock business data
      mockPrisma.business.findUnique.mockResolvedValue({
        name: 'Test Restaurant',
        description: 'Great food',
        phone: '555-1234',
        website: 'https://test.com',
        timezone: 'UTC'
      });

      mockPrisma.location.findFirst.mockResolvedValue({
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      });

      // Mock session that persists across queries
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-123',
        businessId: 'business-123',
        sessionId: sessionId,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        isActive: true,
        contextSummary: 'Customer asking about menu and dietary options'
      });

      // Mock conversation history that grows with each query
      let conversationHistory: any[] = [];
      mockPrisma.queryLog.findMany.mockImplementation(() => {
        return Promise.resolve(conversationHistory);
      });

      mockPrisma.queryLog.create.mockImplementation((data) => {
        const newLog = {
          id: `log-${Date.now()}`,
          businessId: 'business-123',
          sessionId: sessionId,
          queryText: data.data.queryText,
          createdAt: new Date(),
          intentDetected: data.data.intentDetected,
          metadata: { role: 'user' }
        };
        conversationHistory.push(newLog);
        return Promise.resolve(newLog);
      });

      const results = [];

      for (const step of conversationFlow) {
        const request: QueryRequest = {
          query: step.query,
          sessionId: sessionId
        };

        const result = await queryProcessor.processQuery('business-123', request);
        results.push(result);

        // Verify response
        expect(result.response.text).toBeDefined();
        expect(result.session.sessionId).toBe(sessionId);
      }

      // Verify conversation context was maintained
      expect(results).toHaveLength(conversationFlow.length);
      expect(conversationHistory).toHaveLength(conversationFlow.length);
      
      // Verify each result has the expected session ID
      results.forEach((result, index) => {
        expect(result.session.sessionId).toBe(sessionId);
        expect(result.response.text).toBeDefined();
      });
    });
  });
});
