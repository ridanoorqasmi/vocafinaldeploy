import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/agents/order-taking - Fetch agent configuration
export async function GET(request: NextRequest) {
  try {
    console.log('Order-taking agent endpoint called');
    
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'Business ID is required'
      }, { status: 400 });
    }

    console.log('Business ID:', businessId);

    // Get business with agent configuration
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        orderTakingAgents: {
          where: { isActive: true },
          include: {
            menuItems: true,
            operatingHours: true,
            policies: true,
            locations: true
          }
        }
      }
    });

    if (!business) {
      console.log('Business not found for ID:', businessId);
      return NextResponse.json({
        success: false,
        error: 'Business not found'
      }, { status: 404 });
    }

    console.log('Business found:', business.name);

    // Return existing agent or create default structure
    const agent = business.orderTakingAgents[0] || {
      id: null,
      name: '',
      description: '',
      isActive: false,
      menuItems: [],
      operatingHours: [],
      policies: [],
      locations: []
    };

    return NextResponse.json({
      success: true,
      data: agent
    });

  } catch (error) {
    console.error('Order-taking agent error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch agent configuration'
    }, { status: 500 });
  }
}

// POST /api/agents/order-taking - Create new agent
export async function POST(request: NextRequest) {
  try {
    console.log('Creating order-taking agent');
    
    const body = await request.json();
    const { businessId, name, description, menuItems, operatingHours, policies, locations } = body;

    if (!businessId || !name || !description) {
      return NextResponse.json({
        success: false,
        error: 'Business ID, name, and description are required'
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

    // If an agent already exists for this business, update it instead of creating duplicates
    const existing = await prisma.orderTakingAgent.findFirst({ where: { businessId } })

    const agent = existing
      ? await prisma.orderTakingAgent.update({
          where: { id: existing.id },
          data: {
            name,
            description,
            isActive: false,
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
        })
      : await prisma.orderTakingAgent.create({
          data: {
            businessId,
            name,
            description,
            isActive: false,
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
        })

    console.log('Agent created successfully:', agent.id);

    return NextResponse.json({
      success: true,
      data: agent
    });

  } catch (error) {
    console.error('Create agent error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create agent'
    }, { status: 500 });
  }
}
