// ===== PHASE 3B INTEGRATION TESTS =====

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getQueryProcessor } from '../lib/query-processor';
import { LLMService } from '../lib/llm-service';
import { PromptBuilder } from '../lib/prompt-builder';
import { ResponseProcessor } from '../lib/response-processor';
import { StreamingManager } from '../lib/streaming-manager';
import { QueryRequest } from '../lib/query-types';

// Mock Prisma
const mockPrisma = {
  business: {
    findUnique: vi.fn(),
    findFirst: vi.fn()
  },
  location: {
    findFirst: vi.fn()
  },
  conversation: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  queryLog: {
    create: vi.fn()
  }
};

// Mock all services
vi.mock('../lib/validation-service', () => ({
  getValidationService: () => ({
    validateQuery: vi.fn().mockResolvedValue({ isValid: true, errors: [] }),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
    validateSessionId: vi.fn().mockResolvedValue({ isValid: true }),
    validateCustomerId: vi.fn().mockResolvedValue({ isValid: true }),
    validateBusinessContext: vi.fn().mockResolvedValue({ isValid: true })
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
      sessionId: 'test-session-123',
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
    logError: vi.fn().mockResolvedValue(true)
  })
}));

vi.mock('../lib/context-retriever', () => ({
  getContextRetriever: () => ({
    retrieveAllContext: vi.fn().mockResolvedValue({
      embeddings: {
        menuItems: [
          { id: 'menu-1', content: 'Margherita Pizza - $15', similarity: 0.9 }
        ],
        policies: [
          { id: 'policy-1', content: 'No outside food allowed', similarity: 0.8 }
        ],
        faqs: [
          { id: 'faq-1', content: 'We are open 11 AM to 10 PM', similarity: 0.7 }
        ]
      },
      businessData: {
        name: 'Pizza Palace',
        description: 'Authentic Italian pizza and pasta',
        phone: '555-PIZZA',
        website: 'https://pizzapalace.com'
      },
      menu: {
        items: [
          { name: 'Margherita Pizza', price: '$15', description: 'Fresh mozzarella and basil' }
        ]
      },
      hours: {
        currentStatus: 'Open',
        todayHours: '11:00 AM - 10:00 PM'
      },
      conversation: {
        history: [],
        contextSummary: '',
        userPreferences: []
      }
    })
  })
}));

vi.mock('../lib/cache-manager', () => ({
  getCacheManager: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true)
  })
}));

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
    generateStreamingResponse: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          chunk: 'Our best pizza is the ',
          completed: false,
          tokensUsed: 10,
          cost: 0.001,
          sessionId: 'test-session-123'
        };
        yield {
          chunk: 'Margherita Pizza!',
          completed: false,
          tokensUsed: 20,
          cost: 0.002,
          sessionId: 'test-session-123'
        };
        yield {
          chunk: '',
          completed: true,
          tokensUsed: 30,
          cost: 0.003,
          sessionId: 'test-session-123'
        };
      }
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
  }))
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
  }))
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
  }))
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
  }))
}));

