// ===== SEARCH SERVICE TESTS =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SearchService } from '../lib/search-service';
import { ContextRetriever } from '../lib/context-retriever';
import { CacheManager } from '../lib/cache-manager';

// Mock Prisma client
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

describe('SearchService', () => {
  let searchService: SearchService;
  let mockEmbedding: number[];

  beforeEach(() => {
    searchService = new SearchService(mockPrisma);
    mockEmbedding = new Array(1536).fill(0.1);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('searchSimilar', () => {
    it('should perform vector similarity search successfully', async () => {
      const mockResults = [
        {
          id: 'embedding1',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu1',
          content: 'Delicious pizza with pepperoni',
          embedding: mockEmbedding,
          metadata: { price: 15.99 },
          createdAt: new Date(),
          similarity: 0.85
        }
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      const result = await searchService.searchSimilar('business1', mockEmbedding, {
        query: 'pizza',
        contentType: 'MENU',
        limit: 3,
        threshold: 0.75
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(1);
      expect(result.data?.results[0].similarity).toBe(0.85);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
    });

    it('should handle invalid embedding dimension', async () => {
      const invalidEmbedding = new Array(100).fill(0.1); // Wrong dimension

      const result = await searchService.searchSimilar('business1', invalidEmbedding, {
        query: 'pizza',
        contentType: 'MENU'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SEARCH_FAILED');
    });

    it('should enforce tenant isolation', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.searchSimilar('business1', mockEmbedding, {
        query: 'pizza',
        contentType: 'MENU'
      });

      const queryCall = mockPrisma.$queryRawUnsafe.mock.calls[0][0];
      expect(queryCall).toContain("e.business_id = 'business1'");
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('Database error'));

      const result = await searchService.searchSimilar('business1', mockEmbedding, {
        query: 'pizza',
        contentType: 'MENU'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SEARCH_FAILED');
    });
  });

  describe('searchAll', () => {
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
          similarity: 0.85
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
          similarity: 0.80
        }
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValue(mockResults);

      const result = await searchService.searchAll('business1', mockEmbedding, {
        query: 'pizza',
        limit: 5,
        threshold: 0.75
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(2);
      expect(result.data?.results[0].contentType).toBe('MENU');
      expect(result.data?.results[1].contentType).toBe('FAQ');
    });
  });

  describe('getSearchStats', () => {
    it('should return search statistics', async () => {
      mockPrisma.embedding.count.mockResolvedValue(100);
      mockPrisma.embedding.groupBy.mockResolvedValue([
        { contentType: 'MENU', _count: { contentType: 50 } },
        { contentType: 'FAQ', _count: { contentType: 30 } },
        { contentType: 'POLICY', _count: { contentType: 20 } }
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([{ avg_similarity: 0.8 }]);

      const stats = await searchService.getSearchStats('business1');

      expect(stats.totalEmbeddings).toBe(100);
      expect(stats.byContentType.MENU).toBe(50);
      expect(stats.byContentType.FAQ).toBe(30);
      expect(stats.byContentType.POLICY).toBe(20);
      expect(stats.averageSimilarity).toBe(0.8);
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration correctly', () => {
      const validation = searchService.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidService = new SearchService(mockPrisma, {
        topN: 0, // Invalid
        minScore: 1.5, // Invalid
        maxResults: 0 // Invalid
      });

      const validation = invalidService.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('ContextRetriever', () => {
  let contextRetriever: ContextRetriever;
  let mockSearchService: any;

  beforeEach(() => {
    mockSearchService = {
      searchSimilar: vi.fn(),
      searchAll: vi.fn(),
      getSearchStats: vi.fn()
    };

    contextRetriever = new ContextRetriever(mockPrisma, mockSearchService);
    vi.clearAllMocks();
  });

  describe('retrieveContext', () => {
    it('should retrieve context with confidence scoring', async () => {
      const mockSearchResults = [
        {
          id: 'embedding1',
          businessId: 'business1',
          contentType: 'MENU',
          contentId: 'menu1',
          content: 'Delicious pizza with pepperoni and cheese',
          similarity: 0.85,
          score: 0.85,
          metadata: { title: 'Pepperoni Pizza' },
          createdAt: new Date()
        }
      ];

      mockSearchService.searchSimilar.mockResolvedValue({
        success: true,
        data: { results: mockSearchResults }
      });

      const result = await contextRetriever.retrieveContext('business1', {
        query: 'pizza',
        contentType: 'MENU'
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(1);
      expect(result.data?.results[0].confidence).toBeGreaterThan(0.85); // Should be boosted
      expect(result.data?.results[0].textSnippet).toContain('pizza');
    });

    it('should handle empty query', async () => {
      const result = await contextRetriever.retrieveContext('business1', {
        query: '',
        contentType: 'MENU'
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RETRIEVAL_FAILED');
    });

    it('should handle OpenAI API failures', async () => {
      // Mock OpenAI failure
      const mockOpenAI = {
        embeddings: {
          create: vi.fn().mockRejectedValue(new Error('OpenAI API error'))
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
  });

  describe('calculateConfidence', () => {
    it('should boost confidence for exact matches', () => {
      const result = {
        id: 'embedding1',
        businessId: 'business1',
        contentType: 'MENU',
        contentId: 'menu1',
        content: 'Delicious pizza with pepperoni',
        similarity: 0.8,
        score: 0.8,
        metadata: { title: 'Pepperoni Pizza' },
        createdAt: new Date()
      };

      // Access private method through any type
      const confidence = (contextRetriever as any).calculateConfidence(result, 'pizza');
      expect(confidence).toBeGreaterThan(0.8); // Should be boosted
    });

    it('should boost confidence for title matches', () => {
      const result = {
        id: 'embedding1',
        businessId: 'business1',
        contentType: 'MENU',
        contentId: 'menu1',
        content: 'Delicious food',
        similarity: 0.8,
        score: 0.8,
        metadata: { title: 'Pepperoni Pizza' },
        createdAt: new Date()
      };

      const confidence = (contextRetriever as any).calculateConfidence(result, 'pizza');
      expect(confidence).toBeGreaterThan(0.8); // Should be boosted for title match
    });
  });

  describe('generateTextSnippet', () => {
    it('should generate appropriate text snippets', () => {
      const content = 'This is a very long piece of content that should be truncated when generating a snippet for display purposes.';
      const query = 'long piece';
      
      const snippet = (contextRetriever as any).generateTextSnippet(content, query, 50);
      expect(snippet.length).toBeLessThanOrEqual(50 + 6); // 50 chars + "..."
      expect(snippet).toContain('long piece');
    });

    it('should return full content if shorter than max length', () => {
      const content = 'Short content';
      const query = 'content';
      
      const snippet = (contextRetriever as any).generateTextSnippet(content, query, 50);
      expect(snippet).toBe(content);
    });
  });
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager(mockPrisma);
    vi.clearAllMocks();
  });

  describe('Memory Cache', () => {
    it('should store and retrieve cached results', async () => {
      const testData = { results: [], total: 0 };
      const cacheKey = 'test-key';

      await cacheManager.setSearchResults(cacheKey, testData);
      const retrieved = await cacheManager.getSearchResults(cacheKey);

      expect(retrieved).toEqual(testData);
    });

    it('should handle cache expiration', async () => {
      const testData = { results: [], total: 0 };
      const cacheKey = 'test-key';

      // Set with very short TTL
      await cacheManager.setSearchResults(cacheKey, testData, 0.001);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const retrieved = await cacheManager.getSearchResults(cacheKey);
      expect(retrieved).toBeNull();
    });

    it('should generate consistent cache keys', () => {
      const key1 = cacheManager.generateSearchKey('business1', 'pizza', 'MENU', 3, 0.75);
      const key2 = cacheManager.generateSearchKey('business1', 'pizza', 'MENU', 3, 0.75);
      
      expect(key1).toBe(key2);
    });

    it('should provide cache statistics', () => {
      const stats = cacheManager.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate content cache', async () => {
      const testData = { results: [], total: 0 };
      const cacheKey = 'search:business1:menu:item1';
      
      await cacheManager.setSearchResults(cacheKey, testData);
      await cacheManager.invalidateContent('business1', 'MENU', 'item1');
      
      const retrieved = await cacheManager.getSearchResults(cacheKey);
      expect(retrieved).toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate cache configuration', () => {
      const validation = cacheManager.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid cache configuration', () => {
      const invalidCache = new CacheManager(mockPrisma, {
        provider: 'invalid' as any,
        ttl: -1,
        maxSize: 0
      });

      const validation = invalidCache.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});

