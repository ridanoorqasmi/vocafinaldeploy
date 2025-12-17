// ===== EMBEDDING GENERATION SERVICE =====

import { EmbeddingType, EMBEDDING_ERRORS } from './embedding-types';
import { 
  getEmbedding, 
  getEmbeddings, 
  withRetry, 
  OpenAIError,
  RateLimitError,
  InvalidAPIKeyError,
  QuotaExceededError 
} from './openai-client';
import { 
  ContentProcessor, 
  ProcessedContent, 
  MenuItemData, 
  PolicyData, 
  FAQData, 
  BusinessData 
} from './content-processor';

// Embedding generation interfaces
export interface EmbeddingGenerationRequest {
  businessId: string;
  contentType: EmbeddingType;
  contentId: string;
  data: MenuItemData | PolicyData | FAQData | BusinessData;
  forceRegenerate?: boolean;
}

export interface EmbeddingGenerationResult {
  success: boolean;
  embedding?: number[];
  processedContent?: ProcessedContent;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    tokenCount: number;
    processingTime: number;
    retryCount: number;
  };
}

export interface BatchEmbeddingRequest {
  businessId: string;
  requests: EmbeddingGenerationRequest[];
}

export interface BatchEmbeddingResult {
  success: boolean;
  results: EmbeddingGenerationResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalProcessingTime: number;
  };
}

// Embedding generation service
export class EmbeddingGenerator {
  private static instance: EmbeddingGenerator;
  private processingCache = new Map<string, Promise<EmbeddingGenerationResult>>();
  
  private constructor() {}
  
  static getInstance(): EmbeddingGenerator {
    if (!EmbeddingGenerator.instance) {
      EmbeddingGenerator.instance = new EmbeddingGenerator();
    }
    return EmbeddingGenerator.instance;
  }
  
  /**
   * Generate embedding for a single content item
   */
  async generateEmbedding(request: EmbeddingGenerationRequest): Promise<EmbeddingGenerationResult> {
    const startTime = Date.now();
    const cacheKey = `${request.businessId}-${request.contentType}-${request.contentId}`;
    
    // Check if already processing (prevent duplicate requests)
    if (this.processingCache.has(cacheKey) && !request.forceRegenerate) {
      return this.processingCache.get(cacheKey)!;
    }
    
    const processingPromise = this._generateEmbeddingInternal(request, startTime);
    this.processingCache.set(cacheKey, processingPromise);
    
    try {
      const result = await processingPromise;
      return result;
    } finally {
      this.processingCache.delete(cacheKey);
    }
  }
  
  /**
   * Internal embedding generation logic
   */
  private async _generateEmbeddingInternal(
    request: EmbeddingGenerationRequest, 
    startTime: number
  ): Promise<EmbeddingGenerationResult> {
    let retryCount = 0;
    
    try {
      // Validate content
      if (!ContentProcessor.validateContent(request.contentType, request.data)) {
        return {
          success: false,
          error: {
            code: EMBEDDING_ERRORS.INVALID_INPUT,
            message: `Invalid content for type ${request.contentType}`
          }
        };
      }
      
      // Process content
      const processedContent = ContentProcessor.processContent(request.contentType, request.data);
      
      if (!processedContent.text || processedContent.text.trim().length === 0) {
        return {
          success: false,
          error: {
            code: EMBEDDING_ERRORS.INVALID_INPUT,
            message: 'Processed content is empty'
          }
        };
      }
      
      // Generate embedding with retry logic
      const embedding = await withRetry(async () => {
        retryCount++;
        return await getEmbedding(processedContent.text);
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        embedding,
        processedContent,
        metadata: {
          tokenCount: processedContent.tokenCount,
          processingTime,
          retryCount
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      if (error instanceof OpenAIError) {
        return {
          success: false,
          error: {
            code: error.code || 'OPENAI_ERROR',
            message: error.message,
            details: {
              statusCode: error.statusCode,
              retryable: error.retryable
            }
          },
          metadata: {
            tokenCount: 0,
            processingTime,
            retryCount
          }
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        },
        metadata: {
          tokenCount: 0,
          processingTime,
          retryCount
        }
      };
    }
  }
  
  /**
   * Generate embeddings for multiple content items (batch)
   */
  async generateEmbeddingsBatch(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    const results: EmbeddingGenerationResult[] = [];
    
    try {
      // Process all requests in parallel
      const promises = request.requests.map(req => this.generateEmbedding(req));
      const batchResults = await Promise.allSettled(promises);
      
      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: {
              code: 'BATCH_ERROR',
              message: result.reason?.message || 'Batch processing failed',
              details: result.reason
            }
          });
        }
      });
      
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      const totalProcessingTime = Date.now() - startTime;
      
      return {
        success: failed === 0,
        results,
        summary: {
          total: results.length,
          successful,
          failed,
          totalProcessingTime
        }
      };
      
    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      
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
          total: request.requests.length,
          successful: 0,
          failed: request.requests.length,
          totalProcessingTime
        }
      };
    }
  }
  
  /**
   * Generate embedding from raw text (for search queries)
   */
  async generateQueryEmbedding(query: string): Promise<EmbeddingGenerationResult> {
    const startTime = Date.now();
    
    try {
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          error: {
            code: EMBEDDING_ERRORS.INVALID_INPUT,
            message: 'Query text is empty'
          }
        };
      }
      
      const processedText = ContentProcessor.cleanText(query);
      const embedding = await withRetry(async () => {
        return await getEmbedding(processedText);
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        embedding,
        processedContent: {
          text: processedText,
          metadata: { type: 'query' },
          tokenCount: ContentProcessor.estimateTokenCount(processedText)
        },
        metadata: {
          tokenCount: ContentProcessor.estimateTokenCount(processedText),
          processingTime,
          retryCount: 1
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        error: {
          code: error instanceof OpenAIError ? error.code || 'OPENAI_ERROR' : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        },
        metadata: {
          tokenCount: 0,
          processingTime,
          retryCount: 1
        }
      };
    }
  }
  
  /**
   * Validate OpenAI connection and configuration
   */
  async validateConfiguration(): Promise<{
    valid: boolean;
    error?: string;
    details?: any;
  }> {
    try {
      const result = await this.generateQueryEmbedding('test');
      
      if (result.success) {
        return { valid: true };
      } else {
        return {
          valid: false,
          error: result.error?.message || 'Configuration validation failed',
          details: result.error
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
        details: error
      };
    }
  }
  
  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    activeProcessing: number;
    cacheSize: number;
  } {
    return {
      activeProcessing: this.processingCache.size,
      cacheSize: this.processingCache.size
    };
  }
  
  /**
   * Clear processing cache
   */
  clearCache(): void {
    this.processingCache.clear();
  }
}

// Export singleton instance
export const embeddingGenerator = EmbeddingGenerator.getInstance();

