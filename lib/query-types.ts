// ===== QUERY PROCESSING TYPES & INTERFACES =====

export type QueryIntent = 
  | 'MENU_INQUIRY'          // "What's your best pizza?"
  | 'HOURS_POLICY'          // "When do you close?"
  | 'PRICING_QUESTION'      // "How much is the burger?"
  | 'DIETARY_RESTRICTIONS'  // "Do you have vegan options?"
  | 'LOCATION_INFO'         // "Where are you located?"
  | 'GENERAL_CHAT'          // "Hello, how are you?"
  | 'COMPLAINT_FEEDBACK'    // "My order was wrong"
  | 'UNKNOWN';              // Fallback category

export interface QueryRequest {
  query: string;
  sessionId?: string;
  customerId?: string;
  preferences?: string[];
  context?: {
    location?: string;
    preferences?: string[];
    metadata?: Record<string, any>;
  };
}

export interface QueryResponse {
  response: {
    text: string;
    confidence: number;
    sources: string[];
    intent: QueryIntent;
    suggestions?: string[];
    processingTimeMs?: number;
    streamingAvailable?: boolean;
  };
  session: {
    sessionId: string;
    expiresAt: string;
    contextSummary: string;
    turnCount?: number;
  };
  usage?: {
    tokensUsed: number;
    costEstimate: number;
    remainingQuota: number;
  };
  metadata: {
    processingTimeMs: number;
    modelUsed?: string;
    temperature?: number;
    responseCached?: boolean;
    businessContextUsed?: string[];
    contextSources?: string[];
    tokensUsed?: number;
  };
}

export interface ContextSources {
  embeddings: {
    menuItems: ContextItem[];
    policies: ContextItem[];
    faqs: ContextItem[];
  };
  businessData: {
    basicInfo: BusinessInfo;
    operatingHours: OperatingHours;
    location: LocationInfo;
    specials: SpecialOffer[];
  };
  conversation: {
    history: ConversationMessage[];
    context: string;
    userPreferences: string[];
  };
}

export interface ContextItem {
  id: string;
  content: string;
  similarity: number;
  confidence: number;
  metadata?: Record<string, any>;
  textSnippet: string;
}

export interface BusinessInfo {
  name: string;
  cuisine: string;
  description: string;
  phone?: string;
  website?: string;
}

export interface OperatingHours {
  isOpen: boolean;
  currentStatus: string;
  todayHours: string;
  nextOpenTime?: string;
  timezone: string;
}

export interface LocationInfo {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  deliveryAreas?: string[];
}

export interface SpecialOffer {
  title: string;
  description: string;
  validUntil?: string;
  discount?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: QueryIntent;
}

export interface ConversationSession {
  id: string;
  businessId: string;
  sessionId: string;
  customerId?: string;
  customerIdentifier?: string;
  startedAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  contextSummary?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
}

export interface QueryLogEntry {
  id: string;
  businessId: string;
  conversationId?: string;
  sessionId?: string;
  queryText: string;
  intentDetected?: QueryIntent;
  contextRetrieved?: Record<string, any>;
  responseGenerated?: string;
  processingTimeMs?: number;
  tokenUsage?: number;
  confidenceScore?: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'RATE_LIMITED';
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ===== CONFIGURATION INTERFACES =====

export interface QueryProcessorConfig {
  maxQueryLength: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  contextSimilarityThreshold: number;
  contextMaxItems: number;
  sessionTimeoutMinutes: number;
  conversationHistoryLimit: number;
  contextWindowTokens: number;
  queryTimeoutMs: number;
}

export interface IntentDetectionConfig {
  confidenceThreshold: number;
  enableFallback: boolean;
  customIntents?: Record<string, string[]>;
}

export interface ContextRetrievalConfig {
  similarityThreshold: number;
  maxItemsPerSource: number;
  enableBusinessHours: boolean;
  enableMenuAvailability: boolean;
  enableConversationHistory: boolean;
}

// ===== ERROR TYPES =====

export interface QueryError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export const QUERY_ERRORS = {
  INVALID_INPUT: 'INVALID_INPUT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  CONTEXT_RETRIEVAL_FAILED: 'CONTEXT_RETRIEVAL_FAILED',
  INTENT_DETECTION_FAILED: 'INTENT_DETECTION_FAILED',
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
  BUSINESS_NOT_FOUND: 'BUSINESS_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export const QUERY_ERROR_MESSAGES = {
  [QUERY_ERRORS.INVALID_INPUT]: 'Invalid input provided',
  [QUERY_ERRORS.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please try again later.',
  [QUERY_ERRORS.SESSION_EXPIRED]: 'Session has expired. Please start a new conversation.',
  [QUERY_ERRORS.CONTEXT_RETRIEVAL_FAILED]: 'Failed to retrieve context information',
  [QUERY_ERRORS.INTENT_DETECTION_FAILED]: 'Failed to detect query intent',
  [QUERY_ERRORS.PROCESSING_TIMEOUT]: 'Query processing timed out',
  [QUERY_ERRORS.BUSINESS_NOT_FOUND]: 'Business not found or access denied',
  [QUERY_ERRORS.UNAUTHORIZED]: 'Authentication required',
  [QUERY_ERRORS.INTERNAL_ERROR]: 'Internal server error'
} as const;

// ===== VALIDATION SCHEMAS =====

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedQuery?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

// ===== ANALYTICS TYPES =====

export interface QueryAnalytics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageProcessingTime: number;
  averageConfidence: number;
  intentDistribution: Record<QueryIntent, number>;
  errorDistribution: Record<string, number>;
  topQueries: Array<{
    query: string;
    count: number;
    averageConfidence: number;
  }>;
}

export interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  averageQueriesPerSession: number;
  sessionCompletionRate: number;
}

// ===== UTILITY TYPES =====

export type QueryStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ProcessingMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  steps: Array<{
    name: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    success: boolean;
    error?: string;
  }>;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: Date;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

// ===== DEFAULT CONFIGURATIONS =====

export const DEFAULT_QUERY_CONFIG: QueryProcessorConfig = {
  maxQueryLength: parseInt(process.env.QUERY_MAX_LENGTH || '2000'),
  rateLimitPerMinute: parseInt(process.env.QUERY_RATE_LIMIT_PER_MINUTE || '60'),
  rateLimitPerHour: parseInt(process.env.QUERY_RATE_LIMIT_PER_HOUR || '1000'),
  contextSimilarityThreshold: parseFloat(process.env.CONTEXT_SIMILARITY_THRESHOLD || '0.7'),
  contextMaxItems: parseInt(process.env.CONTEXT_MAX_ITEMS || '10'),
  sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30'),
  conversationHistoryLimit: parseInt(process.env.CONVERSATION_HISTORY_LIMIT || '10'),
  contextWindowTokens: parseInt(process.env.CONTEXT_WINDOW_TOKENS || '4000'),
  queryTimeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS || '5000')
};

export const DEFAULT_INTENT_CONFIG: IntentDetectionConfig = {
  confidenceThreshold: 0.7,
  enableFallback: true,
  customIntents: {}
};

export const DEFAULT_CONTEXT_CONFIG: ContextRetrievalConfig = {
  similarityThreshold: 0.7,
  maxItemsPerSource: 5,
  enableBusinessHours: true,
  enableMenuAvailability: true,
  enableConversationHistory: true
};
