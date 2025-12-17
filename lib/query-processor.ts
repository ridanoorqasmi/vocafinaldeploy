// ===== QUERY PROCESSOR - MAIN PIPELINE ORCHESTRATOR =====

import { PrismaClient } from '@prisma/client';
import { 
  QueryRequest, 
  QueryResponse, 
  ContextSources, 
  QueryIntent,
  ProcessingMetrics,
  QUERY_ERRORS,
  QUERY_ERROR_MESSAGES,
  DEFAULT_QUERY_CONFIG,
  DEFAULT_CONTEXT_CONFIG
} from './query-types';
import { getValidationService } from './validation-service';
import { getIntentDetector } from './intent-detector';
import { getConversationManager } from './conversation-manager';
import { getAnalyticsLogger } from './analytics-logger';
import { getContextRetriever } from './context-retriever';
import { getCacheManager } from './cache-manager';
import { getLLMService, LLMService } from './llm-service';
import { getPromptBuilder, PromptBuilder, BusinessContext, ConversationHistory } from './prompt-builder';
import { getResponseProcessor, ResponseProcessor } from './response-processor';
import { getStreamingManager, StreamingManager } from './streaming-manager';
import { getBusinessRulesEngine, BusinessRulesEngine } from './business-rules-engine';
import { getResponseTemplateEngine, ResponseTemplateEngine } from './response-template-engine';
import { getEnhancedStreamingManager, EnhancedStreamingManager } from './enhanced-streaming-manager';

export interface QueryProcessorConfig {
  enableContextRetrieval: boolean;
  enableConversationHistory: boolean;
  enableBusinessHours: boolean;
  enableMenuAvailability: boolean;
  maxProcessingTimeMs: number;
  enableCaching: boolean;
  enableAnalytics: boolean;
}

export interface ProcessingStep {
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
  error?: string;
  data?: any;
}

export class QueryProcessor {
  private prisma: PrismaClient;
  private config: QueryProcessorConfig;
  private validationService: any;
  private intentDetector: any;
  private conversationManager: any;
  private analyticsLogger: any;
  private contextRetriever: any;
  private cacheManager: any;
  private llmService: LLMService;
  private promptBuilder: PromptBuilder;
  private responseProcessor: ResponseProcessor;
  private streamingManager: StreamingManager;
  private businessRulesEngine: BusinessRulesEngine;
  private responseTemplateEngine: ResponseTemplateEngine;
  private enhancedStreamingManager: EnhancedStreamingManager;

  constructor(
    prisma: PrismaClient, 
    config?: Partial<QueryProcessorConfig>,
    services?: {
      validationService?: any;
      intentDetector?: any;
      conversationManager?: any;
      analyticsLogger?: any;
      contextRetriever?: any;
      cacheManager?: any;
      llmService?: LLMService;
      promptBuilder?: PromptBuilder;
      responseProcessor?: ResponseProcessor;
      streamingManager?: StreamingManager;
      businessRulesEngine?: BusinessRulesEngine;
      responseTemplateEngine?: ResponseTemplateEngine;
      enhancedStreamingManager?: EnhancedStreamingManager;
    }
  ) {
    this.prisma = prisma;
    this.config = {
      enableContextRetrieval: true,
      enableConversationHistory: true,
      enableBusinessHours: true,
      enableMenuAvailability: true,
      maxProcessingTimeMs: DEFAULT_QUERY_CONFIG.queryTimeoutMs,
      enableCaching: true,
      enableAnalytics: true,
      ...config
    };

    // Initialize services with dependency injection support
    this.validationService = services?.validationService || getValidationService();
    this.intentDetector = services?.intentDetector || getIntentDetector();
    this.conversationManager = services?.conversationManager || getConversationManager(prisma);
    this.analyticsLogger = services?.analyticsLogger || getAnalyticsLogger(prisma);
    this.contextRetriever = services?.contextRetriever || getContextRetriever(prisma);
    this.cacheManager = services?.cacheManager || getCacheManager(prisma);
    
    // Initialize Phase 3B services
    this.llmService = services?.llmService || getLLMService();
    this.promptBuilder = services?.promptBuilder || getPromptBuilder();
    this.responseProcessor = services?.responseProcessor || getResponseProcessor();
    this.streamingManager = services?.streamingManager || getStreamingManager(
      this.llmService,
      this.promptBuilder,
      this.responseProcessor
    );
    this.businessRulesEngine = services?.businessRulesEngine || getBusinessRulesEngine(prisma);
    this.responseTemplateEngine = services?.responseTemplateEngine || getResponseTemplateEngine(prisma);
    this.enhancedStreamingManager = services?.enhancedStreamingManager || getEnhancedStreamingManager(
      prisma,
      this.llmService,
      this.promptBuilder,
      this.responseProcessor,
      this.businessRulesEngine,
      this.responseTemplateEngine
    );
  }

