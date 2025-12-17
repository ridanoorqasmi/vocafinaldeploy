// ===== CHAT MESSAGE API =====

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, text, tenantId } = body;

    if (!conversationId || !text || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'conversationId, text, and tenantId are required' },
        { status: 400 }
      );
    }

    // Verify conversation belongs to tenant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId
      }
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        sender: 'user',
        text
      }
    });

    // Query KB for answer - import and call directly instead of HTTP fetch
    let agentText = 'I apologize, but I could not find an answer to your question.';
    let score = 0;

    try {
      const { generateEmbedding } = await import('@/lib/services/kb/generateEmbedding');
      const { cosineSimilarity } = await import('@/lib/openai-client');
      const { getPrismaClient } = await import('@/lib/prisma');
      const kbPrisma = getPrismaClient();

      // Generate embedding for the question
      const questionEmbedding = await generateEmbedding(text);

      // Get all chunks for the tenant
      const chunks = await kbPrisma.kbChunk.findMany({
        where: { tenantId },
        select: {
          id: true,
          content: true,
          embedding: true
        }
      });

      if (chunks.length > 0) {
        // Calculate similarity scores
        const similarities = chunks.map(chunk => ({
          chunk,
          similarity: cosineSimilarity(questionEmbedding, chunk.embedding as number[])
        }));

        // Sort by similarity (highest first)
        similarities.sort((a, b) => b.similarity - a.similarity);

        // Get best match
        const bestMatch = similarities[0];
        if (bestMatch) {
          agentText = bestMatch.chunk.content;
          score = bestMatch.similarity;
        }
      }
    } catch (error) {
      console.error('KB query error in chat message:', error);
      // Use default error message
    }

    // Save agent message
    const agentMessage = await prisma.message.create({
      data: {
        conversationId,
        sender: 'agent',
        text: agentText
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        messageId: agentMessage.id,
        text: agentText,
        score
      }
    });

  } catch (error: any) {
    console.error('Chat message error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

