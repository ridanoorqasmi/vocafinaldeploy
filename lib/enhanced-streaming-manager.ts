// ===== ENHANCED STREAMING MANAGER =====

import { PrismaClient } from '@prisma/client';
import { LLMService } from './llm-service';
import { PromptBuilder } from './prompt-builder';
import { ResponseProcessor } from './response-processor';
import { BusinessRulesEngine } from './business-rules-engine';
import { ResponseTemplateEngine } from './response-template-engine';
import { QueryRequest, StreamingEvent } from './query-types';
import { CacheStrategy, CacheEntry } from './business-rules-types';

export class EnhancedStreamingManager {
  private prisma: PrismaClient;
  private llmService: LLMService;
  private promptBuilder: PromptBuilder;
  private responseProcessor: ResponseProcessor;
  private businessRulesEngine: BusinessRulesEngine;
  private responseTemplateEngine: ResponseTemplateEngine;
  
  // Enhanced caching system
  private responseCache: Map<string, CacheEntry> = new Map();
  private cacheStrategy: CacheStrategy;
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0
  };

  // Connection management
  private activeConnections: Map<string, {
    sessionId: string;
    businessId: string;
    startTime: Date;
    lastActivity: Date;
    chunksSent: number;
  }> = new Map();

  // Performance monitoring
  private performanceMetrics = {
    averageFirstChunkTime: 0,
    averageTotalTime: 0,
    connectionCount: 0,
    totalChunksSent: 0
  };

  constructor(
    prisma: PrismaClient,
    llmService: LLMService,
    promptBuilder: PromptBuilder,
    responseProcessor: ResponseProcessor,
    businessRulesEngine: BusinessRulesEngine,
    responseTemplateEngine: ResponseTemplateEngine
  ) {
    this.prisma = prisma;
    this.llmService = llmService;
    this.promptBuilder = promptBuilder;
    this.responseProcessor = responseProcessor;
    this.businessRulesEngine = businessRulesEngine;
    this.responseTemplateEngine = responseTemplateEngine;
    
    // Initialize cache strategy
    this.cacheStrategy = {
      cache_levels: {
        exact_match: true,
        semantic_similarity: true,
        template_based: true,
        business_specific: true
      },
      invalidation_rules: {
        business_updates: true,
        time_sensitive: true,
        usage_patterns: true,
        quality_feedback: true
      },
      ttl_seconds: 3600, // 1 hour
      max_size_mb: 100
    };

    // Start cache cleanup interval
    this.startCacheCleanup();
  }

  /**
   * Start enhanced streaming with intelligent caching and optimization
   */
  async *startEnhancedStreaming(
    businessId: string,
    request: QueryRequest,
    context: any
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();
    let firstChunkTime: number | null = null;

    try {
      // Register connection
      this.registerConnection(sessionId, businessId);

      // Check cache first
      const cacheKey = this.generateCacheKey(businessId, request, context);
      const cachedResponse = this.getCachedResponse(cacheKey);
      
      if (cachedResponse) {
        console.log('Cache hit for streaming response');
        yield* this.streamCachedResponse(cachedResponse, sessionId);
        return;
      }

      // Apply business rules
      const rulesResult = await this.businessRulesEngine.evaluateRules({
        business_id: businessId,
        query_text: request.query,
        intent: context.intent || 'UNKNOWN',
        customer_context: context.customerContext,
        conversation_context: context.conversationContext,
        business_context: context.businessContext
      });

      // Build enhanced prompt with rules
      const enhancedContext = {
        ...context,
        businessRules: rulesResult.applied_actions,
        modifiedContext: rulesResult.modified_context
      };

      const prompt = this.promptBuilder.buildPrompt(enhancedContext);
      const messages = this.convertPromptToMessages(prompt);

      // Start streaming from LLM
      let fullResponse = '';
      let totalTokens = 0;
      let totalCost = 0;
      let chunkCount = 0;

      for await (const llmChunk of this.llmService.generateStreamingResponse(messages, businessId, sessionId)) {
        if (firstChunkTime === null) {
          firstChunkTime = Date.now() - startTime;
          this.updatePerformanceMetrics(firstChunkTime, 0);
        }

        fullResponse += llmChunk.chunk;
        totalTokens += llmChunk.tokensUsed || 0;
        totalCost += llmChunk.cost || 0;
        chunkCount++;

        // Update connection activity
        this.updateConnectionActivity(sessionId);

        // Yield chunk with enhanced metadata
        yield {
          type: 'chunk',
          data: {
            chunk: llmChunk.chunk,
            sessionId,
            tokensUsed: totalTokens,
            cost: totalCost,
            timestamp: new Date(),
            chunkIndex: chunkCount,
            businessRulesApplied: rulesResult.applied_actions.length,
            cacheStatus: 'miss'
          }
        };
      }

      // Process complete response
      const processedResponse = await this.responseProcessor.processResponse(fullResponse, {
        businessId,
        sessionId,
        originalQuery: request.query,
        context: enhancedContext
      });

      // Cache the response
      this.cacheResponse(cacheKey, {
        response: processedResponse,
        tokensUsed: totalTokens,
        cost: totalCost,
        processingTime: Date.now() - startTime,
        businessRules: rulesResult.applied_actions
      }, businessId);

      // Yield completion event
      yield {
        type: 'complete',
        data: {
          sessionId,
          tokensUsed: totalTokens,
          cost: totalCost,
          completed: true,
          timestamp: new Date(),
          totalChunks: chunkCount,
          processingTime: Date.now() - startTime,
          businessRulesApplied: rulesResult.applied_actions.length,
          responseQuality: processedResponse.confidence
        }
      };

      // Update performance metrics
      this.updatePerformanceMetrics(firstChunkTime, Date.now() - startTime);

    } catch (error) {
      console.error('Enhanced streaming error:', error);
      
      // Try fallback response
      const fallbackResponse = await this.getFallbackResponse(businessId, request, context);
      
      yield {
        type: 'error',
        data: {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          fallbackResponse,
          timestamp: new Date()
        }
      };
    } finally {
      // Cleanup connection
      this.unregisterConnection(sessionId);
    }
  }

  /**
   * Get cached response with intelligent matching
   */
  private getCachedResponse(cacheKey: string): any {
    // Check exact match first
    let cacheEntry = this.responseCache.get(cacheKey);
    
    if (cacheEntry && !this.isCacheEntryExpired(cacheEntry)) {
      this.cacheStats.hits++;
      cacheEntry.access_count++;
      cacheEntry.last_accessed = new Date();
      return cacheEntry.value;
    }

    // Check semantic similarity if enabled
    if (this.cacheStrategy.cache_levels.semantic_similarity) {
      cacheEntry = this.findSemanticallySimilarCache(cacheKey);
      if (cacheEntry) {
        this.cacheStats.hits++;
        cacheEntry.access_count++;
        cacheEntry.last_accessed = new Date();
        return cacheEntry.value;
      }
    }

    this.cacheStats.misses++;
    return null;
  }

  /**
   * Find semantically similar cached response
   */
  private findSemanticallySimilarCache(cacheKey: string): CacheEntry | null {
    // In a real implementation, this would use embeddings to find similar responses
    // For now, we'll do a simple string similarity check
    for (const [key, entry] of this.responseCache.entries()) {
      if (this.calculateSimilarity(cacheKey, key) > 0.95) {
        return entry;
      }
    }
    return null;
  }

  /**
   * Calculate string similarity (simplified)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Stream cached response
   */
  private async *streamCachedResponse(cachedResponse: any, sessionId: string): AsyncGenerator<StreamingEvent, void, unknown> {
    const response = cachedResponse.response;
    const chunks = this.chunkResponse(response.text, 50); // Chunk size of 50 characters
    
    for (let i = 0; i < chunks.length; i++) {
      yield {
        type: 'chunk',
        data: {
          chunk: chunks[i],
          sessionId,
          tokensUsed: cachedResponse.tokensUsed,
          cost: cachedResponse.cost,
          timestamp: new Date(),
          chunkIndex: i + 1,
          cacheStatus: 'hit'
        }
      };
      
      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    yield {
      type: 'complete',
      data: {
        sessionId,
        tokensUsed: cachedResponse.tokensUsed,
        cost: cachedResponse.cost,
        completed: true,
        timestamp: new Date(),
        totalChunks: chunks.length,
        cacheStatus: 'hit'
      }
    };
  }

  /**
   * Cache response with intelligent strategy
   */
  private cacheResponse(cacheKey: string, response: any, businessId: string): void {
    // Check cache size limits
    if (this.cacheStats.totalSize > this.cacheStrategy.max_size_mb * 1024 * 1024) {
      this.evictLeastUsedEntries();
    }

    const cacheEntry: CacheEntry = {
      key: cacheKey,
      value: response,
      created_at: new Date(),
      expires_at: new Date(Date.now() + this.cacheStrategy.ttl_seconds * 1000),
      access_count: 1,
      last_accessed: new Date(),
      business_id: businessId,
      cache_level: 'exact_match',
      metadata: {
        responseLength: response.response?.text?.length || 0,
        tokensUsed: response.tokensUsed,
        cost: response.cost
      }
    };

    this.responseCache.set(cacheKey, cacheEntry);
    this.cacheStats.totalSize += JSON.stringify(response).length;
  }

  /**
   * Evict least used cache entries
   */
  private evictLeastUsedEntries(): void {
    const entries = Array.from(this.responseCache.entries());
    entries.sort((a, b) => a[1].access_count - b[1].access_count);
    
    // Remove bottom 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      const [key, entry] = entries[i];
      this.responseCache.delete(key);
      this.cacheStats.totalSize -= JSON.stringify(entry.value).length;
      this.cacheStats.evictions++;
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheEntryExpired(entry: CacheEntry): boolean {
    return new Date() > entry.expires_at;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(businessId: string, request: QueryRequest, context: any): string {
    const keyData = {
      businessId,
      query: request.query.toLowerCase().trim(),
      intent: context.intent,
      sessionId: request.sessionId
    };
    
    return `cache_${businessId}_${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  /**
   * Chunk response text
   */
  private chunkResponse(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get fallback response
   */
  private async getFallbackResponse(businessId: string, request: QueryRequest, context: any): Promise<string> {
    try {
      // Try to get a fallback template
      const template = await this.responseTemplateEngine.getBestTemplate(
        businessId,
        'fallback_templates',
        context
      );

      if (template) {
        return await this.responseTemplateEngine.renderTemplate(template, {
          query: request.query,
          business_name: context.businessName || 'our business'
        }, context);
      }

      // Default fallback
      return "I apologize, but I'm having trouble processing your request right now. Please try again or contact us directly for assistance.";
    } catch (error) {
      return "I'm sorry, I'm experiencing technical difficulties. Please contact us directly for help.";
    }
  }

  /**
   * Register active connection
   */
  private registerConnection(sessionId: string, businessId: string): void {
    this.activeConnections.set(sessionId, {
      sessionId,
      businessId,
      startTime: new Date(),
      lastActivity: new Date(),
      chunksSent: 0
    });
    
    this.performanceMetrics.connectionCount = this.activeConnections.size;
  }

  /**
   * Update connection activity
   */
  private updateConnectionActivity(sessionId: string): void {
    const connection = this.activeConnections.get(sessionId);
    if (connection) {
      connection.lastActivity = new Date();
      connection.chunksSent++;
      this.performanceMetrics.totalChunksSent++;
    }
  }

  /**
   * Unregister connection
   */
  private unregisterConnection(sessionId: string): void {
    this.activeConnections.delete(sessionId);
    this.performanceMetrics.connectionCount = this.activeConnections.size;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(firstChunkTime: number, totalTime: number): void {
    // Update rolling averages
    this.performanceMetrics.averageFirstChunkTime = 
      (this.performanceMetrics.averageFirstChunkTime + firstChunkTime) / 2;
    this.performanceMetrics.averageTotalTime = 
      (this.performanceMetrics.averageTotalTime + totalTime) / 2;
  }

  /**
   * Start cache cleanup interval
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = new Date();
    for (const [key, entry] of this.responseCache.entries()) {
      if (now > entry.expires_at) {
        this.responseCache.delete(key);
        this.cacheStats.totalSize -= JSON.stringify(entry.value).length;
        this.cacheStats.evictions++;
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    const hitRate = this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0;
    
    return {
      ...this.cacheStats,
      hitRate: hitRate,
      totalEntries: this.responseCache.size,
      activeConnections: this.activeConnections.size,
      performanceMetrics: this.performanceMetrics
    };
  }

  /**
   * Convert prompt to messages (helper method)
   */
  private convertPromptToMessages(prompt: any): any[] {
    const messages: any[] = [];
    
    if (prompt.systemMessage) {
      messages.push({ role: 'system', content: prompt.systemMessage });
    }
    
    if (prompt.businessContext) {
      messages.push({ role: 'system', content: `Business Context: ${prompt.businessContext}` });
    }
    
    if (prompt.conversationHistory) {
      messages.push({ role: 'system', content: `Conversation History: ${prompt.conversationHistory}` });
    }
    
    if (prompt.currentQuery) {
      messages.push({ role: 'user', content: prompt.currentQuery });
    }
    
    return messages;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let enhancedStreamingManager: EnhancedStreamingManager | null = null;

export function getEnhancedStreamingManager(
  prisma?: PrismaClient,
  llmService?: LLMService,
  promptBuilder?: PromptBuilder,
  responseProcessor?: ResponseProcessor,
  businessRulesEngine?: BusinessRulesEngine,
  responseTemplateEngine?: ResponseTemplateEngine
): EnhancedStreamingManager {
  if (!enhancedStreamingManager) {
    if (!prisma || !llmService || !promptBuilder || !responseProcessor || !businessRulesEngine || !responseTemplateEngine) {
      throw new Error('All services are required for first initialization');
    }
    enhancedStreamingManager = new EnhancedStreamingManager(
      prisma,
      llmService,
      promptBuilder,
      responseProcessor,
      businessRulesEngine,
      responseTemplateEngine
    );
  }
  return enhancedStreamingManager;
}