  /**
   * Process a query through the complete pipeline
   */
  async processQuery(
    businessId: string,
    request: QueryRequest,
    userAgent?: string,
    ipAddress?: string
  ): Promise<QueryResponse> {
    const startTime = new Date();
    const processingMetrics: ProcessingMetrics = {
      startTime,
      steps: []
    };

    try {
      // Step 1: Input Validation
      const validationStep = await this.executeStep('validation', async () => {
        return await this.validateInput(request);
      });
      processingMetrics.steps.push(validationStep);

      if (!validationStep.success) {
        throw new Error(validationStep.error);
      }

      // Step 2: Rate Limiting
      const rateLimitStep = await this.executeStep('rate_limiting', async () => {
        return await this.checkRateLimit(businessId, request.sessionId);
      });
      processingMetrics.steps.push(rateLimitStep);

      if (!rateLimitStep.success) {
        throw new Error(rateLimitStep.error);
      }

      // Step 3: Session Management
      const sessionStep = await this.executeStep('session_management', async () => {
        return await this.manageSession(businessId, request);
      });
      processingMetrics.steps.push(sessionStep);

      if (!sessionStep.success) {
        throw new Error(sessionStep.error);
      }

      const session = sessionStep.data;

      // Step 4: Intent Detection
      const intentStep = await this.executeStep('intent_detection', async () => {
        return await this.detectIntent(request.query);
      });
      processingMetrics.steps.push(intentStep);

      const intent = intentStep.success ? intentStep.data : { intent: 'UNKNOWN' as QueryIntent, confidence: 0.1 };

      // Step 5: Context Retrieval
      let contextSources: ContextSources | null = null;
      if (this.config.enableContextRetrieval) {
        const contextStep = await this.executeStep('context_retrieval', async () => {
          return await this.retrieveContext(businessId, request, intent.intent);
        });
        processingMetrics.steps.push(contextStep);

        if (contextStep.success) {
          contextSources = contextStep.data;
        }
      }

      // Step 6: Response Generation (Phase 3B will implement this)
      const responseStep = await this.executeStep('response_generation', async () => {
        return await this.generateResponse(request, intent, contextSources, session);
      });
      processingMetrics.steps.push(responseStep);

      if (!responseStep.success) {
        throw new Error(responseStep.error);
      }

      const response = responseStep.data;

      // Step 7: Logging and Analytics
      if (this.config.enableAnalytics) {
        const loggingStep = await this.executeStep('analytics_logging', async () => {
          return await this.logQuery(
            businessId,
            session.sessionId,
            request,
            intent,
            contextSources,
            response,
            processingMetrics,
            userAgent,
            ipAddress
          );
        });
        processingMetrics.steps.push(loggingStep);
      }

      // Update processing metrics
      processingMetrics.endTime = new Date();
      processingMetrics.duration = processingMetrics.endTime.getTime() - processingMetrics.startTime.getTime();

      // Update response metadata with actual processing time
      response.metadata.processingTimeMs = processingMetrics.duration;

      return response;

    } catch (error) {
      processingMetrics.endTime = new Date();
      processingMetrics.duration = processingMetrics.endTime.getTime() - processingMetrics.startTime.getTime();

      // Log error
      if (this.config.enableAnalytics) {
        await this.analyticsLogger.logError(
          businessId,
          request.sessionId || 'unknown',
          error as Error,
          { query: request.query, processingMetrics }
        );
      }

      throw error;
    }
  }

