// ===== STREAMING MANAGER - REAL-TIME RESPONSE STREAMING =====

import { LLMService, StreamingLLMResponse } from './llm-service';
import { PromptBuilder, PromptContext } from './prompt-builder';
import { ResponseProcessor, ProcessedResponse } from './response-processor';
import { QueryRequest, QueryIntent } from './query-types';

export interface StreamingConfig {
  chunkSize: number;
  bufferSize: number;
  timeout: number;
  retryAttempts: number;
  enableCaching: boolean;
  cacheTTL: number;
}

export interface StreamingSession {
  sessionId: string;
  businessId: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
  totalTokens: number;
  totalCost: number;
  chunks: string[];
  isComplete: boolean;
  error?: string;
}

export interface StreamingEvent {
  type: 'chunk' | 'complete' | 'error' | 'heartbeat';
  data: {
    chunk?: string;
    sessionId: string;
    tokensUsed?: number;
    cost?: number;
    completed?: boolean;
    error?: string;
    timestamp: Date;
  };
}

export interface StreamingResponse {
  sessionId: string;
  businessId: string;
  totalTokens: number;
  totalCost: number;
  processingTimeMs: number;
  chunks: string[];
  finalResponse: string;
  isComplete: boolean;
  error?: string;
}

export class StreamingManager {
  private llmService: LLMService;
  private promptBuilder: PromptBuilder;
  private responseProcessor: ResponseProcessor;
  private config: StreamingConfig;
  private activeSessions: Map<string, StreamingSession>;
  private responseCache: Map<string, { response: string; timestamp: Date; ttl: number }>;

  constructor(
    llmService?: LLMService,
    promptBuilder?: PromptBuilder,
    responseProcessor?: ResponseProcessor,
    config?: Partial<StreamingConfig>
  ) {
    this.llmService = llmService || new (require('./llm-service').LLMService)();
    this.promptBuilder = promptBuilder || new (require('./prompt-builder').PromptBuilder)();
    this.responseProcessor = responseProcessor || new (require('./response-processor').ResponseProcessor)();
    
    this.config = {
      chunkSize: parseInt(process.env.STREAMING_CHUNK_SIZE || '1024'),
      bufferSize: 8192,
      timeout: parseInt(process.env.RESPONSE_TIMEOUT_MS || '30000'),
      retryAttempts: 3,
      enableCaching: true,
      cacheTTL: parseInt(process.env.RESPONSE_CACHE_TTL_MINUTES || '30') * 60 * 1000,
      ...config
    };

    this.activeSessions = new Map();
    this.responseCache = new Map();
  }

  /**
   * Start streaming response for a query
   */
  async *startStreaming(
    businessId: string,
    request: QueryRequest,
    context: PromptContext
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    const sessionId = request.sessionId || this.generateSessionId();
    const startTime = Date.now();

    // Initialize session
    const session: StreamingSession = {
      sessionId,
      businessId,
      startTime: new Date(),
      lastActivity: new Date(),
      isActive: true,
      totalTokens: 0,
      totalCost: 0,
      chunks: [],
      isComplete: false
    };

    this.activeSessions.set(sessionId, session);

    // Check cache first
    if (this.config.enableCaching) {
      const cachedResponse = this.getCachedResponse(businessId, request.query);
      if (cachedResponse) {
        yield* this.streamCachedResponse(sessionId, cachedResponse);
        return;
      }
    }

    try {
      // Build prompt
      const prompt = this.promptBuilder.buildPrompt(context);
      
      // Validate prompt
      const validation = this.promptBuilder.validatePrompt(prompt);
      if (!validation.isValid) {
        throw new Error(`Invalid prompt: ${validation.issues.join(', ')}`);
      }

      // Convert prompt to OpenAI format
      const messages = this.convertPromptToMessages(prompt);

      // Start streaming from LLM
      const llmStream = this.llmService.generateStreamingResponse(
        messages,
        businessId,
        sessionId
      );

      // Process and yield chunks
      let fullResponse = '';
      for await (const llmChunk of llmStream) {
        if (llmChunk.chunk) {
          fullResponse += llmChunk.chunk;
          session.chunks.push(llmChunk.chunk);
          session.totalTokens = llmChunk.tokensUsed;
          session.totalCost = llmChunk.cost;
          session.lastActivity = new Date();

          yield {
            type: 'chunk',
            data: {
              chunk: llmChunk.chunk,
              sessionId,
              tokensUsed: llmChunk.tokensUsed,
              cost: llmChunk.cost,
              timestamp: new Date()
            }
          };
        }

        if (llmChunk.completed) {
          session.isComplete = true;
          session.totalTokens = llmChunk.tokensUsed;
          session.totalCost = llmChunk.cost;

          // Process final response
          const processedResponse = await this.responseProcessor.processResponse(
            fullResponse,
            {
              businessName: context.business.name,
              businessType: context.business.type,
              intent: context.detectedIntent,
              conversationHistory: context.conversationHistory,
              relevantContext: context.relevantContext
            }
          );

          // Cache response if enabled
          if (this.config.enableCaching) {
            this.cacheResponse(businessId, request.query, processedResponse.text);
          }

          yield {
            type: 'complete',
            data: {
              sessionId,
              tokensUsed: llmChunk.tokensUsed,
              cost: llmChunk.cost,
              completed: true,
              timestamp: new Date()
            }
          };

          break;
        }
      }

    } catch (error) {
      session.error = error instanceof Error ? error.message : 'Unknown error';
      session.isActive = false;

      yield {
        type: 'error',
        data: {
          sessionId,
          error: session.error,
          timestamp: new Date()
        }
      };
    } finally {
      // Clean up session
      this.cleanupSession(sessionId);
    }
  }

