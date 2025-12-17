// ===== SEARCH INTEGRATION TESTS =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SearchService } from '../lib/search-service';
import { ContextRetriever } from '../lib/context-retriever';
import { CacheManager } from '../lib/cache-manager';

// Mock Prisma client with more realistic data
const mockPrisma = {
  $queryRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
  embedding: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  queryLog: {
    findMany: vi.fn()
  },
  $disconnect: vi.fn()
} as any;

// Mock OpenAI client
vi.mock('../lib/openai-client', () => ({
  getOpenAIClient: () => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  })
}));

describe('Search Integration Tests', () => {
  let searchService: SearchService;
  let contextRetriever: ContextRetriever;
  let cacheManager: CacheManager;
  let mockEmbedding: number[];

  beforeEach(() => {
    searchService = new SearchService(mockPrisma);
    contextRetriever = new ContextRetriever(mockPrisma, searchService);
    cacheManager = new CacheManager(mockPrisma);
    mockEmbedding = new Array(1536).fill(0.1);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('End-to-End Search Flow', () => {
    it('should complete full search flow with caching', async () => {
      const mockSearchResults = [
        {
          id: 'embedding1',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu1',
          content: 'Delicious pepperoni pizza with mozzarella cheese',
          embedding: mockEmbedding,
          metadata: { 
            title: 'Pepperoni Pizza',
            price: 15.99,
            category: 'Pizza'
          },
          createdAt: new Date(),
          similarity: 0.92
        },
        {
          id: 'embedding2',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu2',
          content: 'Margherita pizza with fresh basil and tomatoes',
          embedding: mockEmbedding,
          metadata: { 
            title: 'Margherita Pizza',
            price: 14.99,
            category: 'Pizza'
          },
          createdAt: new Date(),
          similarity: 0.88
        }
      ];

      // Mock search service response
      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockSearchResults);

      // First search (cache miss)
      const cacheKey = cacheManager.generateSearchKey('business1', 'pizza', 'MENU', 3, 0.75);
      
      const result1 = await contextRetriever.retrieveContext('business1', {
        query: 'pizza',
        contentType: 'MENU',
        topN: 3,
        minScore: 0.75
      });

      expect(result1.success).toBe(true);
      expect(result1.data?.results).toHaveLength(2);
      expect(result1.data?.results[0].confidence).toBeGreaterThan(0.92);

      // Cache the results
      if (result1.data) {
        await cacheManager.setSearchResults(cacheKey, result1.data);
      }

      // Second search (cache hit)
      const cachedResults = await cacheManager.getSearchResults(cacheKey);
      expect(cachedResults).not.toBeNull();
      expect(cachedResults?.results).toHaveLength(2);
    });

    it('should handle tenant isolation correctly', async () => {
      const business1Results = [
        {
          id: 'embedding1',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu1',
          content: 'Business 1 pizza',
          embedding: mockEmbedding,
          metadata: {},
          createdAt: new Date(),
          similarity: 0.9
        }
      ];

      const business2Results = [
        {
          id: 'embedding2',
          businessId: 'business2',
          contentType: 'MENU',
          contentId: 'menu2',
          content: 'Business 2 burger',
          embedding: mockEmbedding,
          metadata: {},
          createdAt: new Date(),
          similarity: 0.9
        }
      ];

      // Mock different results for different businesses
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce(business1Results) // First call for business1
        .mockResolvedValueOnce(business2Results); // Second call for business2

      // Search for business1
      const result1 = await contextRetriever.retrieveContext('business1', {
        query: 'food',
        contentType: 'MENU'
      });

      // Search for business2
      const result2 = await contextRetriever.retrieveContext('business2', {
        query: 'food',
        contentType: 'MENU'
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.results[0].businessId).toBe('business1');
      expect(result2.data?.results[0].businessId).toBe('business2');
    });
  });

  describe('Performance Tests', () => {
    it('should complete search within acceptable time limits', async () => {
      const mockResults = Array.from({ length: 10 }, (_, i) => ({
        id: `embedding${i}`,
        businessId: 'business1',
        contentType: 'MENU',
        contentId: `menu${i}`,
        content: `Menu item ${i}`,
        embedding: mockEmbedding,
        metadata: {},
        createdAt: new Date(),
        similarity: 0.9 - (i * 0.01)
      }));

      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      const startTime = Date.now();
      
      const result = await contextRetriever.retrieveContext('business1', {
        query: 'menu items',
        contentType: 'MENU',
        topN: 10
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle large result sets efficiently', async () => {
      const mockResults = Array.from({ length: 100 }, (_, i) => ({
        id: `embedding${i}`,
        businessId: 'business1',
        contentType: 'MENU',
        contentId: `menu${i}`,
        content: `Menu item ${i} with detailed description`,
        embedding: mockEmbedding,
        metadata: { category: 'Food', price: 10 + i },
        createdAt: new Date(),
        similarity: 0.9 - (i * 0.001)
      }));

      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      const result = await contextRetriever.retrieveContext('business1', {
        query: 'menu',
        contentType: 'MENU',
        topN: 50
      });

      expect(result.success).toBe(true);
      expect(result.data?.results.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle OpenAI API failures gracefully', async () => {
      // Mock OpenAI failure
      const mockOpenAI = {
        embeddings: {
          create: vi.fn().mockRejectedValue(new Error('OpenAI API rate limit exceeded'))
        }
      };

      vi.doMock('../lib/openai-client', () => ({
        getOpenAIClient: () => mockOpenAI
      }));

      const result = await contextRetriever.retrieveContext('business1', {
        query: 'pizza',
        contentType: 'MENU'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RETRIEVAL_FAILED');
    });

    it('should handle database connection errors', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('Database connection lost'));

      const result = await contextRetriever.retrieveContext('business1', {
        query: 'pizza',
        contentType: 'MENU'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RETRIEVAL_FAILED');
    });

    it('should handle cache failures gracefully', async () => {
      // Mock cache failure
      const mockCache = {
        get: vi.fn().mockRejectedValue(new Error('Cache unavailable')),
        set: vi.fn().mockRejectedValue(new Error('Cache unavailable')),
        isAvailable: vi.fn().mockReturnValue(false)
      };

      const cacheManagerWithFailure = new CacheManager(mockPrisma);
      Object.assign(cacheManagerWithFailure, mockCache);

      const mockResults = [
        {
          id: 'embedding1',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu1',
          content: 'Pizza',
          embedding: mockEmbedding,
          metadata: {},
          createdAt: new Date(),
          similarity: 0.9
        }
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      // Should still work even with cache failure
      const result = await contextRetriever.retrieveContext('business1', {
        query: 'pizza',
        contentType: 'MENU'
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(1);
    });
  });

  describe('Combined Search', () => {
    it('should search across all content types', async () => {
      const mockResults = [
        {
          id: 'embedding1',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu1',
          content: 'Pizza menu item',
          embedding: mockEmbedding,
          metadata: {},
          createdAt: new Date(),
          similarity: 0.9
        },
        {
          id: 'embedding2',
          businessId: 'business1',
          contentType: 'FAQ',
          contentId: 'faq1',
          content: 'FAQ about pizza delivery',
          embedding: mockEmbedding,
          metadata: {},
          createdAt: new Date(),
          similarity: 0.85
        },
        {
          id: 'embedding3',
          businessId: 'business1',
          contentType: 'POLICY',
          contentId: 'policy1',
          content: 'Pizza delivery policy',
          embedding: mockEmbedding,
          metadata: {},
          createdAt: new Date(),
          similarity: 0.8
        }
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      const result = await contextRetriever.retrieveAllContext('business1', {
        query: 'pizza',
        topN: 5
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(3);
      
      const contentTypes = result.data?.results.map(r => r.contentType);
      expect(contentTypes).toContain('MENU');
      expect(contentTypes).toContain('FAQ');
      expect(contentTypes).toContain('POLICY');
    });

    it('should rank results by confidence score', async () => {
      const mockResults = [
        {
          id: 'embedding1',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu1',
          content: 'Pizza with pepperoni',
          embedding: mockEmbedding,
          metadata: { title: 'Pepperoni Pizza' },
          createdAt: new Date(),
          similarity: 0.8
        },
        {
          id: 'embedding2',
          businessId: 'business1',
          contentType: 'FAQ',
          contentId: 'faq1',
          content: 'FAQ about pizza',
          embedding: mockEmbedding,
          metadata: {},
          createdAt: new Date(),
          similarity: 0.9
        }
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      const result = await contextRetriever.retrieveAllContext('business1', {
        query: 'pizza',
        topN: 5
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(2);
      
      // Results should be sorted by confidence (highest first)
      const confidences = result.data?.results.map(r => r.confidence);
      expect(confidences?.[0]).toBeGreaterThanOrEqual(confidences?.[1] || 0);
    });
  });

  describe('Cache Performance', () => {
    it('should improve performance with cache hits', async () => {
      const mockResults = [
        {
          id: 'embedding1',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu1',
          content: 'Pizza',
          embedding: mockEmbedding,
          metadata: {},
          createdAt: new Date(),
          similarity: 0.9
        }
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      // First search (cache miss)
      const start1 = Date.now();
      const result1 = await contextRetriever.retrieveContext('business1', {
        query: 'pizza',
        contentType: 'MENU'
      });
      const time1 = Date.now() - start1;

      // Cache the result
      if (result1.data) {
        const cacheKey = cacheManager.generateSearchKey('business1', 'pizza', 'MENU');
        await cacheManager.setSearchResults(cacheKey, result1.data);
      }

      // Second search (cache hit)
      const start2 = Date.now();
      const cachedResult = await cacheManager.getSearchResults(
        cacheManager.generateSearchKey('business1', 'pizza', 'MENU')
      );
      const time2 = Date.now() - start2;

      expect(result1.success).toBe(true);
      expect(cachedResult).not.toBeNull();
      expect(time2).toBeLessThan(time1); // Cache should be faster
    });
  });
});

