// ===== KB QUERY API =====

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/services/kb/generateEmbedding';
import { cosineSimilarity } from '@/lib/openai-client';

const prisma = getPrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, tenantId } = body;

    if (!question || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'question and tenantId are required' },
        { status: 400 }
      );
    }

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);

    // Get all chunks for the tenant
    const chunks = await (prisma as any).kbChunk.findMany({
      where: { tenantId },
      select: {
        id: true,
        content: true,
        embedding: true
      }
    });

    console.log('Found chunks:', chunks.length);
    if (chunks.length > 0) {
      console.log('First chunk sample:', {
        id: chunks[0].id,
        contentLength: chunks[0].content?.length || 0,
        contentPreview: chunks[0].content?.substring(0, 50) || 'EMPTY',
        hasEmbedding: !!chunks[0].embedding,
        embeddingType: typeof chunks[0].embedding,
        isArray: Array.isArray(chunks[0].embedding)
      });
    }

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          answer: 'No knowledge base content available.',
          score: 0
        }
      });
    }

    // Calculate similarity scores
    const similarities = chunks.map((chunk: any) => {
      // Ensure embedding is an array
      let embeddingArray: number[];
      if (Array.isArray(chunk.embedding)) {
        embeddingArray = chunk.embedding as number[];
      } else if (typeof chunk.embedding === 'string') {
        // Handle case where embedding might be stored as JSON string
        embeddingArray = JSON.parse(chunk.embedding);
      } else {
        console.error('Invalid embedding format for chunk:', chunk.id);
        return null;
      }

      try {
        const similarity = cosineSimilarity(questionEmbedding, embeddingArray);
        return {
          chunk,
          similarity
        };
      } catch (error) {
        console.error('Error calculating similarity for chunk:', chunk.id, error);
        return null;
      }
    }).filter((item: any): item is { chunk: any; similarity: number } => item !== null);

    if (similarities.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          answer: 'No valid chunks found for similarity calculation.',
          score: 0
        }
      });
    }

    // Sort by similarity (highest first)
    similarities.sort((a: any, b: any) => b.similarity - a.similarity);

    // Filter out chunks with very small content (likely artifacts from chunking)
    const validSimilarities = similarities.filter((item: any) => {
      const content = item.chunk.content?.trim() || '';
      return content.length >= 50; // Minimum 50 characters for meaningful content
    });

    if (validSimilarities.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          answer: 'No matching content found in knowledge base.',
          score: 0
        }
      });
    }

    // Get top 5 results from valid chunks
    const topResults = validSimilarities.slice(0, 5);
    const bestMatch = topResults[0];

    // Ensure we have content
    if (!bestMatch || !bestMatch.chunk.content || bestMatch.chunk.content.trim().length === 0) {
      console.error('Best match has no content:', bestMatch);
      return NextResponse.json({
        success: true,
        data: {
          answer: 'No matching content found in knowledge base.',
          score: 0
        }
      });
    }

    // Log for debugging
    const answerContent = bestMatch.chunk.content?.trim() || '';
    console.log('Query result:', {
      question,
      bestMatchContentLength: answerContent.length,
      bestMatchContentPreview: answerContent.substring(0, 100),
      similarity: bestMatch.similarity,
      rawContent: bestMatch.chunk.content,
      contentType: typeof bestMatch.chunk.content,
      isNull: bestMatch.chunk.content === null,
      isUndefined: bestMatch.chunk.content === undefined
    });

    // Return the best matching chunk
    return NextResponse.json({
      success: true,
      data: {
        answer: answerContent || 'No content available in the matching chunk.',
        score: bestMatch.similarity,
        topResults: topResults.map((r: any) => ({
          content: r.chunk.content || '',
          score: r.similarity
        }))
      }
    });

  } catch (error: any) {
    console.error('KB query error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query knowledge base',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



