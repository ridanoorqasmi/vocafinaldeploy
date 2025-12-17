// ===== TEXT CHUNKING SERVICE =====

export interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
}

/**
 * Split text into chunks for embedding
 * Uses overlapping chunks to preserve context
 */
export function splitText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;
  const minChunkSize = 50; // Minimum chunk size to avoid tiny chunks

  // Clean and normalize text
  const normalizedText = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .trim();

  while (startIndex < normalizedText.length) {
    let endIndex = Math.min(startIndex + chunkSize, normalizedText.length);

    // Try to break at sentence boundaries for better chunk quality
    if (endIndex < normalizedText.length) {
      // Look for sentence endings within the last 20% of the chunk
      const searchStart = Math.max(startIndex, endIndex - chunkSize * 0.2);
      const sentenceEnd = normalizedText.lastIndexOf('. ', endIndex);
      const paragraphEnd = normalizedText.lastIndexOf('\n\n', endIndex);

      // Prefer paragraph breaks, then sentence breaks
      if (paragraphEnd > searchStart) {
        endIndex = paragraphEnd + 2;
      } else if (sentenceEnd > searchStart) {
        endIndex = sentenceEnd + 2;
      }
    }

    const chunkContent = normalizedText.slice(startIndex, endIndex).trim();

    // Only add chunk if it meets minimum size requirement
    if (chunkContent.length >= minChunkSize) {
      chunks.push({
        content: chunkContent,
        index: chunkIndex,
        startChar: startIndex,
        endChar: endIndex
      });
      chunkIndex++;
    }

    // Move start index forward with overlap, but ensure we make progress
    const nextStart = endIndex - overlap;
    if (nextStart <= startIndex) {
      // Prevent infinite loop - move forward at least by 1
      startIndex = startIndex + 1;
    } else {
      startIndex = nextStart;
    }

    // Safety check: if we're not making progress, break
    if (startIndex >= normalizedText.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}



