// ===== EMBEDDING TYPES & INTERFACES =====

export type EmbeddingType = 'MENU' | 'POLICY' | 'FAQ' | 'BUSINESS';

export interface Embedding {
  id: string;
  businessId: string;
  contentType: EmbeddingType;
  contentId: string;
  content: string;
  embedding: number[]; // Array of 1536 floats for OpenAI embeddings
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateEmbeddingRequest {
  contentType: EmbeddingType;
  contentId: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface UpdateEmbeddingRequest {
  content?: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface EmbeddingSearchRequest {
  query: string;
  contentType?: EmbeddingType;
  limit?: number;
  threshold?: number; // Similarity threshold (0-1)
}

export interface EmbeddingSearchResult {
  embedding: Embedding;
  similarity: number;
  score: number;
}

export interface EmbeddingSearchResponse {
  success: boolean;
  data?: {
    results: EmbeddingSearchResult[];
    total: number;
    query: string;
    contentType?: EmbeddingType;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface EmbeddingListRequest {
  contentType?: EmbeddingType;
  contentId?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

export interface EmbeddingListResponse {
  success: boolean;
  data?: {
    embeddings: Embedding[];
    total: number;
    hasMore: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface EmbeddingCreateResponse {
  success: boolean;
  data?: {
    embedding: Embedding;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface EmbeddingUpdateResponse {
  success: boolean;
  data?: {
    embedding: Embedding;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface EmbeddingDeleteResponse {
  success: boolean;
  data?: {
    deleted: boolean;
    id: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ===== EMBEDDING METADATA INTERFACES =====

export interface MenuEmbeddingMetadata {
  menuItemId: string;
  categoryId?: string;
  price?: number;
  allergens?: string[];
  calories?: number;
  prepTime?: number;
}

export interface PolicyEmbeddingMetadata {
  policyId: string;
  type: string;
  title: string;
  effectiveDate: Date;
}

export interface FAQEmbeddingMetadata {
  faqId: string;
  category?: string;
  tags?: string[];
  viewCount?: number;
}

export interface BusinessEmbeddingMetadata {
  businessId: string;
  name: string;
  description?: string;
  industry?: string;
  location?: string;
}

// ===== ERROR CODES =====
export const EMBEDDING_ERRORS = {
  EMBEDDING_NOT_FOUND: 'EMBEDDING_NOT_FOUND',
  INVALID_EMBEDDING_DIMENSION: 'INVALID_EMBEDDING_DIMENSION',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
  DUPLICATE_EMBEDDING: 'DUPLICATE_EMBEDDING',
  SEARCH_FAILED: 'SEARCH_FAILED',
  INVALID_SIMILARITY_THRESHOLD: 'INVALID_SIMILARITY_THRESHOLD',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  EMBEDDING_GENERATION_FAILED: 'EMBEDDING_GENERATION_FAILED',
  INVALID_METADATA: 'INVALID_METADATA',
  BUSINESS_NOT_FOUND: 'BUSINESS_NOT_FOUND',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT: 'INVALID_INPUT'
} as const;

export const EMBEDDING_ERROR_MESSAGES = {
  [EMBEDDING_ERRORS.EMBEDDING_NOT_FOUND]: 'Embedding not found',
  [EMBEDDING_ERRORS.INVALID_EMBEDDING_DIMENSION]: 'Embedding must have exactly 1536 dimensions',
  [EMBEDDING_ERRORS.INVALID_CONTENT_TYPE]: 'Invalid content type. Must be MENU, POLICY, FAQ, or BUSINESS',
  [EMBEDDING_ERRORS.DUPLICATE_EMBEDDING]: 'Embedding already exists for this content',
  [EMBEDDING_ERRORS.SEARCH_FAILED]: 'Embedding search failed',
  [EMBEDDING_ERRORS.INVALID_SIMILARITY_THRESHOLD]: 'Similarity threshold must be between 0 and 1',
  [EMBEDDING_ERRORS.CONTENT_TOO_LONG]: 'Content exceeds maximum length limit',
  [EMBEDDING_ERRORS.EMBEDDING_GENERATION_FAILED]: 'Failed to generate embedding from content',
  [EMBEDDING_ERRORS.INVALID_METADATA]: 'Invalid metadata format',
  [EMBEDDING_ERRORS.BUSINESS_NOT_FOUND]: 'Business not found or access denied',
  [EMBEDDING_ERRORS.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this operation',
  [EMBEDDING_ERRORS.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later',
  [EMBEDDING_ERRORS.INVALID_INPUT]: 'Invalid input provided'
} as const;

// ===== EMBEDDING CONFIGURATION =====
export const EMBEDDING_CONFIG = {
  // OpenAI text-embedding-ada-002 model dimensions
  dimensions: 1536,
  
  // Content length limits
  maxContentLength: 8000, // OpenAI's token limit for ada-002
  
  // Search configuration
  defaultSearchLimit: 10,
  maxSearchLimit: 100,
  defaultSimilarityThreshold: 0.7,
  
  // Batch processing
  batchSize: 100,
  maxBatchSize: 1000,
  
  // Cache configuration
  cacheExpirationMinutes: 60,
  
  // Rate limiting
  requestsPerMinute: 60,
  requestsPerHour: 1000
} as const;

// ===== UTILITY TYPES =====
export type EmbeddingWithSimilarity = Embedding & {
  similarity: number;
};

export type EmbeddingBatch = {
  contentType: EmbeddingType;
  contentId: string;
  content: string;
  metadata?: Record<string, any>;
}[];

export type EmbeddingBatchResult = {
  success: boolean;
  created: number;
  failed: number;
  errors: Array<{
    contentId: string;
    error: string;
  }>;
};

// ===== VALIDATION HELPERS =====
export const validateEmbeddingDimension = (embedding: number[]): boolean => {
  return embedding.length === EMBEDDING_CONFIG.dimensions;
};

export const validateContentType = (contentType: string): contentType is EmbeddingType => {
  return ['MENU', 'POLICY', 'FAQ', 'BUSINESS'].includes(contentType);
};

export const validateContentLength = (content: string): boolean => {
  return content.length <= EMBEDDING_CONFIG.maxContentLength;
};

export const validateSimilarityThreshold = (threshold: number): boolean => {
  return threshold >= 0 && threshold <= 1;
};
