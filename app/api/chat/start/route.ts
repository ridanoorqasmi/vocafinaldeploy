// ===== CHAT CONVERSATION START API =====

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

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

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id
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



