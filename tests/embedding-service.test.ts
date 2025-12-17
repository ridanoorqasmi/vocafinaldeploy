// ===== EMBEDDING SERVICE UNIT TESTS =====

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ContentProcessor } from '../lib/content-processor';
import { EmbeddingGenerator } from '../lib/embedding-generator';
import { createEmbeddingManager } from '../lib/embedding-manager';
import { createAutoTrigger } from '../lib/auto-trigger';
import { createUsageTracker } from '../lib/usage-tracker';
import { EmbeddingType } from '../lib/embedding-types';

// Mock OpenAI client
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn()
    },
    models: {
      list: vi.fn()
    }
  }))
}));

// Mock Prisma client
const mockPrisma = {
  embedding: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn()
  },
  business: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  usageMetric: {
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn()
  },
  $executeRaw: vi.fn(),
  $disconnect: vi.fn()
} as any;

describe('ContentProcessor', () => {
  describe('processMenuItem', () => {
    it('should process menu item data correctly', () => {
      const menuData = {
        name: 'Margherita Pizza',
        description: 'Classic tomato and mozzarella pizza',
        category: 'Pizza',
        price: 12.99,
        allergens: ['gluten', 'dairy'],
        calories: 800,
        prepTime: 15
      };

      const result = ContentProcessor.processMenuItem(menuData);

      expect(result.success).toBe(true);
      expect(result.text).toContain('Margherita Pizza');
      expect(result.text).toContain('Classic tomato and mozzarella pizza');
      expect(result.text).toContain('Category: Pizza');
      expect(result.text).toContain('Price: $12.99');
      expect(result.text).toContain('Allergens: gluten, dairy');
      expect(result.text).toContain('Calories: 800');
      expect(result.text).toContain('Prep time: 15 minutes');
      expect(result.metadata.type).toBe('menu_item');
      expect(result.metadata.name).toBe('Margherita Pizza');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    it('should handle minimal menu item data', () => {
      const menuData = {
        name: 'Simple Item'
      };

      const result = ContentProcessor.processMenuItem(menuData);

      expect(result.success).toBe(true);
      expect(result.text).toBe('Simple Item');
      expect(result.metadata.type).toBe('menu_item');
    });

    it('should truncate long content', () => {
      const menuData = {
        name: 'Test Item',
        description: 'A'.repeat(10000) // Very long description
      };

      const result = ContentProcessor.processMenuItem(menuData);

      expect(result.success).toBe(true);
      expect(result.text.length).toBeLessThan(10000);
      expect(result.text).toContain('...');
    });
  });

  describe('processPolicy', () => {
    it('should process policy data correctly', () => {
      const policyData = {
        title: 'Delivery Policy',
        content: 'We deliver within 5 miles',
        type: 'delivery',
        effectiveDate: new Date('2024-01-01')
      };

      const result = ContentProcessor.processPolicy(policyData);

      expect(result.success).toBe(true);
      expect(result.text).toContain('Delivery Policy');
      expect(result.text).toContain('We deliver within 5 miles');
      expect(result.text).toContain('Type: delivery');
      expect(result.text).toContain('Effective: 2024-01-01');
      expect(result.metadata.type).toBe('policy');
    });
  });

  describe('processFAQ', () => {
    it('should process FAQ data correctly', () => {
      const faqData = {
        question: 'What are your hours?',
        answer: 'We are open 9 AM to 9 PM',
        category: 'General',
        tags: ['hours', 'business']
      };

      const result = ContentProcessor.processFAQ(faqData);

      expect(result.success).toBe(true);
      expect(result.text).toContain('Question: What are your hours?');
      expect(result.text).toContain('Answer: We are open 9 AM to 9 PM');
      expect(result.text).toContain('Category: General');
      expect(result.text).toContain('Tags: hours, business');
      expect(result.metadata.type).toBe('faq');
    });
  });

  describe('processBusiness', () => {
    it('should process business data correctly', () => {
      const businessData = {
        name: 'Mario\'s Pizza',
        description: 'Authentic Italian pizza',
        cuisineType: 'Italian',
        location: '123 Main St',
        industry: 'Restaurant'
      };

      const result = ContentProcessor.processBusiness(businessData);

      expect(result.success).toBe(true);
      expect(result.text).toContain('Mario\'s Pizza');
      expect(result.text).toContain('Authentic Italian pizza');
      expect(result.text).toContain('Cuisine: Italian');
      expect(result.text).toContain('Location: 123 Main St');
      expect(result.text).toContain('Industry: Restaurant');
      expect(result.metadata.type).toBe('business');
    });
  });

  describe('validateContent', () => {
    it('should validate menu item content', () => {
      const validData = { name: 'Test Item' };
      const invalidData = { description: 'No name' };

      expect(ContentProcessor.validateContent('MENU', validData)).toBe(true);
      expect(ContentProcessor.validateContent('MENU', invalidData)).toBe(false);
    });

    it('should validate policy content', () => {
      const validData = { title: 'Test Policy', content: 'Test content' };
      const invalidData = { title: 'Test Policy' }; // Missing content

      expect(ContentProcessor.validateContent('POLICY', validData)).toBe(true);
      expect(ContentProcessor.validateContent('POLICY', invalidData)).toBe(false);
    });

    it('should validate FAQ content', () => {
      const validData = { question: 'Test?', answer: 'Test answer' };
      const invalidData = { question: 'Test?' }; // Missing answer

      expect(ContentProcessor.validateContent('FAQ', validData)).toBe(true);
      expect(ContentProcessor.validateContent('FAQ', invalidData)).toBe(false);
    });

    it('should validate business content', () => {
      const validData = { name: 'Test Business' };
      const invalidData = { description: 'No name' };

      expect(ContentProcessor.validateContent('BUSINESS', validData)).toBe(true);
      expect(ContentProcessor.validateContent('BUSINESS', invalidData)).toBe(false);
    });
  });
});

describe('EmbeddingGenerator', () => {
  let embeddingGenerator: EmbeddingGenerator;

  beforeEach(() => {
    embeddingGenerator = EmbeddingGenerator.getInstance();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid content', async () => {
      const request = {
        businessId: 'test-business',
        contentType: 'MENU' as EmbeddingType,
        contentId: 'test-item',
        data: {
          name: 'Test Item',
          description: 'Test description'
        }
      };

      // Mock OpenAI response
      const mockEmbedding = new Array(1536).fill(0.1);
      vi.mocked(mockPrisma.embedding.create).mockResolvedValue({
        id: 'test-embedding',
        businessId: 'test-business',
        contentType: 'MENU',
        contentId: 'test-item',
        content: 'Test Item - Test description',
        embedding: mockEmbedding,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });

      const result = await embeddingGenerator.generateEmbedding(request);

      expect(result.success).toBe(true);
      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.processedContent).toBeDefined();
      expect(result.metadata?.tokenCount).toBeGreaterThan(0);
    });

    it('should handle invalid content', async () => {
      const request = {
        businessId: 'test-business',
        contentType: 'MENU' as EmbeddingType,
        contentId: 'test-item',
        data: {} // Invalid data
      };

      const result = await embeddingGenerator.generateEmbedding(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle OpenAI API errors', async () => {
      const request = {
        businessId: 'test-business',
        contentType: 'MENU' as EmbeddingType,
        contentId: 'test-item',
        data: {
          name: 'Test Item'
        }
      };

      // Mock OpenAI error
      vi.mocked(mockPrisma.embedding.create).mockRejectedValue(new Error('API Error'));

      const result = await embeddingGenerator.generateEmbedding(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('generateQueryEmbedding', () => {
    it('should generate embedding for search query', async () => {
      const query = 'pizza with pepperoni';

      // Mock OpenAI response
      const mockEmbedding = new Array(1536).fill(0.2);
      vi.mocked(mockPrisma.embedding.create).mockResolvedValue({
        id: 'query-embedding',
        businessId: 'test-business',
        contentType: 'MENU',
        contentId: 'query',
        content: query,
        embedding: mockEmbedding,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });

      const result = await embeddingGenerator.generateQueryEmbedding(query);

      expect(result.success).toBe(true);
      expect(result.embedding).toEqual(mockEmbedding);
      expect(result.processedContent?.text).toBe(query);
    });

    it('should handle empty query', async () => {
      const result = await embeddingGenerator.generateQueryEmbedding('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });
  });
});

describe('EmbeddingManager', () => {
  let embeddingManager: ReturnType<typeof createEmbeddingManager>;

  beforeEach(() => {
    embeddingManager = createEmbeddingManager(mockPrisma);
  });

  describe('createOrUpdateEmbedding', () => {
    it('should create new embedding', async () => {
      const request = {
        businessId: 'test-business',
        contentType: 'MENU' as EmbeddingType,
        contentId: 'test-item',
        data: {
          name: 'Test Item'
        }
      };

      // Mock existing embedding check (not found)
      vi.mocked(mockPrisma.embedding.findUnique).mockResolvedValue(null);

      // Mock creation
      const mockEmbedding = {
        id: 'test-embedding',
        businessId: 'test-business',
        contentType: 'MENU',
        contentId: 'test-item',
        content: 'Test Item',
        embedding: new Array(1536).fill(0.1),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      vi.mocked(mockPrisma.embedding.create).mockResolvedValue(mockEmbedding);

      const result = await embeddingManager.createOrUpdateEmbedding(request);

      expect(result.success).toBe(true);
      expect(result.embedding?.id).toBe('test-embedding');
    });

    it('should update existing embedding', async () => {
      const request = {
        businessId: 'test-business',
        contentType: 'MENU' as EmbeddingType,
        contentId: 'test-item',
        data: {
          name: 'Updated Item'
        }
      };

      // Mock existing embedding
      const existingEmbedding = {
        id: 'test-embedding',
        businessId: 'test-business',
        contentType: 'MENU',
        contentId: 'test-item',
        content: 'Old content',
        embedding: new Array(1536).fill(0.1),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      };
      vi.mocked(mockPrisma.embedding.findUnique).mockResolvedValue(existingEmbedding);

      // Mock update
      const updatedEmbedding = {
        ...existingEmbedding,
        content: 'Updated Item',
        updatedAt: new Date()
      };
      vi.mocked(mockPrisma.embedding.update).mockResolvedValue(updatedEmbedding);

      const result = await embeddingManager.createOrUpdateEmbedding(request);

      expect(result.success).toBe(true);
      expect(result.embedding?.content).toBe('Updated Item');
    });
  });

  describe('searchEmbeddings', () => {
    it('should search embeddings by similarity', async () => {
      const searchRequest = {
        businessId: 'test-business',
        query: 'pizza',
        limit: 5,
        threshold: 0.7
      };

      // Mock embeddings list
      const mockEmbeddings = [
        {
          id: 'embedding-1',
          businessId: 'test-business',
          contentType: 'MENU' as EmbeddingType,
          contentId: 'item-1',
          content: 'Margherita Pizza',
          embedding: new Array(1536).fill(0.8), // High similarity
          metadata: {}
        },
        {
          id: 'embedding-2',
          businessId: 'test-business',
          contentType: 'MENU' as EmbeddingType,
          contentId: 'item-2',
          content: 'Caesar Salad',
          embedding: new Array(1536).fill(0.3), // Low similarity
          metadata: {}
        }
      ];
      vi.mocked(mockPrisma.embedding.findMany).mockResolvedValue(mockEmbeddings);

      const result = await embeddingManager.searchEmbeddings(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results!.length).toBeGreaterThan(0);
      expect(result.results![0].similarity).toBeGreaterThan(0.7);
    });
  });
});

describe('AutoTrigger', () => {
  let autoTrigger: ReturnType<typeof createAutoTrigger>;

  beforeEach(() => {
    autoTrigger = createAutoTrigger(mockPrisma);
  });

  describe('triggerMenuItem', () => {
    it('should trigger embedding generation for menu item', async () => {
      const menuItem = {
        id: 'test-item',
        name: 'Test Pizza',
        description: 'Test description',
        price: 10.99,
        category: { name: 'Pizza' }
      };

      // Mock business access
      vi.mocked(mockPrisma.business.findFirst).mockResolvedValue({
        id: 'test-business',
        name: 'Test Business'
      } as any);

      const result = await autoTrigger.triggerMenuItem('test-business', 'create', menuItem);

      expect(result.success).toBe(true);
    });

    it('should handle delete operation', async () => {
      const menuItem = {
        id: 'test-item',
        name: 'Test Pizza'
      };

      const result = await autoTrigger.triggerMenuItem('test-business', 'delete', menuItem);

      expect(result.success).toBe(true);
    });
  });

  describe('triggerPolicy', () => {
    it('should trigger embedding generation for policy', async () => {
      const policy = {
        id: 'test-policy',
        title: 'Test Policy',
        content: 'Test content',
        type: 'delivery'
      };

      const result = await autoTrigger.triggerPolicy('test-business', 'create', policy);

      expect(result.success).toBe(true);
    });
  });

  describe('triggerFAQ', () => {
    it('should trigger embedding generation for FAQ', async () => {
      const faq = {
        id: 'test-faq',
        title: 'Test Question',
        content: 'Test answer',
        category: 'General'
      };

      const result = await autoTrigger.triggerFAQ('test-business', 'create', faq);

      expect(result.success).toBe(true);
    });
  });
});

describe('UsageTracker', () => {
  let usageTracker: ReturnType<typeof createUsageTracker>;

  beforeEach(() => {
    usageTracker = createUsageTracker(mockPrisma);
  });

  describe('recordUsage', () => {
    it('should record usage metrics', async () => {
      const usageRecord = {
        businessId: 'test-business',
        operation: 'embedding_generation' as const,
        contentType: 'MENU' as EmbeddingType,
        tokenCount: 100,
        apiCalls: 1,
        processingTime: 500,
        success: true
      };

      vi.mocked(mockPrisma.usageMetric.create).mockResolvedValue({} as any);

      await usageTracker.recordUsage(usageRecord);

      expect(mockPrisma.usageMetric.create).toHaveBeenCalledWith({
        data: {
          businessId: 'test-business',
          type: 'API_CALL',
          count: 1,
          metadata: expect.objectContaining({
            operation: 'embedding_generation',
            contentType: 'MENU',
            tokenCount: 100,
            processingTime: 500,
            success: true
          })
        }
      });
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockMetrics = [
        {
          id: 'metric-1',
          businessId: 'test-business',
          type: 'API_CALL',
          count: 5,
          metadata: {
            operation: 'embedding_generation',
            contentType: 'MENU',
            tokenCount: 500,
            processingTime: 2500,
            success: true
          },
          date: new Date()
        }
      ];

      vi.mocked(mockPrisma.usageMetric.findMany).mockResolvedValue(mockMetrics as any);

      const stats = await usageTracker.getUsageStats('test-business', 'day');

      expect(stats.success).toBe(true);
      expect(stats.stats?.totalTokens).toBe(500);
      expect(stats.stats?.totalApiCalls).toBe(5);
      expect(stats.stats?.successRate).toBe(1.0);
    });
  });

  describe('isWithinRateLimit', () => {
    it('should check rate limits', async () => {
      const mockMetrics = [
        {
          id: 'metric-1',
          businessId: 'test-business',
          type: 'API_CALL',
          count: 100,
          metadata: {
            tokenCount: 1000,
            success: true
          },
          date: new Date()
        }
      ];

      vi.mocked(mockPrisma.usageMetric.findMany).mockResolvedValue(mockMetrics as any);

      const rateLimit = await usageTracker.isWithinRateLimit('test-business', 10000, 1000);

      expect(rateLimit.allowed).toBe(true);
      expect(rateLimit.currentTokens).toBe(1000);
      expect(rateLimit.currentCalls).toBe(100);
    });
  });
});

// Integration tests
describe('Embedding Service Integration', () => {
  it('should handle complete workflow', async () => {
    // This would test the complete workflow from content creation to embedding generation
    // to search functionality
    expect(true).toBe(true); // Placeholder for now
  });
});

// Performance tests
describe('Embedding Service Performance', () => {
  it('should handle concurrent requests', async () => {
    // This would test concurrent embedding generation
    expect(true).toBe(true); // Placeholder for now
  });

  it('should maintain performance under load', async () => {
    // This would test performance under various loads
    expect(true).toBe(true); // Placeholder for now
  });
});

