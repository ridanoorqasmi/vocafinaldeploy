// ===== SEARCH API TESTS =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as menuSearchPOST } from '../app/api/search/menu/route';
import { POST as policiesSearchPOST } from '../app/api/search/policies/route';
import { POST as faqsSearchPOST } from '../app/api/search/faqs/route';
import { POST as allSearchPOST } from '../app/api/search/all/route';
import { GET as statsGET } from '../app/api/search/stats/route';

// Mock dependencies
vi.mock('../lib/auth-middleware', () => ({
  validateBusinessAuth: vi.fn()
}));

vi.mock('../lib/context-retriever', () => ({
  getContextRetriever: vi.fn(() => ({
    retrieveContext: vi.fn(),
    retrieveAllContext: vi.fn(),
    getRetrievalStats: vi.fn()
  }))
}));

vi.mock('../lib/cache-manager', () => ({
  getCacheManager: vi.fn(() => ({
    generateSearchKey: vi.fn(),
    getSearchResults: vi.fn(),
    setSearchResults: vi.fn(),
    isAvailable: vi.fn(() => true)
  }))
}));

vi.mock('../lib/search-service', () => ({
  getSearchService: vi.fn(() => ({
    getSearchStats: vi.fn()
  }))
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $disconnect: vi.fn(),
    queryLog: {
      findMany: vi.fn()
    }
  }))
}));

