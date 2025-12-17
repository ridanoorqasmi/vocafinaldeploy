// ===== CONTEXT RETRIEVER SERVICE =====

import { PrismaClient, EmbeddingType } from '@prisma/client';
import { SearchService, SearchResult, SearchResponse } from './search-service';
import { EmbeddingSearchRequest } from './embedding-types';
import { getOpenAIClient } from './openai-client';

export interface ContextRetrievalConfig {
  topN: number;
  minScore: number;
  maxContextLength: number;
  includeMetadata: boolean;
  enableConfidenceScoring: boolean;
}

export interface ContextResult {
  id: string;
  businessId: string;
  contentType: EmbeddingType;
  contentId: string;
  content: string;
  similarity: number;
  confidence: number;
  score: number;
  metadata?: Record<string, any>;
  textSnippet: string;
  createdAt: Date;
}

export interface ContextRetrievalRequest {
  query: string;
  contentType?: EmbeddingType;
  topN?: number;
  minScore?: number;
  includeMetadata?: boolean;
  maxContextLength?: number;
}

export interface ContextRetrievalResponse {
  success: boolean;
  data?: {
    results: ContextResult[];
    total: number;
    query: string;
    contentType?: EmbeddingType;
    averageConfidence: number;
    retrievalTime: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export class ContextRetriever {
  private searchService: SearchService;
  private openaiClient: any;
  private config: ContextRetrievalConfig;

  constructor(
    prisma: PrismaClient,
    searchService?: SearchService,
    config?: Partial<ContextRetrievalConfig>
  ) {
    this.searchService = searchService || new SearchService(prisma);
    this.openaiClient = getOpenAIClient();
    
    this.config = {
      topN: parseInt(process.env.VECTOR_SEARCH_TOPN || '3'),
      minScore: parseFloat(process.env.VECTOR_SEARCH_MINSCORE || '0.75'),
      maxContextLength: 4000, // Max characters for context
      includeMetadata: true,
      enableConfidenceScoring: true,
      ...config
    };
  }

  /**
   * Retrieve context for a query with confidence scoring
   */
  async retrieveContext(
    businessId: string,
    request: ContextRetrievalRequest
  ): Promise<ContextRetrievalResponse> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        contentType,
        topN = this.config.topN,
        minScore = this.config.minScore,
        includeMetadata = this.config.includeMetadata,
        maxContextLength = this.config.maxContextLength
      } = request;

      // Validate input
      if (!query || query.trim().length === 0) {
        throw new Error('Query cannot be empty');
      }

      if (query.length > 1000) {
        throw new Error('Query exceeds maximum length of 1000 characters');
      }

      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query);
      
      // Perform vector search
      const searchRequest: EmbeddingSearchRequest = {
        query,
        contentType,
        limit: topN,
        threshold: minScore
      };

      const searchResponse = await this.searchService.searchSimilar(
        businessId,
        queryEmbedding,
        searchRequest
      );

      if (!searchResponse.success || !searchResponse.data) {
        return {
          success: false,
          error: {
            code: 'SEARCH_FAILED',
            message: searchResponse.error?.message || 'Search failed',
            details: searchResponse.error
          }
        };
      }

      // Apply confidence scoring and filtering
      const contextResults = await this.processSearchResults(
        searchResponse.data.results,
        query,
        includeMetadata,
        maxContextLength
      );

      // Calculate average confidence
      const averageConfidence = contextResults.length > 0
        ? contextResults.reduce((sum, result) => sum + result.confidence, 0) / contextResults.length
        : 0;

