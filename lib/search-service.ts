// ===== VECTOR SEARCH SERVICE =====

import { PrismaClient, Embedding as PrismaEmbedding, EmbeddingType } from '@prisma/client';
import { Embedding, EmbeddingSearchRequest, EmbeddingSearchResult } from './embedding-types';

export interface VectorSearchConfig {
  topN: number;
  minScore: number;
  maxResults: number;
}

export interface SearchResult {
  id: string;
  businessId: string;
  contentType: EmbeddingType;
  contentId: string;
  content: string;
  similarity: number;
  score: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface SearchResponse {
  success: boolean;
  data?: {
    results: SearchResult[];
    total: number;
    query: string;
    contentType?: EmbeddingType;
    searchTime: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class SearchService {
  private prisma: PrismaClient;
  private config: VectorSearchConfig;

  constructor(prisma: PrismaClient, config?: Partial<VectorSearchConfig>) {
    this.prisma = prisma;
    this.config = {
      topN: parseInt(process.env.VECTOR_SEARCH_TOPN || '3'),
      minScore: parseFloat(process.env.VECTOR_SEARCH_MINSCORE || '0.75'),
      maxResults: 100,
      ...config
    };
  }

  /**
   * Perform vector similarity search using cosine similarity
   */
  async searchSimilar(
    businessId: string,
    queryEmbedding: number[],
    request: EmbeddingSearchRequest
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      const {
        contentType,
        limit = this.config.topN,
        threshold = this.config.minScore
      } = request;

      // Validate embedding dimension
      if (queryEmbedding.length !== 1536) {
        throw new Error('Query embedding must have 1536 dimensions');
      }

      // Build the search query with tenant isolation
      const whereClause = this.buildWhereClause(businessId, contentType);
      
      // Use raw SQL for vector similarity search with pgvector
      const searchQuery = `
        SELECT 
          e.id,
          e.business_id as "businessId",
          e.content_type as "contentType",
          e.content_id as "contentId",
          e.content,
          e.embedding,
          e.metadata,
          e.created_at as "createdAt",
          (1 - (e.embedding <=> $1::vector)) as similarity
        FROM embeddings e
        WHERE ${whereClause}
        AND e.deleted_at IS NULL
        AND (1 - (e.embedding <=> $1::vector)) >= $2
        ORDER BY e.embedding <=> $1::vector
        LIMIT $3
      `;

      const queryParams = [
        `[${queryEmbedding.join(',')}]`, // Vector parameter
        threshold, // Similarity threshold
        Math.min(limit, this.config.maxResults) // Limit
      ];

      const results = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        businessId: string;
        contentType: EmbeddingType;
        contentId: string;
        content: string;
        embedding: number[];
        metadata: any;
        createdAt: Date;
        similarity: number;
      }>>(searchQuery, ...queryParams);

      // Transform results to SearchResult format
      const searchResults: SearchResult[] = results.map(row => ({
        id: row.id,
        businessId: row.businessId,
        contentType: row.contentType,
        contentId: row.contentId,
        content: row.content,
        similarity: parseFloat(row.similarity.toString()),
        score: parseFloat(row.similarity.toString()),
        metadata: row.metadata || {},
        createdAt: row.createdAt
      }));

      const searchTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          results: searchResults,
          total: searchResults.length,
          query: request.query,
          contentType,
          searchTime
        }
      };

    } catch (error) {
      console.error('Vector search error:', error);
      return {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Unknown search error',
          details: error
        }
      };
    }
  }

  /**
   * Search across all content types for a business
   */
  async searchAll(
    businessId: string,
    queryEmbedding: number[],
    request: Omit<EmbeddingSearchRequest, 'contentType'>
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      const {
        limit = this.config.topN,
        threshold = this.config.minScore
      } = request;

      // Validate embedding dimension
      if (queryEmbedding.length !== 1536) {
        throw new Error('Query embedding must have 1536 dimensions');
      }

      // Search across all content types
      const searchQuery = `
        SELECT 
          e.id,
          e.business_id as "businessId",
          e.content_type as "contentType",
          e.content_id as "contentId",
          e.content,
          e.embedding,
          e.metadata,
          e.created_at as "createdAt",
          (1 - (e.embedding <=> $1::vector)) as similarity
        FROM embeddings e
        WHERE e.business_id = $4
        AND e.deleted_at IS NULL
        AND (1 - (e.embedding <=> $1::vector)) >= $2
        ORDER BY e.embedding <=> $1::vector
        LIMIT $3
      `;

      const queryParams = [
        `[${queryEmbedding.join(',')}]`, // Vector parameter
        threshold, // Similarity threshold
        Math.min(limit, this.config.maxResults), // Limit
        businessId // Business ID for tenant isolation
      ];

      const results = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        businessId: string;
        contentType: EmbeddingType;
        contentId: string;
        content: string;
        embedding: number[];
        metadata: any;
        createdAt: Date;
        similarity: number;
      }>>(searchQuery, ...queryParams);

      // Transform results to SearchResult format
      const searchResults: SearchResult[] = results.map(row => ({
        id: row.id,
        businessId: row.businessId,
        contentType: row.contentType,
        contentId: row.contentId,
        content: row.content,
        similarity: parseFloat(row.similarity.toString()),
        score: parseFloat(row.similarity.toString()),
        metadata: row.metadata || {},
        createdAt: row.createdAt
      }));

      const searchTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          results: searchResults,
          total: searchResults.length,
          query: request.query,
          searchTime
        }
      };

    } catch (error) {
      console.error('Vector search error:', error);
      return {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Unknown search error',
          details: error
        }
      };
    }
  }

  /**
   * Get search statistics for a business
   */
  async getSearchStats(businessId: string): Promise<{
    totalEmbeddings: number;
    byContentType: Record<EmbeddingType, number>;
    averageSimilarity: number;
  }> {
    try {
      const [total, byType, avgSimilarity] = await Promise.all([
        this.prisma.embedding.count({
          where: { businessId, deletedAt: null }
        }),
        this.prisma.embedding.groupBy({
          by: ['contentType'],
          where: { businessId, deletedAt: null },
          _count: { contentType: true }
        }),
        this.prisma.$queryRaw<Array<{ avg_similarity: number }>>`
          SELECT AVG(1.0) as avg_similarity
          FROM embeddings 
          WHERE business_id = ${businessId} 
          AND deleted_at IS NULL
        `
      ]);

      const byTypeMap: Record<EmbeddingType, number> = {
        MENU: 0,
        POLICY: 0,
        FAQ: 0,
        BUSINESS: 0
      };

      byType.forEach(item => {
        byTypeMap[item.contentType] = item._count.contentType;
      });

      return {
        totalEmbeddings: total,
        byContentType: byTypeMap,
        averageSimilarity: avgSimilarity[0]?.avg_similarity || 0
      };

    } catch (error) {
      console.error('Error getting search stats:', error);
      throw new Error('Failed to get search statistics');
    }
  }

  /**
   * Validate search configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.topN < 1 || this.config.topN > 100) {
      errors.push('topN must be between 1 and 100');
    }

    if (this.config.minScore < 0 || this.config.minScore > 1) {
      errors.push('minScore must be between 0 and 1');
    }

    if (this.config.maxResults < 1 || this.config.maxResults > 1000) {
      errors.push('maxResults must be between 1 and 1000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Build WHERE clause for tenant isolation
   */
  private buildWhereClause(businessId: string, contentType?: EmbeddingType): string {
    let whereClause = `e.business_id = '${businessId}'`;
    
    if (contentType) {
      whereClause += ` AND e.content_type = '${contentType}'`;
    }
    
    return whereClause;
  }

  /**
   * Calculate cosine similarity between two vectors
   * Fallback method if pgvector is not available
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ===== SINGLETON INSTANCE =====
let searchServiceInstance: SearchService | null = null;

export function getSearchService(prisma?: PrismaClient, config?: Partial<VectorSearchConfig>): SearchService {
  if (!searchServiceInstance) {
    if (!prisma) {
      throw new Error('PrismaClient instance is required for first initialization');
    }
    searchServiceInstance = new SearchService(prisma, config);
  }
  return searchServiceInstance;
}

