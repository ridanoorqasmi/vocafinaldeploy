import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/agents/order-taking/[id]/launch - Launch agent
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Launching order-taking agent:', params.id);
    
    const body = await request.json();
    const { businessId } = body;

    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'Business ID is required'
      }, { status: 400 });
    }

    // Activate the agent
    const agent = await prisma.orderTakingAgent.update({
      where: { id: params.id },
      data: {
        isActive: true,
        launchedAt: new Date()
      },
      include: {
        menuItems: true,
        operatingHours: true,
        policies: true,
        locations: true
      }
    });

    console.log('Agent launched successfully:', agent.id);

    return NextResponse.json({
      success: true,
      data: agent,
      message: 'Order-taking agent is now active and ready to help customers!'
    });

  } catch (error) {
    console.error('Launch agent error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to launch agent'
    }, { status: 500 });
  }
}
