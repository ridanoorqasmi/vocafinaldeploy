// ===== CHAT CONVERSATION START API =====
// Phase 4: Business-level chat isolation with session management

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { createChatSession } from '@/lib/services/chat/sessionService';

const prisma = getPrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        tenantId
      }
    });

    // Create chat session (validates business chat config)
    const sessionResult = await createChatSession(tenantId, conversation.id);

    if (!sessionResult.success) {
      // Clean up conversation if session creation failed
      await prisma.conversation.delete({
        where: { id: conversation.id }
      }).catch(() => {
        // Ignore cleanup errors
      });

      return NextResponse.json(
        {
          success: false,
          error: sessionResult.error || 'Failed to create chat session'
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        chatSessionId: sessionResult.session?.id
      }
    });

  } catch (error: any) {
    console.error('Chat start error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



