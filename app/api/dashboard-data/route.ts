import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('Dashboard data endpoint called');
    
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'Business ID is required'
      }, { status: 400 });
    }

    // Get basic business data
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true
          }
        },
        orders: {
          select: {
            id: true,
            status: true,
            totalPrice: true,
            createdAt: true
          }
        },
        menuItems: {
          select: {
            id: true,
            name: true,
            price: true,
            isAvailable: true
          }
        }
      }
    });

    if (!business) {
      return NextResponse.json({
        success: false,
        error: 'Business not found'
      }, { status: 404 });
    }

    // Calculate metrics
    const totalUsers = business.users.length;
    const activeUsers = business.users.filter(user => user.isActive).length;
    const totalOrders = business.orders.length;
    const totalRevenue = business.orders.reduce((sum, order) => sum + Number(order.totalPrice), 0);
    const totalMenuItems = business.menuItems.length;
    const availableMenuItems = business.menuItems.filter(item => item.isAvailable).length;

    // Get recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentOrders = business.orders.filter(order => 
      new Date(order.createdAt) >= sevenDaysAgo
    );

    const dashboardData = {
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        status: business.status,
        email: business.email
      },
      metrics: {
        totalUsers,
        activeUsers,
        totalOrders,
        totalRevenue,
        totalMenuItems,
        availableMenuItems,
        recentOrders: recentOrders.length,
        recentRevenue: recentOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0)
      },
      voiceInteractions: {
        conversationCount: 0, // Will be populated when voice agents are used
        orders: totalOrders,
        intents: 0 // Will be populated when AI agents are used
      },
      billingUsage: {
        apiCalls: 0, // Will be populated when API usage is tracked
        minutesUsed: 0, // Will be populated when voice usage is tracked
        cost: 0 // Will be populated when billing is implemented
      },
      growthMetrics: {
        newUsers: 0, // Will be populated when user growth is tracked
        retentionRate: 0, // Will be populated when retention is calculated
        revenue: totalRevenue
      }
    };

    console.log('Dashboard data generated successfully');

    return NextResponse.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get dashboard data'
    }, { status: 500 });
  }
}