  /**
   * Execute a processing step with timing and error handling
   */
  private async executeStep<T>(
    name: string,
    stepFunction: () => Promise<T>
  ): Promise<ProcessingStep> {
    const startTime = new Date();
    
    try {
      const result = await stepFunction();
      const endTime = new Date();
      
      return {
        name,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: true,
        data: result
      };
    } catch (error) {
      const endTime = new Date();
      
      return {
        name,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate input query
   */
  private async validateInput(request: QueryRequest): Promise<void> {
    const validation = await this.validationService.validateQuery(request.query);
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (request.sessionId && !this.validationService.validateSessionId(request.sessionId)) {
      throw new Error('Invalid session ID format');
    }

    if (request.customerId && !this.validationService.validateCustomerId(request.customerId)) {
      throw new Error('Invalid customer ID format');
    }

    if (request.context && !this.validationService.validateBusinessContext(request.context)) {
      throw new Error('Invalid business context format');
    }
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(businessId: string, sessionId?: string): Promise<void> {
    const identifier = sessionId || businessId;
    const rateLimitResult = await this.validationService.checkRateLimit(identifier);
    
    if (!rateLimitResult.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`);
    }
  }

  /**
   * Manage conversation session
   */
  private async manageSession(businessId: string, request: QueryRequest): Promise<any> {
    return await this.conversationManager.getOrCreateSession(
      businessId,
      request.sessionId,
      request.customerId
    );
  }

  /**
   * Detect query intent
   */
  private async detectIntent(query: string): Promise<{ intent: QueryIntent; confidence: number }> {
    const result = await this.intentDetector.detectIntent(query);
    return {
      intent: result.intent,
      confidence: result.confidence
    };
  }

  /**
   * Retrieve context from multiple sources
   */
  private async retrieveContext(
    businessId: string,
    request: QueryRequest,
    intent: QueryIntent
  ): Promise<ContextSources> {
    const contextSources: ContextSources = {
      embeddings: {
        menuItems: [],
        policies: [],
        faqs: []
      },
      businessData: {
        basicInfo: { name: '', cuisine: '', description: '' },
        operatingHours: { isOpen: false, currentStatus: '', todayHours: '', timezone: 'UTC' },
        location: { address: '', city: '', state: '', zipCode: '' },
        specials: []
      },
      conversation: {
        history: [],
        context: '',
        userPreferences: []
      }
    };

    // Retrieve embeddings context
    const embeddingContext = await this.contextRetriever.retrieveAllContext(businessId, {
      query: request.query,
      topN: DEFAULT_CONTEXT_CONFIG.maxItemsPerSource,
      minScore: DEFAULT_CONTEXT_CONFIG.similarityThreshold
    });

    if (embeddingContext.success && embeddingContext.data) {
      embeddingContext.data.results.forEach(result => {
        const contextItem = {
          id: result.id,
          content: result.content,
          similarity: result.similarity,
          confidence: result.confidence,
          metadata: result.metadata,
          textSnippet: result.textSnippet
        };

        switch (result.contentType) {
          case 'MENU':
            contextSources.embeddings.menuItems.push(contextItem);
            break;
          case 'POLICY':
            contextSources.embeddings.policies.push(contextItem);
            break;
          case 'FAQ':
            contextSources.embeddings.faqs.push(contextItem);
            break;
        }
      });
    }

    // Retrieve business data
    if (this.config.enableBusinessHours) {
      const businessData = await this.getBusinessData(businessId);
      contextSources.businessData = businessData;
    }

    // Retrieve conversation history
    if (this.config.enableConversationHistory && request.sessionId) {
      const conversationContext = await this.conversationManager.getConversationContext(
        businessId,
        request.sessionId
      );
      
      if (conversationContext) {
        contextSources.conversation = {
          history: conversationContext.messages,
          context: conversationContext.contextSummary || '',
          userPreferences: conversationContext.userPreferences
        };
      }
    }

    return contextSources;
  }

  /**
   * Generate response using GPT-4o (Phase 3B Implementation)
   */
  private async generateResponse(
    request: QueryRequest,
    intent: { intent: QueryIntent; confidence: number },
    contextSources: ContextSources | null,
    session: any
  ): Promise<QueryResponse> {
    try {
      // Get business data for prompt context
      const businessData = await this.getBusinessData(session.businessId);
      
      // Build business context
      const businessContext: BusinessContext = {
        id: businessData.id,
        name: businessData.name,
        type: businessData.type,
        category: businessData.category,
        description: businessData.description,
        phone: businessData.phone,
        website: businessData.website,
        address: businessData.address,
        city: businessData.city,
        state: businessData.state,
        zipCode: businessData.zipCode,
        timezone: businessData.timezone,
        operatingHours: businessData.operatingHours,
        isOpen: businessData.isOpen,
        policies: businessData.policies,
        services: businessData.services,
        products: businessData.products,
        specialOffers: businessData.specialOffers,
        customInstructions: businessData.customInstructions
      };

      // Build conversation history
      const conversationHistory: ConversationHistory[] = [];
      if (contextSources?.conversation?.history) {
        contextSources.conversation.history.forEach((msg: any) => {
          conversationHistory.push({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            intent: msg.intent
          });
        });
      }

      // Build relevant context
      const relevantContext: string[] = [];
      if (contextSources?.business) {
        relevantContext.push(`Business Info: ${contextSources.business.name} - ${contextSources.business.description}`);
      }
      if (contextSources?.menu) {
        relevantContext.push(`Menu Items: ${contextSources.menu.items.map((item: any) => item.name).join(', ')}`);
      }
      if (contextSources?.hours) {
        relevantContext.push(`Hours: ${contextSources.hours.currentStatus} - ${contextSources.hours.todayHours}`);
      }

      // Build prompt context
      const promptContext = {
        business: businessContext,
        conversationHistory,
        currentQuery: request.query,
        detectedIntent: intent.intent,
        relevantContext,
        customerPreferences: contextSources?.conversation?.userPreferences || [],
        sessionMetadata: {
          sessionId: session.sessionId,
          turnCount: conversationHistory.length + 1
        }
      };

      // Build prompt
      const prompt = this.promptBuilder.buildPrompt(promptContext);
      
      // Validate prompt
      const validation = this.promptBuilder.validatePrompt(prompt);
      if (!validation.isValid) {
        throw new Error(`Invalid prompt: ${validation.issues.join(', ')}`);
      }

      // Convert prompt to OpenAI messages
      const messages = this.convertPromptToMessages(prompt);

      // Generate response using LLM
      const llmResponse = await this.llmService.generateResponse(
        messages,
        session.businessId,
        session.sessionId
      );

      // Process response for quality assurance
      const processedResponse = await this.responseProcessor.processResponse(
        llmResponse.text,
        {
          businessName: businessContext.name,
          businessType: businessContext.type,
          intent: intent.intent,
          conversationHistory,
          relevantContext
        }
      );

      // Generate follow-up suggestions
      const suggestions = this.generateSuggestions(intent.intent);

      // Get business quota info
      const quota = await this.llmService.getBusinessQuota(session.businessId);

      return {
        response: {
          text: processedResponse.text,
          confidence: processedResponse.confidence,
          sources: this.extractSourceIds(contextSources),
          intent: intent.intent,
          suggestions,
          processingTimeMs: llmResponse.processingTimeMs,
          streamingAvailable: true
        },
        session: {
          sessionId: session.sessionId,
          expiresAt: session.expiresAt.toISOString(),
          contextSummary: session.contextSummary || '',
          turnCount: conversationHistory.length + 1
        },
        usage: {
          tokensUsed: llmResponse.tokensUsed,
          costEstimate: llmResponse.cost,
          remainingQuota: quota.remainingQuota
        },
        metadata: {
          modelUsed: llmResponse.model,
          temperature: 0.7, // From config
          responseCached: false,
          businessContextUsed: this.getContextSourceTypes(contextSources),
          processingTimeMs: llmResponse.processingTimeMs
        }
      };

    } catch (error) {
      console.error('Error generating response:', error);
      
      // Fallback to placeholder response
      const fallbackResponse = this.llmService.generateFallbackResponse(
        intent.intent,
        session.businessName || 'our business'
      );

      return {
        response: {
          text: fallbackResponse,
          confidence: 0.3,
          sources: this.extractSourceIds(contextSources),
          intent: intent.intent,
          suggestions: this.generateSuggestions(intent.intent),
          processingTimeMs: 0,
          streamingAvailable: false
        },
        session: {
          sessionId: session.sessionId,
          expiresAt: session.expiresAt.toISOString(),
          contextSummary: session.contextSummary || '',
          turnCount: 1
        },
        usage: {
          tokensUsed: 0,
          costEstimate: 0,
          remainingQuota: 0
        },
        metadata: {
          modelUsed: 'fallback',
          temperature: 0,
          responseCached: false,
          businessContextUsed: this.getContextSourceTypes(contextSources),
          processingTimeMs: 0
        }
      };
    }
  }

  /**
   * Process streaming query (Phase 3B Implementation)
   */
  async *processStreamingQuery(
    businessId: string,
    request: QueryRequest,
    userAgent?: string,
    ipAddress?: string
  ): AsyncGenerator<any, void, unknown> {
    const startTime = new Date();
    const processingMetrics: ProcessingMetrics = {
      startTime,
      steps: []
    };

    try {
      // Step 1: Input Validation
      const validationStep = await this.executeStep('validation', async () => {
        return await this.validateInput(request);
      });
      processingMetrics.steps.push(validationStep);

      if (!validationStep.success) {
        throw new Error(validationStep.error);
      }

      // Step 2: Rate Limiting
      const rateLimitStep = await this.executeStep('rate_limiting', async () => {
        return await this.checkRateLimit(businessId, request.sessionId);
      });
      processingMetrics.steps.push(rateLimitStep);

      if (!rateLimitStep.success) {
        throw new Error(rateLimitStep.error);
      }

      // Step 3: Session Management
      const sessionStep = await this.executeStep('session_management', async () => {
        return await this.manageSession(businessId, request);
      });
      processingMetrics.steps.push(sessionStep);

      if (!sessionStep.success) {
        throw new Error(sessionStep.error);
      }

      const session = sessionStep.data;

      // Step 4: Intent Detection
      const intentStep = await this.executeStep('intent_detection', async () => {
        return await this.detectIntent(request.query);
      });
      processingMetrics.steps.push(intentStep);

      const intent = intentStep.success ? intentStep.data : { intent: 'UNKNOWN' as QueryIntent, confidence: 0.1 };

      // Step 5: Context Retrieval
      let contextSources: ContextSources | null = null;
      if (this.config.enableContextRetrieval) {
        const contextStep = await this.executeStep('context_retrieval', async () => {
          return await this.retrieveContext(businessId, request, intent.intent);
        });
        processingMetrics.steps.push(contextStep);

        if (contextStep.success) {
          contextSources = contextStep.data;
        }
      }

      // Step 6: Build prompt context for streaming
      const businessData = await this.getBusinessData(session.businessId);
      
      const businessContext: BusinessContext = {
        id: businessData.id,
        name: businessData.name,
        type: businessData.type,
        category: businessData.category,
        description: businessData.description,
        phone: businessData.phone,
        website: businessData.website,
        address: businessData.address,
        city: businessData.city,
        state: businessData.state,
        zipCode: businessData.zipCode,
        timezone: businessData.timezone,
        operatingHours: businessData.operatingHours,
        isOpen: businessData.isOpen,
        policies: businessData.policies,
        services: businessData.services,
        products: businessData.products,
        specialOffers: businessData.specialOffers,
        customInstructions: businessData.customInstructions
      };

      const conversationHistory: ConversationHistory[] = [];
      if (contextSources?.conversation?.history) {
        contextSources.conversation.history.forEach((msg: any) => {
          conversationHistory.push({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            intent: msg.intent
          });
        });
      }

      const relevantContext: string[] = [];
      if (contextSources?.business) {
        relevantContext.push(`Business Info: ${contextSources.business.name} - ${contextSources.business.description}`);
      }
      if (contextSources?.menu) {
        relevantContext.push(`Menu Items: ${contextSources.menu.items.map((item: any) => item.name).join(', ')}`);
      }
      if (contextSources?.hours) {
        relevantContext.push(`Hours: ${contextSources.hours.currentStatus} - ${contextSources.hours.todayHours}`);
      }

      const promptContext = {
        business: businessContext,
        conversationHistory,
        currentQuery: request.query,
        detectedIntent: intent.intent,
        relevantContext,
        customerPreferences: contextSources?.conversation?.userPreferences || [],
        sessionMetadata: {
          sessionId: session.sessionId,
          turnCount: conversationHistory.length + 1
        }
      };

      // Step 7: Start streaming response
      const stream = this.streamingManager.startStreaming(businessId, request, promptContext);
      
      for await (const event of stream) {
        yield event;
      }

      // Step 8: Log analytics
      if (this.config.enableAnalytics) {
        await this.analyticsLogger.logQuery(
          businessId,
          session.sessionId,
          request,
          intent,
          contextSources,
          { response: { text: 'Streaming response completed' } },
          processingMetrics,
          userAgent,
          ipAddress
        );
      }

    } catch (error) {
      processingMetrics.endTime = new Date();
      processingMetrics.duration = processingMetrics.endTime.getTime() - processingMetrics.startTime.getTime();

      // Log error
      if (this.config.enableAnalytics) {
        await this.analyticsLogger.logError(
          businessId,
          request.sessionId || 'unknown',
          error as Error,
          { query: request.query, processingMetrics }
        );
      }

      // Yield error event
      yield {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Process enhanced streaming query with Phase 3C features (Business Rules, Templates, Caching)
   */
  async *processEnhancedStreamingQuery(
    businessId: string,
    request: QueryRequest,
    userAgent?: string,
    ipAddress?: string
  ): AsyncGenerator<any, void, unknown> {
    const startTime = new Date();
    const processingMetrics: ProcessingMetrics = {
      startTime,
      steps: []
    };

    try {
      // Step 1: Input Validation
      const validationStep = await this.executeStep('validation', async () => {
        return await this.validateInput(request);
      });
      processingMetrics.steps.push(validationStep);

      if (!validationStep.success) {
        throw new Error(validationStep.error);
      }

      // Step 2: Rate Limiting
      const rateLimitStep = await this.executeStep('rate_limiting', async () => {
        return await this.checkRateLimit(businessId, request.sessionId);
      });
      processingMetrics.steps.push(rateLimitStep);

      if (!rateLimitStep.success) {
        throw new Error(rateLimitStep.error);
      }

      // Step 3: Session Management
      const sessionStep = await this.executeStep('session_management', async () => {
        return await this.manageSession(businessId, request);
      });
      processingMetrics.steps.push(sessionStep);

      if (!sessionStep.success) {
        throw new Error(sessionStep.error);
      }

      const session = sessionStep.data;

      // Step 4: Intent Detection
      const intentStep = await this.executeStep('intent_detection', async () => {
        return await this.detectIntent(request.query, businessId);
      });
      processingMetrics.steps.push(intentStep);

      const intent = intentStep.success ? intentStep.data : { intent: 'UNKNOWN' as QueryIntent, confidence: 0.1 };

      // Step 5: Context Retrieval
      const contextStep = await this.executeStep('context_retrieval', async () => {
        return await this.retrieveContext(businessId, request, intent);
      });
      processingMetrics.steps.push(contextStep);

      const contextSources = contextStep.success ? contextStep.data : null;

      // Step 6: Get Business Data
      const businessData = await this.getBusinessData(businessId);
      if (!businessData) {
        throw new Error('Business not found');
      }

      // Step 7: Build Enhanced Context for Phase 3C
      const businessContext: BusinessContext = {
        name: businessData.name,
        type: businessData.type,
        description: businessData.description,
        phone: businessData.phone,
        website: businessData.website,
        address: businessData.address,
        hours: businessData.hours,
        menu: businessData.menu,
        products: businessData.products,
        specialOffers: businessData.specialOffers,
        customInstructions: businessData.customInstructions
      };

      const conversationHistory: ConversationHistory[] = [];
      if (contextSources?.conversation?.history) {
        contextSources.conversation.history.forEach((msg: any) => {
          conversationHistory.push({
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            intent: msg.intent
          });
        });
      }

      const relevantContext: string[] = [];
      if (contextSources?.business) {
        relevantContext.push(`Business Info: ${contextSources.business.name} - ${contextSources.business.description}`);
      }
      if (contextSources?.menu) {
        relevantContext.push(`Menu Items: ${contextSources.menu.items.map((item: any) => item.name).join(', ')}`);
      }
      if (contextSources?.hours) {
        relevantContext.push(`Hours: ${contextSources.hours.currentStatus} - ${contextSources.hours.todayHours}`);
      }

      const enhancedContext = {
        business: businessContext,
        conversationHistory,
        currentQuery: request.query,
        detectedIntent: intent.intent,
        relevantContext,
        customerPreferences: contextSources?.conversation?.userPreferences || [],
        sessionMetadata: {
          sessionId: session.sessionId,
          turnCount: conversationHistory.length + 1
        },
        customerContext: {
          is_returning: conversationHistory.length > 0,
          preferences: contextSources?.conversation?.userPreferences || {},
          history: conversationHistory
        },
        conversationContext: {
          session_id: session.sessionId,
          turn_count: conversationHistory.length + 1,
          previous_topics: conversationHistory.map(h => h.intent || 'unknown')
        },
        businessContext: {
          current_hours: businessData.hours?.currentStatus || 'unknown',
          inventory_status: businessData.menu?.items || [],
          promotions: businessData.specialOffers || []
        }
      };

      // Step 8: Start Enhanced Streaming with Phase 3C Features
      const enhancedStream = this.enhancedStreamingManager.startEnhancedStreaming(businessId, request, enhancedContext);
      
      for await (const event of enhancedStream) {
        yield event;
      }

      // Step 9: Log analytics
      if (this.config.enableAnalytics) {
        await this.analyticsLogger.logQuery(
          businessId,
          session.sessionId,
          request,
          intent,
          contextSources,
          { response: { text: 'Enhanced streaming response completed' } },
          processingMetrics,
          userAgent,
          ipAddress
        );
      }

    } catch (error) {
      processingMetrics.endTime = new Date();
      processingMetrics.duration = processingMetrics.endTime.getTime() - processingMetrics.startTime.getTime();

      // Log error
      if (this.config.enableAnalytics) {
        await this.analyticsLogger.logError(
          businessId,
          request.sessionId || 'unknown',
          error as Error,
          { query: request.query, processingMetrics }
        );
      }

      // Yield error event
      yield {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };
    }
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
   * Generate placeholder response based on intent
   */
  private generatePlaceholderResponse(intent: QueryIntent, contextSources: ContextSources | null): string {
    switch (intent) {
      case 'MENU_INQUIRY':
        return "I'd be happy to help you with our menu! Let me find the most relevant information for you.";
      case 'HOURS_POLICY':
        return "I can help you with our hours and policies. Let me get that information for you.";
      case 'PRICING_QUESTION':
        return "I'll help you find pricing information for our items.";
      case 'DIETARY_RESTRICTIONS':
        return "I can help you find options that meet your dietary needs.";
      case 'LOCATION_INFO':
        return "Let me provide you with our location and delivery information.";
      case 'GENERAL_CHAT':
        return "Hello! How can I help you today?";
      case 'COMPLAINT_FEEDBACK':
        return "I'm sorry to hear about your experience. Let me help you with that.";
      default:
        return "I'm here to help! Could you please provide more details about what you're looking for?";
    }
  }

  /**
   * Generate follow-up suggestions based on intent
   */
  private generateSuggestions(intent: QueryIntent): string[] {
    switch (intent) {
      case 'MENU_INQUIRY':
        return [
          "What are your most popular items?",
          "Do you have any specials today?",
          "What ingredients do you use?"
        ];
      case 'HOURS_POLICY':
        return [
          "What are your delivery hours?",
          "Do you offer pickup?",
          "What's your cancellation policy?"
        ];
      case 'PRICING_QUESTION':
        return [
          "Are there any deals available?",
          "What's included in the price?",
          "Do you offer group discounts?"
        ];
      case 'DIETARY_RESTRICTIONS':
        return [
          "What vegan options do you have?",
          "Are your items gluten-free?",
          "Do you accommodate allergies?"
        ];
      case 'LOCATION_INFO':
        return [
          "What's your delivery radius?",
          "How long does delivery take?",
          "Do you have multiple locations?"
        ];
      default:
        return [
          "Tell me more about your menu",
          "What are your hours?",
          "How can I place an order?"
        ];
    }
  }

  /**
   * Extract source IDs from context
   */
  private extractSourceIds(contextSources: ContextSources | null): string[] {
    if (!contextSources) return [];

    const sources: string[] = [];
    
    sources.push(...contextSources.embeddings.menuItems.map(item => item.id));
    sources.push(...contextSources.embeddings.policies.map(item => item.id));
    sources.push(...contextSources.embeddings.faqs.map(item => item.id));

    return sources;
  }

  /**
   * Get context source types
   */
  private getContextSourceTypes(contextSources: ContextSources | null): string[] {
    if (!contextSources) return [];

    const types: string[] = [];
    
    if (contextSources.embeddings.menuItems.length > 0) types.push('menu');
    if (contextSources.embeddings.policies.length > 0) types.push('policies');
    if (contextSources.embeddings.faqs.length > 0) types.push('faqs');
    if (contextSources.businessData) types.push('business_data');
    if (contextSources.conversation.history.length > 0) types.push('conversation');

    return types;
  }

  /**
   * Get business data
   */
  private async getBusinessData(businessId: string): Promise<any> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: {
          name: true,
          description: true,
          phone: true,
          website: true,
          timezone: true
        }
      });

      if (!business) {
        throw new Error('Business not found');
      }

      // Get location data
      const location = await this.prisma.location.findFirst({
        where: { businessId },
        select: {
          address: true,
          city: true,
          state: true,
          zipCode: true
        }
      });

      return {
        basicInfo: {
          name: business.name,
          cuisine: business.description || 'Restaurant',
          description: business.description || '',
          phone: business.phone,
          website: business.website
        },
        operatingHours: {
          isOpen: true, // Simplified for Phase 3A
          currentStatus: 'Open',
          todayHours: '9:00 AM - 10:00 PM',
          timezone: business.timezone
        },
        location: location ? {
          address: location.address,
          city: location.city,
          state: location.state,
          zipCode: location.zipCode
        } : {
          address: '',
          city: '',
          state: '',
          zipCode: ''
        },
        specials: []
      };
    } catch (error) {
      console.error('Error getting business data:', error);
      return {
        basicInfo: { name: '', cuisine: '', description: '' },
        operatingHours: { isOpen: false, currentStatus: '', todayHours: '', timezone: 'UTC' },
        location: { address: '', city: '', state: '', zipCode: '' },
        specials: []
      };
    }
  }

  /**
   * Log query for analytics
   */
  private async logQuery(
    businessId: string,
    sessionId: string,
    request: QueryRequest,
    intent: { intent: QueryIntent; confidence: number },
    contextSources: ContextSources | null,
    response: QueryResponse,
    processingMetrics: ProcessingMetrics,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.analyticsLogger.logQuery({
      businessId,
      sessionId,
      queryText: request.query,
      intentDetected: intent.intent,
      contextRetrieved: contextSources ? {
        menuItems: contextSources.embeddings.menuItems.length,
        policies: contextSources.embeddings.policies.length,
        faqs: contextSources.embeddings.faqs.length,
        conversationHistory: contextSources.conversation.history.length
      } : undefined,
      responseGenerated: response.response.text,
      processingTimeMs: processingMetrics.duration,
      confidenceScore: intent.confidence,
      status: 'SUCCESS',
      userAgent,
      ipAddress,
      metadata: {
        contextSources: response.metadata.contextSources,
        processingSteps: processingMetrics.steps.length
      },
      processingMetrics
    });
  }

  /**
   * Get processor statistics
   */
  async getProcessorStats(businessId: string): Promise<{
    totalQueries: number;
    averageProcessingTime: number;
    successRate: number;
    intentDistribution: Record<QueryIntent, number>;
  }> {
    const analytics = await this.analyticsLogger.getQueryAnalytics(businessId);
    
    return {
      totalQueries: analytics.totalQueries,
      averageProcessingTime: analytics.averageProcessingTime,
      successRate: analytics.successfulQueries / analytics.totalQueries,
      intentDistribution: analytics.intentDistribution
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.maxProcessingTimeMs < 1000 || this.config.maxProcessingTimeMs > 30000) {
      errors.push('maxProcessingTimeMs must be between 1000 and 30000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===== SINGLETON INSTANCE =====
let queryProcessorInstance: QueryProcessor | null = null;

export function getQueryProcessor(
  prisma?: PrismaClient,
  config?: Partial<QueryProcessorConfig>,
  services?: {
    validationService?: any;
    intentDetector?: any;
    conversationManager?: any;
    analyticsLogger?: any;
    contextRetriever?: any;
    cacheManager?: any;
    llmService?: LLMService;
    promptBuilder?: PromptBuilder;
    responseProcessor?: ResponseProcessor;
    streamingManager?: StreamingManager;
    businessRulesEngine?: BusinessRulesEngine;
    responseTemplateEngine?: ResponseTemplateEngine;
    enhancedStreamingManager?: EnhancedStreamingManager;
  }
): QueryProcessor {
  if (!queryProcessorInstance) {
    if (!prisma) {
      throw new Error('PrismaClient instance is required for first initialization');
    }
    queryProcessorInstance = new QueryProcessor(prisma, config, services);
  }
  return queryProcessorInstance;
}
