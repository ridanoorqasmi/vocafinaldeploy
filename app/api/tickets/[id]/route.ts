// ===== SUPPORT TICKET DETAILS API =====
// Phase 3: Get and update ticket details

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

/**
 * GET /api/tickets/:id - Get ticket details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ticket
    });

  } catch (error: any) {
    console.error('Get ticket error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get ticket',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tickets/:id - Update ticket (status or assignedTo)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, assignedTo } = body;

    // Validate status if provided
    if (status && !['open', 'in_progress', 'resolved'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be: open, in_progress, or resolved' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
    }
    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      data: ticket
    });

  } catch (error: any) {
    console.error('Update ticket error:', error);
    
    // Handle not found
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update ticket',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


