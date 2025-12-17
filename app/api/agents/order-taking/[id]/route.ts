import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PUT /api/agents/order-taking/[id] - Update agent
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Updating order-taking agent:', params.id);
    
    const body = await request.json();
    const { businessId, name, description, menuItems, operatingHours, policies, locations } = body;

    if (!businessId || !name || !description) {
      return NextResponse.json({
        success: false,
        error: 'Business ID, name, and description are required'
      }, { status: 400 });
    }

    // Update the agent
    const agent = await prisma.orderTakingAgent.update({
      where: { id: params.id },
      data: {
        name,
        description,
        menuItems: {
          deleteMany: {},
          create: menuItems.map((item: any) => ({
            name: item.name,
            description: item.description,
            price: item.price,
            isAvailable: item.isAvailable || true
          }))
        },
        operatingHours: {
          deleteMany: {},
          create: operatingHours.map((hours: any) => ({
            dayOfWeek: hours.dayOfWeek,
            openTime: hours.openTime,
            closeTime: hours.closeTime,
            isClosed: hours.isClosed || false
          }))
        },
        policies: {
          deleteMany: {},
          create: policies.map((policy: any) => ({
            title: policy.title,
            type: policy.type,
            content: policy.content
          }))
        },
        locations: {
          deleteMany: {},
          create: locations.map((location: any) => ({
            name: location.name,
            address: location.address,
            phone: location.phone
          }))
        }
      },
      include: {
        menuItems: true,
        operatingHours: true,
        policies: true,
        locations: true
      }
    });

    console.log('Agent updated successfully:', agent.id);

    return NextResponse.json({
      success: true,
      data: agent
    });

  } catch (error) {
    console.error('Update agent error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update agent'
    }, { status: 500 });
  }
}