describe('Search API Endpoints', () => {
  let mockRequest: NextRequest;
  let mockAuthResult: any;
  let mockContextRetriever: any;
  let mockCacheManager: any;

  beforeEach(() => {
    mockRequest = {
      json: vi.fn(),
      headers: new Headers()
    } as any;

    mockAuthResult = {
      success: true,
      businessId: 'business1'
    };

    mockContextRetriever = {
      retrieveContext: vi.fn(),
      retrieveAllContext: vi.fn(),
      getRetrievalStats: vi.fn()
    };

    mockCacheManager = {
      generateSearchKey: vi.fn(() => 'cache-key'),
      getSearchResults: vi.fn(),
      setSearchResults: vi.fn(),
      isAvailable: vi.fn(() => true)
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Menu Search API', () => {
    it('should handle successful menu search', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getContextRetriever } = await import('../lib/context-retriever');
      const { getCacheManager } = await import('../lib/cache-manager');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getContextRetriever as any).mockReturnValue(mockContextRetriever);
      (getCacheManager as any).mockReturnValue(mockCacheManager);

      (mockRequest.json as any).mockResolvedValue({
        query: 'pizza',
        topN: 3,
        minScore: 0.75
      });

      mockCacheManager.getSearchResults.mockResolvedValue(null);
      mockContextRetriever.retrieveContext.mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              id: 'embedding1',
              businessId: 'business1',
              contentType: 'MENU',
              contentId: 'menu1',
              content: 'Pepperoni Pizza',
              similarity: 0.9,
              confidence: 0.95,
              score: 0.9,
              textSnippet: 'Pepperoni Pizza',
              createdAt: new Date()
            }
          ],
          total: 1,
          query: 'pizza',
          contentType: 'MENU',
          averageConfidence: 0.95,
          retrievalTime: 150
        }
      });

      const response = await menuSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.results).toHaveLength(1);
      expect(responseData.data.results[0].contentType).toBe('MENU');
    });

    it('should handle authentication failure', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      
      (validateBusinessAuth as any).mockResolvedValue({
        success: false,
        error: 'Invalid token'
      });

      (mockRequest.json as any).mockResolvedValue({
        query: 'pizza'
      });

      const response = await menuSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle invalid request parameters', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      
      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);

      (mockRequest.json as any).mockResolvedValue({
        query: '', // Invalid empty query
        topN: 100 // Invalid topN
      });

      const response = await menuSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('INVALID_REQUEST');
    });

    it('should return cached results when available', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getContextRetriever } = await import('../lib/context-retriever');
      const { getCacheManager } = await import('../lib/cache-manager');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getContextRetriever as any).mockReturnValue(mockContextRetriever);
      (getCacheManager as any).mockReturnValue(mockCacheManager);

      (mockRequest.json as any).mockResolvedValue({
        query: 'pizza'
      });

      const cachedData = {
        results: [{ id: 'cached1', contentType: 'MENU' }],
        total: 1,
        query: 'pizza'
      };

      mockCacheManager.getSearchResults.mockResolvedValue(cachedData);

      const response = await menuSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.cached).toBe(true);
      expect(responseData.data.cacheHit).toBe(true);
    });
  });

  describe('Policies Search API', () => {
    it('should handle successful policies search', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getContextRetriever } = await import('../lib/context-retriever');
      const { getCacheManager } = await import('../lib/cache-manager');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getContextRetriever as any).mockReturnValue(mockContextRetriever);
      (getCacheManager as any).mockReturnValue(mockCacheManager);

      (mockRequest.json as any).mockResolvedValue({
        query: 'delivery policy'
      });

      mockCacheManager.getSearchResults.mockResolvedValue(null);
      mockContextRetriever.retrieveContext.mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              id: 'embedding1',
              businessId: 'business1',
              contentType: 'POLICY',
              contentId: 'policy1',
              content: 'Delivery Policy',
              similarity: 0.9,
              confidence: 0.95,
              score: 0.9,
              textSnippet: 'Delivery Policy',
              createdAt: new Date()
            }
          ],
          total: 1,
          query: 'delivery policy',
          contentType: 'POLICY',
          averageConfidence: 0.95,
          retrievalTime: 120
        }
      });

      const response = await policiesSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.results[0].contentType).toBe('POLICY');
    });
  });

  describe('FAQs Search API', () => {
    it('should handle successful FAQs search', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getContextRetriever } = await import('../lib/context-retriever');
      const { getCacheManager } = await import('../lib/cache-manager');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getContextRetriever as any).mockReturnValue(mockContextRetriever);
      (getCacheManager as any).mockReturnValue(mockCacheManager);

      (mockRequest.json as any).mockResolvedValue({
        query: 'how to order'
      });

      mockCacheManager.getSearchResults.mockResolvedValue(null);
      mockContextRetriever.retrieveContext.mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              id: 'embedding1',
              businessId: 'business1',
              contentType: 'FAQ',
              contentId: 'faq1',
              content: 'How to place an order',
              similarity: 0.9,
              confidence: 0.95,
              score: 0.9,
              textSnippet: 'How to place an order',
              createdAt: new Date()
            }
          ],
          total: 1,
          query: 'how to order',
          contentType: 'FAQ',
          averageConfidence: 0.95,
          retrievalTime: 100
        }
      });

      const response = await faqsSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.results[0].contentType).toBe('FAQ');
    });
  });

  describe('Combined Search API', () => {
    it('should handle successful combined search', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getContextRetriever } = await import('../lib/context-retriever');
      const { getCacheManager } = await import('../lib/cache-manager');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getContextRetriever as any).mockReturnValue(mockContextRetriever);
      (getCacheManager as any).mockReturnValue(mockCacheManager);

      (mockRequest.json as any).mockResolvedValue({
        query: 'pizza',
        contentTypes: ['MENU', 'FAQ']
      });

      mockCacheManager.getSearchResults.mockResolvedValue(null);
      mockContextRetriever.retrieveAllContext.mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              id: 'embedding1',
              businessId: 'business1',
              contentType: 'MENU',
              contentId: 'menu1',
              content: 'Pizza menu',
              similarity: 0.9,
              confidence: 0.95,
              score: 0.9,
              textSnippet: 'Pizza menu',
              createdAt: new Date()
            },
            {
              id: 'embedding2',
              businessId: 'business1',
              contentType: 'FAQ',
              contentId: 'faq1',
              content: 'Pizza FAQ',
              similarity: 0.8,
              confidence: 0.85,
              score: 0.8,
              textSnippet: 'Pizza FAQ',
              createdAt: new Date()
            }
          ],
          total: 2,
          query: 'pizza',
          averageConfidence: 0.9,
          retrievalTime: 200
        }
      });

      const response = await allSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.results).toHaveLength(2);
      expect(responseData.data.stats.totalResults).toBe(2);
      expect(responseData.data.stats.byContentType.MENU).toBe(1);
      expect(responseData.data.stats.byContentType.FAQ).toBe(1);
    });

    it('should filter results by content types', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getContextRetriever } = await import('../lib/context-retriever');
      const { getCacheManager } = await import('../lib/cache-manager');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getContextRetriever as any).mockReturnValue(mockContextRetriever);
      (getCacheManager as any).mockReturnValue(mockCacheManager);

      (mockRequest.json as any).mockResolvedValue({
        query: 'pizza',
        contentTypes: ['MENU'] // Only MENU type
      });

      mockCacheManager.getSearchResults.mockResolvedValue(null);
      mockContextRetriever.retrieveAllContext.mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              id: 'embedding1',
              businessId: 'business1',
              contentType: 'MENU',
              contentId: 'menu1',
              content: 'Pizza menu',
              similarity: 0.9,
              confidence: 0.95,
              score: 0.9,
              textSnippet: 'Pizza menu',
              createdAt: new Date()
            },
            {
              id: 'embedding2',
              businessId: 'business1',
              contentType: 'FAQ',
              contentId: 'faq1',
              content: 'Pizza FAQ',
              similarity: 0.8,
              confidence: 0.85,
              score: 0.8,
              textSnippet: 'Pizza FAQ',
              createdAt: new Date()
            }
          ],
          total: 2,
          query: 'pizza',
          averageConfidence: 0.9,
          retrievalTime: 200
        }
      });

      const response = await allSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.results).toHaveLength(1); // Filtered to only MENU
      expect(responseData.data.results[0].contentType).toBe('MENU');
    });
  });

  describe('Search Stats API', () => {
    it('should return search statistics', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getContextRetriever } = await import('../lib/context-retriever');
      const { getCacheManager } = await import('../lib/cache-manager');
      const { getSearchService } = await import('../lib/search-service');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getContextRetriever as any).mockReturnValue(mockContextRetriever);
      (getCacheManager as any).mockReturnValue(mockCacheManager);
      (getSearchService as any).mockReturnValue({
        getSearchStats: vi.fn().mockResolvedValue({
          totalEmbeddings: 100,
          byContentType: { MENU: 50, FAQ: 30, POLICY: 20, BUSINESS: 0 },
          averageSimilarity: 0.8
        })
      });

      mockContextRetriever.getRetrievalStats.mockResolvedValue({
        totalEmbeddings: 100,
        averageConfidence: 0.8,
        byContentType: { MENU: 50, FAQ: 30, POLICY: 20, BUSINESS: 0 }
      });

      mockCacheManager.getStats.mockReturnValue({
        hits: 50,
        misses: 20,
        size: 30,
        maxSize: 1000,
        hitRate: 0.71,
        evictions: 5
      });

      const mockPrisma = {
        $disconnect: vi.fn(),
        queryLog: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'log1',
              query: 'pizza search',
              status: 'SUCCESS',
              responseTime: 150,
              createdAt: new Date()
            }
          ])
        }
      };

      vi.doMock('@prisma/client', () => ({
        PrismaClient: vi.fn(() => mockPrisma)
      }));

      const response = await statsGET(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.retrieval.totalEmbeddings).toBe(100);
      expect(responseData.data.cache.hitRate).toBe(0.71);
      expect(responseData.data.performance.totalSearches24h).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      
      (validateBusinessAuth as any).mockRejectedValue(new Error('Database connection failed'));

      (mockRequest.json as any).mockResolvedValue({
        query: 'pizza'
      });

      const response = await menuSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle search service failures', async () => {
      const { validateBusinessAuth } = await import('../lib/auth-middleware');
      const { getContextRetriever } = await import('../lib/context-retriever');
      const { getCacheManager } = await import('../lib/cache-manager');

      (validateBusinessAuth as any).mockResolvedValue(mockAuthResult);
      (getContextRetriever as any).mockReturnValue(mockContextRetriever);
      (getCacheManager as any).mockReturnValue(mockCacheManager);

      (mockRequest.json as any).mockResolvedValue({
        query: 'pizza'
      });

      mockCacheManager.getSearchResults.mockResolvedValue(null);
      mockContextRetriever.retrieveContext.mockResolvedValue({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Search service unavailable'
        }
      });

      const response = await menuSearchPOST(mockRequest);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('SEARCH_FAILED');
    });
  });
});