  /**
   * Get streaming response as a complete response
   */
  async getStreamingResponse(
    businessId: string,
    request: QueryRequest,
    context: PromptContext
  ): Promise<StreamingResponse> {
    const sessionId = request.sessionId || this.generateSessionId();
    const startTime = Date.now();
    const chunks: string[] = [];
    let totalTokens = 0;
    let totalCost = 0;
    let error: string | undefined;

    try {
      const stream = this.startStreaming(businessId, request, context);
      
      for await (const event of stream) {
        if (event.type === 'chunk' && event.data.chunk) {
          chunks.push(event.data.chunk);
          totalTokens = event.data.tokensUsed || totalTokens;
          totalCost = event.data.cost || totalCost;
        } else if (event.type === 'error') {
          error = event.data.error;
          break;
        } else if (event.type === 'complete') {
          totalTokens = event.data.tokensUsed || totalTokens;
          totalCost = event.data.cost || totalCost;
          break;
        }
      }

      const processingTime = Date.now() - startTime;
      const finalResponse = chunks.join('');

      return {
        sessionId,
        businessId,
        totalTokens,
        totalCost,
        processingTimeMs: processingTime,
        chunks,
        finalResponse,
        isComplete: !error,
        error
      };

    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      return {
        sessionId,
        businessId,
        totalTokens: 0,
        totalCost: 0,
        processingTimeMs: Date.now() - startTime,
        chunks: [],
        finalResponse: '',
        isComplete: false,
        error
      };
    }
  }

  /**
   * Stream cached response
   */
  private async *streamCachedResponse(
    sessionId: string,
    cachedResponse: string
  ): AsyncGenerator<StreamingEvent, void, unknown> {
    const chunks = this.splitIntoChunks(cachedResponse, this.config.chunkSize);
    
    for (let i = 0; i < chunks.length; i++) {
      yield {
        type: 'chunk',
        data: {
          chunk: chunks[i],
          sessionId,
          timestamp: new Date()
        }
      };

      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    yield {
      type: 'complete',
      data: {
        sessionId,
        completed: true,
        timestamp: new Date()
      }
    };
  }

  /**
   * Convert prompt to OpenAI message format
   */
  private convertPromptToMessages(prompt: any): any[] {
    const messages: any[] = [];

    // System message
    if (prompt.systemMessage) {
      messages.push({
        role: 'system',
        content: prompt.systemMessage
      });
    }

    // Business context
    if (prompt.businessContext) {
      messages.push({
        role: 'system',
        content: `Business Context:\n${prompt.businessContext}`
      });
    }

    // Conversation history
    if (prompt.conversationHistory) {
      messages.push({
        role: 'system',
        content: `Conversation History:\n${prompt.conversationHistory}`
      });
    }

    // Response guidelines
    if (prompt.responseGuidelines) {
      messages.push({
        role: 'system',
        content: `Response Guidelines:\n${prompt.responseGuidelines}`
      });
    }

    // Constraints
    if (prompt.constraints) {
      messages.push({
        role: 'system',
        content: `Constraints:\n${prompt.constraints}`
      });
    }

    // Current query
    if (prompt.currentQuery) {
      messages.push({
        role: 'user',
        content: prompt.currentQuery
      });
    }

    return messages;
  }

  /**
   * Split text into chunks
   */
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get cached response
   */
  private getCachedResponse(businessId: string, query: string): string | null {
    const cacheKey = `${businessId}:${query.toLowerCase().trim()}`;
    const cached = this.responseCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
      return cached.response;
    }
    
    if (cached) {
      this.responseCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Cache response
   */
  private cacheResponse(businessId: string, query: string, response: string): void {
    const cacheKey = `${businessId}:${query.toLowerCase().trim()}`;
    this.responseCache.set(cacheKey, {
      response,
      timestamp: new Date(),
      ttl: this.config.cacheTTL
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up session
   */
  private cleanupSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  /**
   * Get active session
   */
  getActiveSession(sessionId: string): StreamingSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): StreamingSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.activeSessions) {
      if (now - session.lastActivity.getTime() > this.config.timeout) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.cleanupSession(sessionId);
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const entries = Array.from(this.responseCache.values());
    const now = Date.now();
    
    return {
      size: this.responseCache.size,
      hitRate: 0, // Would need to track hits/misses
      oldestEntry: entries.length > 0 ? new Date(Math.min(...entries.map(e => e.timestamp.getTime()))) : null,
      newestEntry: entries.length > 0 ? new Date(Math.max(...entries.map(e => e.timestamp.getTime()))) : null
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ===== SINGLETON INSTANCE =====
let streamingManagerInstance: StreamingManager | null = null;

export function getStreamingManager(
  llmService?: LLMService,
  promptBuilder?: PromptBuilder,
  responseProcessor?: ResponseProcessor,
  config?: Partial<StreamingConfig>
): StreamingManager {
  if (!streamingManagerInstance) {
    streamingManagerInstance = new StreamingManager(llmService, promptBuilder, responseProcessor, config);
  }
  return streamingManagerInstance;
}
