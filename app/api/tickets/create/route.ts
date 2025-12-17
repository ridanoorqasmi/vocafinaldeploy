// ===== CREATE SUPPORT TICKET API =====
// Phase 3: Create a new support ticket

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

/**
 * POST /api/tickets/create - Create a new support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, conversationId, title, description } = body;

    if (!tenantId || !title) {
      return NextResponse.json(
        { success: false, error: 'tenantId and title are required' },
        { status: 400 }
      );
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId,
        conversationId: conversationId || null,
        title,
        description: description || null,
        status: 'open'
      }
    });

    return NextResponse.json({
      success: true,
      data: ticket
    });

  } catch (error: any) {
    console.error('Create ticket error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create ticket',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


