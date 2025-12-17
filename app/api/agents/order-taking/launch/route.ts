import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/agents/order-taking/launch - Launch agent by businessId
export async function POST(request: NextRequest) {
  try {
    console.log('Launching order-taking agent');
    
    const body = await request.json();
    const { businessId, name, description, menuItems, operatingHours, policies, locations } = body;

    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'Business ID is required'
      }, { status: 400 });
    }

    // Check if business exists
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return NextResponse.json({
        success: false,
        error: 'Business not found'
      }, { status: 404 });
    }

    // Normalize payload
    const menuItemsArr = Array.isArray(menuItems) ? menuItems : []
    const operatingHoursArr = Array.isArray(operatingHours) ? operatingHours : []
    const policiesArr = Array.isArray(policies) ? policies : []
    const locationsArr = Array.isArray(locations) ? locations : []

    // Find or create agent for this business
    let agent = await prisma.orderTakingAgent.findFirst({ 
      where: { businessId } 
    });

    if (agent) {
      // Update existing agent
      agent = await prisma.orderTakingAgent.update({
        where: { id: agent.id },
        data: {
          name: name || agent.name,
          description: description || agent.description,
          isActive: true,
          launchedAt: new Date(),
          menuItems: {
            deleteMany: {},
            create: menuItemsArr.map((item: any) => ({
              name: item.name,
              description: item.description || '',
              price: item.price ?? 0,
              isAvailable: item.isAvailable ?? true
            }))
          },
          operatingHours: {
            deleteMany: {},
            create: operatingHoursArr.map((hours: any) => ({
              dayOfWeek: hours.dayOfWeek ?? 0,
              openTime: hours.openTime ?? '09:00',
              closeTime: hours.closeTime ?? '17:00',
              isClosed: hours.isClosed ?? false
            }))
          },
          policies: {
            deleteMany: {},
            create: policiesArr.map((policy: any) => ({
              title: policy.title ?? 'Policy',
              type: policy.type ?? 'other',
              content: policy.content ?? ''
            }))
          },
          locations: {
            deleteMany: {},
            create: locationsArr.map((location: any) => ({
              name: location.name ?? 'Location',
              address: location.address ?? '',
              phone: location.phone ?? ''
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
    } else {
      // Create new agent
      agent = await prisma.orderTakingAgent.create({
        data: {
          businessId,
          name: name || 'Order Taking Agent',
          description: description || 'AI-powered order taking agent',
          isActive: true,
          launchedAt: new Date(),
          menuItems: {
            create: menuItemsArr.map((item: any) => ({
              name: item.name,
              description: item.description || '',
              price: item.price ?? 0,
              isAvailable: item.isAvailable ?? true
            }))
          },
          operatingHours: {
            create: operatingHoursArr.map((hours: any) => ({
              dayOfWeek: hours.dayOfWeek ?? 0,
              openTime: hours.openTime ?? '09:00',
              closeTime: hours.closeTime ?? '17:00',
              isClosed: hours.isClosed ?? false
            }))
          },
          policies: {
            create: policiesArr.map((policy: any) => ({
              title: policy.title ?? 'Policy',
              type: policy.type ?? 'other',
              content: policy.content ?? ''
            }))
          },
          locations: {
            create: locationsArr.map((location: any) => ({
              name: location.name ?? 'Location',
              address: location.address ?? '',
              phone: location.phone ?? ''
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
    }

    console.log('Agent launched successfully:', agent.id);

    return NextResponse.json({
      success: true,
      data: agent
    });

  } catch (error) {
    console.error('Launch agent error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to launch agent'
    }, { status: 500 });
  }
}
