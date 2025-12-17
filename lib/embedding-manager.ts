// ===== EMBEDDING MANAGER - DATABASE OPERATIONS AND CACHING =====

import { PrismaClient } from '@prisma/client';
import { EmbeddingService } from './embedding-service';
import { EmbeddingGenerator, EmbeddingGenerationRequest, EmbeddingGenerationResult } from './embedding-generator';
import { ContentProcessor, ProcessedContent } from './content-processor';
import { EmbeddingType, EMBEDDING_ERRORS } from './embedding-types';
import { calculateSimilarityScore } from './openai-client';

// Embedding manager interfaces
export interface EmbeddingManagerResult {
  success: boolean;
  embedding?: {
    id: string;
    businessId: string;
    contentType: EmbeddingType;
    contentId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface EmbeddingSearchRequest {
  businessId: string;
  query: string;
  contentType?: EmbeddingType;
  limit?: number;
  threshold?: number;
}

export interface EmbeddingSearchResult {
  embedding: {
    id: string;
    businessId: string;
    contentType: EmbeddingType;
    contentId: string;
    content: string;
    metadata?: Record<string, any>;
  };
  similarity: number;
  score: number;
}

export interface EmbeddingSearchResponse {
  success: boolean;
  results?: EmbeddingSearchResult[];
  total?: number;
  query?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Embedding manager service
export class EmbeddingManager {
  private embeddingService: EmbeddingService;
  private embeddingGenerator: EmbeddingGenerator;
  private cache = new Map<string, any>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  constructor(prisma: PrismaClient) {
    this.embeddingService = new EmbeddingService(prisma);
    this.embeddingGenerator = EmbeddingGenerator.getInstance();
  }
  
  /**
   * Create or update embedding for content
   */
  async createOrUpdateEmbedding(request: EmbeddingGenerationRequest): Promise<EmbeddingManagerResult> {
    try {
      // Check if embedding already exists
      const existing = await this.embeddingService.getEmbeddingByContent(
        request.businessId,
        request.contentType,
        request.contentId
      );
      
      // Generate new embedding
      const generationResult = await this.embeddingGenerator.generateEmbedding(request);
      
      if (!generationResult.success) {
        return {
          success: false,
          error: {
            code: generationResult.error?.code || 'GENERATION_FAILED',
            message: generationResult.error?.message || 'Failed to generate embedding',
            details: generationResult.error?.details
          }
        };
      }
      
      const { embedding, processedContent } = generationResult;
      
      if (existing) {
        // Update existing embedding
        const updated = await this.embeddingService.updateEmbedding(
          request.businessId,
          existing.id,
          {
            content: processedContent!.text,
            embedding: embedding!,
            metadata: {
              ...existing.metadata,
              ...processedContent!.metadata,
              lastGenerated: new Date().toISOString(),
              tokenCount: generationResult.metadata?.tokenCount
            }
          }
        );
        
        // Clear cache
        this.clearCacheForBusiness(request.businessId);
        
        return {
          success: true,
          embedding: {
            id: updated.id,
            businessId: updated.businessId,
            contentType: updated.contentType,
            contentId: updated.contentId,
            content: updated.content,
            embedding: updated.embedding,
            metadata: updated.metadata,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt
          }
        };
      } else {
        // Create new embedding
        const created = await this.embeddingService.createEmbedding(request.businessId, {
          contentType: request.contentType,
          contentId: request.contentId,
          content: processedContent!.text,
          embedding: embedding!,
          metadata: {
            ...processedContent!.metadata,
            lastGenerated: new Date().toISOString(),
            tokenCount: generationResult.metadata?.tokenCount
          }
        });
        
        // Clear cache
        this.clearCacheForBusiness(request.businessId);
        
        return {
          success: true,
          embedding: {
            id: created.id,
            businessId: created.businessId,
            contentType: created.contentType,
            contentId: created.contentId,
            content: created.content,
            embedding: created.embedding,
            metadata: created.metadata,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt
          }
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error instanceof Error ? error.message : 'Database operation failed',
          details: error
        }
      };
    }
  }
  
  /**
   * Delete embedding for content
   */
  async deleteEmbedding(
    businessId: string,
    contentType: EmbeddingType,
    contentId: string
  ): Promise<EmbeddingManagerResult> {
    try {
      const deleted = await this.embeddingService.deleteEmbeddingsByContent(
        businessId,
        contentType,
        contentId
      );
      
      if (deleted > 0) {
        // Clear cache
        this.clearCacheForBusiness(businessId);
        
        return {
          success: true
        };
      } else {
        return {
          success: false,
          error: {
            code: EMBEDDING_ERRORS.EMBEDDING_NOT_FOUND,
            message: 'Embedding not found'
          }
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error instanceof Error ? error.message : 'Database operation failed',
          details: error
        }
      };
    }
  }
  
  /**
   * Search embeddings by similarity
   */
  async searchEmbeddings(request: EmbeddingSearchRequest): Promise<EmbeddingSearchResponse> {
    try {
      const {
        businessId,
        query,
        contentType,
        limit = 10,
        threshold = 0.7
      } = request;
      
      // Generate query embedding
      const queryResult = await this.embeddingGenerator.generateQueryEmbedding(query);
      
      if (!queryResult.success || !queryResult.embedding) {
        return {
          success: false,
          error: {
            code: queryResult.error?.code || 'QUERY_GENERATION_FAILED',
            message: queryResult.error?.message || 'Failed to generate query embedding',
            details: queryResult.error?.details
          }
        };
      }
      
      // Get all embeddings for the business (with optional content type filter)
      const embeddings = await this.embeddingService.listEmbeddings(businessId, {
        contentType,
        limit: 1000, // Get more for better search results
        includeDeleted: false
      });
      
      // Calculate similarities
      const results: EmbeddingSearchResult[] = [];
      
      for (const embedding of embeddings.embeddings) {
        const similarity = calculateSimilarityScore(queryResult.embedding, embedding.embedding);
        
        if (similarity >= threshold) {
          results.push({
            embedding: {
              id: embedding.id,
              businessId: embedding.businessId,
              contentType: embedding.contentType,
              contentId: embedding.contentId,
              content: embedding.content,
              metadata: embedding.metadata
            },
            similarity,
            score: similarity
          });
        }
      }
      
      // Sort by similarity (highest first) and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      const limitedResults = results.slice(0, limit);
      
      return {
        success: true,
        results: limitedResults,
        total: limitedResults.length,
        query
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: error instanceof Error ? error.message : 'Search operation failed',
          details: error
        }
      };
    }
  }
  
  /**
   * Get embedding statistics for a business
   */
  async getEmbeddingStats(businessId: string): Promise<{
    success: boolean;
    stats?: {
      total: number;
      byType: Record<EmbeddingType, number>;
      recent: number;
    };
    error?: {
      code: string;
      message: string;
    };
  }> {
    try {
      const stats = await this.embeddingService.getEmbeddingStats(businessId);
      
      return {
        success: true,
        stats
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get statistics'
        }
      };
    }
  }
  
  /**
   * Batch create/update embeddings
   */
  async batchCreateOrUpdateEmbeddings(
    businessId: string,
    requests: EmbeddingGenerationRequest[]
  ): Promise<{
    success: boolean;
    results: EmbeddingManagerResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    const results: EmbeddingManagerResult[] = [];
    
    try {
      // Process in parallel with concurrency limit
      const concurrencyLimit = 5;
      const chunks = [];
      
      for (let i = 0; i < requests.length; i += concurrencyLimit) {
        chunks.push(requests.slice(i, i + concurrencyLimit));
      }
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(request => this.createOrUpdateEmbedding(request));
        const chunkResults = await Promise.allSettled(chunkPromises);
        
        chunkResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              error: {
                code: 'BATCH_ERROR',
                message: result.reason?.message || 'Batch operation failed',
                details: result.reason
              }
            });
          }
        });
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      
      return {
        success: failed === 0,
        results,
        summary: {
          total: results.length,
          successful,
          failed
        }
      };
      
    } catch (error) {
      return {
        success: false,
        results: [{
          success: false,
          error: {
            code: 'BATCH_PROCESSING_ERROR',
            message: error instanceof Error ? error.message : 'Batch processing failed',
            details: error
          }
        }],
        summary: {
          total: requests.length,
          successful: 0,
          failed: requests.length
        }
      };
    }
  }
  
  /**
   * Cache management
   */
  private getCacheKey(businessId: string, type: string, ...args: any[]): string {
    return `${businessId}:${type}:${args.join(':')}`;
  }
  
  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }
  
  private setCache(key: string, value: any): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }
  
  private getCache(key: string): any {
    if (this.isCacheValid(key)) {
      return this.cache.get(key);
    }
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    return undefined;
  }
  
  private clearCacheForBusiness(businessId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.startsWith(`${businessId}:`)
    );
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    });
  }
  
  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton factory
export function createEmbeddingManager(prisma: PrismaClient): EmbeddingManager {
  return new EmbeddingManager(prisma);
}

