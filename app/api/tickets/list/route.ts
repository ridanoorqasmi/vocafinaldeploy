// ===== LIST SUPPORT TICKETS API =====
// Phase 3: List all tickets for a tenant

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

/**
 * GET /api/tickets/list - List all tickets for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status'); // Optional filter

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: tickets
    });

  } catch (error: any) {
    console.error('List tickets error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list tickets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


