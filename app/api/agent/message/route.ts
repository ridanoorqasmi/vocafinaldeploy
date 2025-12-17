// ===== UNIFIED AGENT MESSAGE ROUTER =====
// Phase 3: Routes messages to KB, DB lookup, or escalation based on intent

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { classifyIntent, IntentType } from '@/lib/services/agent/intentClassifier';
import {
  formatKbResponse,
  formatDbResponse,
  formatEscalationResponse,
  formatGreetingResponse,
  formatFallbackResponse
} from '@/lib/services/agent/responseFormatter';

const prisma = getPrismaClient();

/**
 * POST /api/agent/message - Unified agent message router
 * Routes messages based on intent classification
 */
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
    await prisma.message.create({
      data: {
        conversationId,
        sender: 'user',
        text
      }
    });

    // Classify intent
    const intentResult = classifyIntent(text);
    const { intent, extractedValue } = intentResult;

    let formattedResponse;
    let ticketId: string | undefined;

    // Route based on intent
    switch (intent) {
      case 'greeting':
        formattedResponse = formatGreetingResponse();
        break;

      case 'kb_question':
        formattedResponse = await handleKbQuery(text, tenantId);
        break;

      case 'db_lookup':
        formattedResponse = await handleDbLookup(tenantId, extractedValue || text);
        break;

      case 'action_request':
      case 'complaint':
        // Escalate and create ticket
        ticketId = await createSupportTicket(tenantId, conversationId, intent, text);
        formattedResponse = formatEscalationResponse(intent, ticketId);
        break;

      case 'fallback':
      default:
        formattedResponse = formatFallbackResponse();
        break;
    }

    // Save agent response
    await prisma.message.create({
      data: {
        conversationId,
        sender: 'agent',
        text: formattedResponse.text
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        text: formattedResponse.text,
        intent,
        metadata: formattedResponse.metadata,
        ticketId
      }
    });

  } catch (error: any) {
    console.error('Agent message error:', error);
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

/**
 * Handle KB query by calling existing KB query logic internally
 */
async function handleKbQuery(question: string, tenantId: string) {
  try {
    const { generateEmbedding } = await import('@/lib/services/kb/generateEmbedding');
    const { cosineSimilarity } = await import('@/lib/openai-client');
    const kbPrisma = getPrismaClient();

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);

    // Get all chunks for the tenant
    const chunks = await kbPrisma.kbChunk.findMany({
      where: { tenantId },
      select: {
        id: true,
        content: true,
        embedding: true
      }
    });

    if (chunks.length === 0) {
      return formatKbResponse(null, 0);
    }

    // Calculate similarity scores
    const similarities = chunks
      .map((chunk: any) => {
        let embeddingArray: number[];
        if (Array.isArray(chunk.embedding)) {
          embeddingArray = chunk.embedding as number[];
        } else if (typeof chunk.embedding === 'string') {
          embeddingArray = JSON.parse(chunk.embedding);
        } else {
          return null;
        }

        try {
          const similarity = cosineSimilarity(questionEmbedding, embeddingArray);
          return {
            chunk,
            similarity
          };
        } catch (error) {
          console.error('Error calculating similarity:', error);
          return null;
        }
      })
      .filter((item: any): item is { chunk: any; similarity: number } => item !== null);

    if (similarities.length === 0) {
      return formatKbResponse(null, 0);
    }

    // Sort by similarity (highest first)
    similarities.sort((a: any, b: any) => b.similarity - a.similarity);

    // Filter out chunks with very small content
    const validSimilarities = similarities.filter((item: any) => {
      const content = item.chunk.content?.trim() || '';
      return content.length >= 50;
    });

    if (validSimilarities.length === 0) {
      return formatKbResponse(null, 0);
    }

    // Get best match
    const bestMatch = validSimilarities[0];
    if (!bestMatch || !bestMatch.chunk.content || bestMatch.chunk.content.trim().length === 0) {
      return formatKbResponse(null, 0);
    }

    const answerContent = bestMatch.chunk.content.trim();
    return formatKbResponse(answerContent, bestMatch.similarity);

  } catch (error) {
    console.error('KB query error in agent router:', error);
    return formatKbResponse(null, 0);
  }
}

/**
 * Handle DB lookup by calling existing DB query logic internally
 */
async function handleDbLookup(tenantId: string, identifierValue: string) {
  try {
    const { queryRecord, validateTableMapping } = await import('@/lib/services/db/queryRecord');
    const { DatabaseConfig } = await import('@/lib/services/db/connection');
    const { decryptPassword } = await import('@/lib/services/db/encryption');
    const dbPrisma = getPrismaClient();

    // Get database configuration
    const dbConfig = await (dbPrisma as any).tenantDatabaseConfig.findUnique({
      where: { tenantId }
    });

    if (!dbConfig) {
      return formatDbResponse(null, identifierValue);
    }

    // Get table mapping
    const mapping = await (dbPrisma as any).tenantTableMapping.findUnique({
      where: { tenantId }
    });

    if (!mapping) {
      return formatDbResponse(null, identifierValue);
    }

    // Validate mapping structure
    const mappingValidation = validateTableMapping({
      tableName: mapping.tableName,
      primaryKeyColumn: mapping.primaryKeyColumn,
      displayFields: mapping.displayFields
    });

    if (!mappingValidation.valid) {
      return formatDbResponse(null, identifierValue);
    }

    // Prepare database config
    const dbConfigForQuery: DatabaseConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password, // Encrypted, will be decrypted in connection service
      database: dbConfig.database
    };

    // Prepare mapping
    const tableMapping = {
      tableName: mapping.tableName!,
      primaryKeyColumn: mapping.primaryKeyColumn!,
      displayFields: mapping.displayFields as string[]
    };

    // Execute read-only query
    const result = await queryRecord(
      dbConfigForQuery,
      tableMapping,
      String(identifierValue)
    );

    if (!result.success || !result.data) {
      return formatDbResponse(null, identifierValue);
    }

    return formatDbResponse(result.data, identifierValue);

  } catch (error) {
    console.error('DB lookup error in agent router:', error);
    return formatDbResponse(null, identifierValue);
  }
}

/**
 * Create support ticket for escalation
 */
async function createSupportTicket(
  tenantId: string,
  conversationId: string | null,
  intent: IntentType,
  userMessage: string
): Promise<string> {
  try {
    // Generate ticket title from intent and message
    const title = intent === 'action_request'
      ? `Action Request: ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`
      : `Complaint: ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId,
        conversationId,
        title,
        description: userMessage,
        status: 'open'
      }
    });

    return ticket.id;
  } catch (error) {
    console.error('Error creating support ticket:', error);
    // Return empty string if ticket creation fails (non-blocking)
    return '';
  }
}


