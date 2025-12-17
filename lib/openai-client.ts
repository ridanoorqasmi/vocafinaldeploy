// ===== OPENAI CLIENT CONFIGURATION =====

import OpenAI from 'openai';
import { EMBEDDING_CONFIG } from './embedding-types';

// OpenAI client configuration
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: parseInt(process.env.EMBEDDING_RETRY_ATTEMPTS || '3'),
  timeout: 30000, // 30 seconds timeout
});

// Get OpenAI client instance
export function getOpenAIClient(): OpenAI {
  return openai;
}

// Configuration constants
export const OPENAI_CONFIG = {
  model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
  maxTokens: parseInt(process.env.EMBEDDING_MAX_TOKENS || '8000'),
  batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '100'),
  retryAttempts: parseInt(process.env.EMBEDDING_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.EMBEDDING_RETRY_DELAY || '1000'),
  rateLimitRPM: parseInt(process.env.EMBEDDING_RATE_LIMIT_RPM || '3000'),
  dimensions: 1536, // text-embedding-ada-002 dimensions
} as const;

// Rate limiting state
let requestCount = 0;
let windowStart = Date.now();
const WINDOW_SIZE = 60000; // 1 minute

// Rate limiting function
export async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Reset window if needed
  if (now - windowStart >= WINDOW_SIZE) {
    requestCount = 0;
    windowStart = now;
  }
  
  // Check if we're at the rate limit
  if (requestCount >= OPENAI_CONFIG.rateLimitRPM) {
    const waitTime = WINDOW_SIZE - (now - windowStart);
    console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    requestCount = 0;
    windowStart = Date.now();
  }
  
  requestCount++;
}

// Exponential backoff retry function
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = OPENAI_CONFIG.retryAttempts,
  baseDelay: number = OPENAI_CONFIG.retryDelay
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.message.includes('invalid_api_key') || 
            error.message.includes('insufficient_quota') ||
            error.message.includes('billing_not_active')) {
          throw error;
        }
      }
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Validate OpenAI API key
export async function validateOpenAIKey(): Promise<boolean> {
  try {
    await withRetry(async () => {
      await openai.models.list();
    });
    return true;
  } catch (error) {
    console.error('OpenAI API key validation failed:', error);
    return false;
  }
}

// Get embedding for a single text
export async function getEmbedding(text: string): Promise<number[]> {
  await checkRateLimit();
  
  return withRetry(async () => {
    const response = await openai.embeddings.create({
      model: OPENAI_CONFIG.model,
      input: text,
    });
    
    return response.data[0].embedding;
  });
}

// Get embeddings for multiple texts (batch)
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  // Split into batches if needed
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += OPENAI_CONFIG.batchSize) {
    batches.push(texts.slice(i, i + OPENAI_CONFIG.batchSize));
  }
  
  const allEmbeddings: number[][] = [];
  
  for (const batch of batches) {
    await checkRateLimit();
    
    const batchEmbeddings = await withRetry(async () => {
      const response = await openai.embeddings.create({
        model: OPENAI_CONFIG.model,
        input: batch,
      });
      
      return response.data.map(item => item.embedding);
    });
    
    allEmbeddings.push(...batchEmbeddings);
  }
  
  return allEmbeddings;
}

// Calculate cosine similarity between two embeddings
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Calculate similarity score (0-1 scale)
export function calculateSimilarityScore(embedding1: number[], embedding2: number[]): number {
  const similarity = cosineSimilarity(embedding1, embedding2);
  // Convert from [-1, 1] to [0, 1] scale
  return (similarity + 1) / 2;
}

// Error types for better error handling
export class OpenAIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class RateLimitError extends OpenAIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'rate_limit_exceeded', 429, true);
    this.name = 'RateLimitError';
  }
}

export class InvalidAPIKeyError extends OpenAIError {
  constructor(message: string = 'Invalid OpenAI API key') {
    super(message, 'invalid_api_key', 401, false);
    this.name = 'InvalidAPIKeyError';
  }
}

export class QuotaExceededError extends OpenAIError {
  constructor(message: string = 'OpenAI quota exceeded') {
    super(message, 'quota_exceeded', 429, false);
    this.name = 'QuotaExceededError';
  }
}