      const retrievalTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          results: contextResults,
          total: contextResults.length,
          query,
          contentType,
          averageConfidence,
          retrievalTime
        }
      };

    } catch (error) {
      console.error('Context retrieval error:', error);
      return {
        success: false,
        error: {
          code: 'RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Unknown retrieval error',
          details: error
        }
      };
    }
  }

  /**
   * Retrieve context from all content types
   */
  async retrieveAllContext(
    businessId: string,
    request: Omit<ContextRetrievalRequest, 'contentType'>
  ): Promise<ContextRetrievalResponse> {
    const startTime = Date.now();
    
    try {
      const {
        query,
        topN = this.config.topN,
        minScore = this.config.minScore,
        includeMetadata = this.config.includeMetadata,
        maxContextLength = this.config.maxContextLength
      } = request;

      // Validate input
      if (!query || query.trim().length === 0) {
        throw new Error('Query cannot be empty');
      }

      if (query.length > 1000) {
        throw new Error('Query exceeds maximum length of 1000 characters');
      }

      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query);
      
      // Perform vector search across all content types
      const searchRequest: Omit<EmbeddingSearchRequest, 'contentType'> = {
        query,
        limit: topN,
        threshold: minScore
      };

      const searchResponse = await this.searchService.searchAll(
        businessId,
        queryEmbedding,
        searchRequest
      );

      if (!searchResponse.success || !searchResponse.data) {
        return {
          success: false,
          error: {
            code: 'SEARCH_FAILED',
            message: searchResponse.error?.message || 'Search failed',
            details: searchResponse.error
          }
        };
      }

      // Apply confidence scoring and filtering
      const contextResults = await this.processSearchResults(
        searchResponse.data.results,
        query,
        includeMetadata,
        maxContextLength
      );

      // Calculate average confidence
      const averageConfidence = contextResults.length > 0
        ? contextResults.reduce((sum, result) => sum + result.confidence, 0) / contextResults.length
        : 0;

      const retrievalTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          results: contextResults,
          total: contextResults.length,
          query,
          averageConfidence,
          retrievalTime
        }
      };

    } catch (error) {
      console.error('Context retrieval error:', error);
      return {
        success: false,
        error: {
          code: 'RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Unknown retrieval error',
          details: error
        }
      };
    }
  }

  /**
   * Generate embedding for a query using OpenAI
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const response = await this.openaiClient.embeddings.create({
        model: 'text-embedding-ada-002',
        input: query.trim()
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
      }

      return response.data[0].embedding;

    } catch (error) {
      console.error('Error generating query embedding:', error);
      throw new Error('Failed to generate query embedding');
    }
  }

  /**
   * Process search results with confidence scoring and text snippets
   */
  private async processSearchResults(
    searchResults: SearchResult[],
    query: string,
    includeMetadata: boolean,
    maxContextLength: number
  ): Promise<ContextResult[]> {
    const contextResults: ContextResult[] = [];

    for (const result of searchResults) {
      try {
        // Calculate confidence score
        const confidence = this.calculateConfidence(result, query);
        
        // Generate text snippet
        const textSnippet = this.generateTextSnippet(result.content, query, maxContextLength);
        
        // Create context result
        const contextResult: ContextResult = {
          id: result.id,
          businessId: result.businessId,
          contentType: result.contentType,
          contentId: result.contentId,
          content: result.content,
          similarity: result.similarity,
          confidence,
          score: result.score,
          textSnippet,
          createdAt: result.createdAt
        };

        // Include metadata if requested
        if (includeMetadata && result.metadata) {
          contextResult.metadata = result.metadata;
        }

        contextResults.push(contextResult);

      } catch (error) {
        console.error('Error processing search result:', error);
        // Continue with other results
      }
    }

    // Sort by confidence score (highest first)
    return contextResults.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate confidence score based on similarity and content relevance
   */
  private calculateConfidence(result: SearchResult, query: string): number {
    let confidence = result.similarity;

    // Boost confidence for exact matches in content
    const queryLower = query.toLowerCase();
    const contentLower = result.content.toLowerCase();
    
    if (contentLower.includes(queryLower)) {
      confidence += 0.1; // Boost for exact match
    }

    // Boost confidence for title matches (if metadata contains title)
    if (result.metadata?.title) {
      const titleLower = result.metadata.title.toLowerCase();
      if (titleLower.includes(queryLower)) {
        confidence += 0.15; // Higher boost for title match
      }
    }

    // Boost confidence for FAQ content type (often more relevant for queries)
    if (result.contentType === 'FAQ') {
      confidence += 0.05;
    }

    // Ensure confidence is between 0 and 1
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Generate a text snippet highlighting the query
   */
  private generateTextSnippet(
    content: string,
    query: string,
    maxLength: number
  ): string {
    if (content.length <= maxLength) {
      return content;
    }

    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const queryIndex = contentLower.indexOf(queryLower);

    if (queryIndex === -1) {
      // Query not found, return beginning of content
      return content.substring(0, maxLength) + '...';
    }

    // Find a good snippet around the query
    const snippetStart = Math.max(0, queryIndex - maxLength / 2);
    const snippetEnd = Math.min(content.length, snippetStart + maxLength);
    
    let snippet = content.substring(snippetStart, snippetEnd);
    
    // Add ellipsis if needed
    if (snippetStart > 0) {
      snippet = '...' + snippet;
    }
    if (snippetEnd < content.length) {
      snippet = snippet + '...';
    }

    return snippet;
  }

  /**
   * Get retrieval statistics
   */
  async getRetrievalStats(businessId: string): Promise<{
    totalEmbeddings: number;
    averageConfidence: number;
    byContentType: Record<EmbeddingType, number>;
  }> {
    try {
      const searchStats = await this.searchService.getSearchStats(businessId);
      
      return {
        totalEmbeddings: searchStats.totalEmbeddings,
        averageConfidence: searchStats.averageSimilarity,
        byContentType: searchStats.byContentType
      };

    } catch (error) {
      console.error('Error getting retrieval stats:', error);
      throw new Error('Failed to get retrieval statistics');
    }
  }

  /**
   * Validate retrieval configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.topN < 1 || this.config.topN > 100) {
      errors.push('topN must be between 1 and 100');
    }

    if (this.config.minScore < 0 || this.config.minScore > 1) {
      errors.push('minScore must be between 0 and 1');
    }

    if (this.config.maxContextLength < 100 || this.config.maxContextLength > 10000) {
      errors.push('maxContextLength must be between 100 and 10000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===== SINGLETON INSTANCE =====
let contextRetrieverInstance: ContextRetriever | null = null;

export function getContextRetriever(
  prisma?: PrismaClient,
  searchService?: SearchService,
  config?: Partial<ContextRetrievalConfig>
): ContextRetriever {
  if (!contextRetrieverInstance) {
    if (!prisma) {
      throw new Error('PrismaClient instance is required for first initialization');
    }
    contextRetrieverInstance = new ContextRetriever(prisma, searchService, config);
  }
  return contextRetrieverInstance;
}