describe('Phase 3B Integration Tests', () => {
  let queryProcessor: any;

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

    mockPrisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-123',
      businessId: 'business-123',
      sessionId: 'test-session-123',
      startedAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      isActive: true
    });

    queryProcessor = getQueryProcessor(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GPT-4o Integration', () => {
    it('should process query with GPT-4o response generation', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const response = await queryProcessor.processQuery('business-123', request);

      expect(response).toBeDefined();
      expect(response.response.text).toContain('Margherita Pizza');
      expect(response.response.confidence).toBeGreaterThan(0.8);
      expect(response.response.intent).toBe('MENU_INQUIRY');
      expect(response.response.suggestions).toBeDefined();
      expect(response.response.suggestions.length).toBeGreaterThan(0);
      expect(response.response.streamingAvailable).toBe(true);
      expect(response.usage).toBeDefined();
      expect(response.usage.tokensUsed).toBe(150);
      expect(response.usage.costEstimate).toBeGreaterThan(0);
      expect(response.usage.remainingQuota).toBeGreaterThan(0);
      expect(response.metadata.modelUsed).toBe('gpt-4o');
      expect(response.metadata.temperature).toBe(0.7);
      expect(response.metadata.responseCached).toBe(false);
      expect(response.session.turnCount).toBe(1);
    });

    it('should handle GPT-4o API failures with fallback', async () => {
      // Mock LLM service to throw error
      const mockLLMService = new LLMService();
      mockLLMService.generateResponse = vi.fn().mockRejectedValue(new Error('OpenAI API Error'));

      const testProcessor = getQueryProcessor(mockPrisma, undefined, {
        llmService: mockLLMService
      });

      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const response = await testProcessor.processQuery('business-123', request);

      expect(response).toBeDefined();
      expect(response.response.text).toContain('Thank you for contacting Pizza Palace');
      expect(response.response.confidence).toBe(0.3);
      expect(response.response.streamingAvailable).toBe(false);
      expect(response.metadata.modelUsed).toBe('fallback');
      expect(response.usage.tokensUsed).toBe(0);
      expect(response.usage.costEstimate).toBe(0);
    });
  });

  describe('Dynamic Prompt Engineering', () => {
    it('should build business-specific prompts for restaurant', async () => {
      const request: QueryRequest = {
        query: 'What are your hours?',
        sessionId: 'test-session-123'
      };

      const response = await queryProcessor.processQuery('business-123', request);

      expect(response).toBeDefined();
      expect(response.response.text).toBeDefined();
      expect(response.metadata.businessContextUsed).toContain('menu');
      expect(response.metadata.businessContextUsed).toContain('business_data');
    });

    it('should handle different business types', async () => {
      // Mock retail business
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'business-456',
        name: 'Tech Store',
        type: 'retail',
        category: 'Electronics',
        description: 'Latest electronics and gadgets',
        phone: '555-TECH',
        website: 'https://techstore.com',
        timezone: 'America/Los_Angeles'
      });

      const request: QueryRequest = {
        query: 'Do you have the latest iPhone?',
        sessionId: 'test-session-123'
      };

      const response = await queryProcessor.processQuery('business-456', request);

      expect(response).toBeDefined();
      expect(response.response.text).toBeDefined();
      expect(response.response.intent).toBe('MENU_INQUIRY');
    });
  });

  describe('Response Processing & Quality Assurance', () => {
    it('should process and validate GPT-4o responses', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const response = await queryProcessor.processQuery('business-123', request);

      expect(response).toBeDefined();
      expect(response.response.text).toContain('Margherita Pizza');
      expect(response.response.confidence).toBeGreaterThan(0.8);
      expect(response.response.sources).toContain('menu-1');
      expect(response.response.suggestions).toContain('What other pizzas do you have?');
      expect(response.metadata.businessContextUsed).toBeDefined();
    });

    it('should extract business information from responses', async () => {
      const request: QueryRequest = {
        query: 'What is your phone number?',
        sessionId: 'test-session-123'
      };

      const response = await queryProcessor.processQuery('business-123', request);

      expect(response).toBeDefined();
      expect(response.response.text).toBeDefined();
      expect(response.response.sources).toBeDefined();
    });
  });

  describe('Streaming Response API', () => {
    it('should process streaming queries', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const events: any[] = [];
      const stream = queryProcessor.processStreamingQuery('business-123', request);

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
      // Mock streaming manager to throw error
      const mockStreamingManager = new StreamingManager();
      mockStreamingManager.startStreaming = vi.fn().mockRejectedValue(new Error('Streaming Error'));

      const testProcessor = getQueryProcessor(mockPrisma, undefined, {
        streamingManager: mockStreamingManager
      });

      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const events: any[] = [];
      const stream = testProcessor.processStreamingQuery('business-123', request);

      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].data.error).toBe('Streaming Error');
    });
  });

  describe('Token Usage & Cost Tracking', () => {
    it('should track token usage and costs', async () => {
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const response = await queryProcessor.processQuery('business-123', request);

      expect(response.usage).toBeDefined();
      expect(response.usage.tokensUsed).toBe(150);
      expect(response.usage.costEstimate).toBeGreaterThan(0);
      expect(response.usage.remainingQuota).toBeGreaterThan(0);
      expect(response.metadata.modelUsed).toBe('gpt-4o');
    });

    it('should handle quota exceeded scenarios', async () => {
      // Mock LLM service to throw quota error
      const mockLLMService = new LLMService();
      mockLLMService.generateResponse = vi.fn().mockRejectedValue(new Error('Monthly token quota exceeded'));

      const testProcessor = getQueryProcessor(mockPrisma, undefined, {
        llmService: mockLLMService
      });

      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const response = await testProcessor.processQuery('business-123', request);

      expect(response).toBeDefined();
      expect(response.response.text).toContain('Thank you for contacting Pizza Palace');
      expect(response.metadata.modelUsed).toBe('fallback');
      expect(response.usage.tokensUsed).toBe(0);
    });
  });

  describe('Conversation Context & Multi-turn', () => {
    it('should maintain conversation context across multiple queries', async () => {
      const request1: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const request2: QueryRequest = {
        query: 'What about vegetarian options?',
        sessionId: 'test-session-123'
      };

      const response1 = await queryProcessor.processQuery('business-123', request1);
      const response2 = await queryProcessor.processQuery('business-123', request2);

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
      expect(response1.session.sessionId).toBe(response2.session.sessionId);
      expect(response2.session.turnCount).toBe(2);
    });
  });

  describe('Performance & Reliability', () => {
    it('should complete processing within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const request: QueryRequest = {
        query: 'What is your best pizza?',
        sessionId: 'test-session-123'
      };

      const response = await queryProcessor.processQuery('business-123', request);
      
      const processingTime = Date.now() - startTime;

      expect(response).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(response.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        query: `What is your best pizza ${i}?`,
        sessionId: `test-session-${i}`
      }));

      const promises = requests.map(request => 
        queryProcessor.processQuery('business-123', request)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.response.text).toBeDefined();
        expect(response.response.confidence).toBeGreaterThan(0);
      });
    });
  });
});
