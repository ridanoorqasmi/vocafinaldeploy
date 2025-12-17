// ===== EMBEDDING GENERATION SERVICE FOR KB =====

import { getEmbedding, getEmbeddings } from '../../openai-client';

/**
 * Generate embedding for a text chunk
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  try {
    const embedding = await getEmbedding(text);
    
    // Validate embedding dimensions
    if (!embedding || embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding?.length || 0}`);
    }

    return embedding;
  } catch (error) {
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple text chunks in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    const embeddings = await getEmbeddings(texts);
    return embeddings;
  } catch (error) {
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

