import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/businesses/:businessId/stats - Business statistics
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    // Check business access
    const businessAccess = await requireBusinessAccess(authResult.user.id, params.businessId);
    if (!businessAccess.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this business'
        }
      }, { status: 403 });
    }

    // Get business statistics
    const [
      business,
      userCount,
      locationCount,
      menuItemCount,
      categoryCount,
      policyCount,
      knowledgeBaseCount,
      orderCount,
      queryLogCount
    ] = await Promise.all([
      prisma.business.findUnique({
        where: { id: params.businessId },
        select: { name: true, status: true, createdAt: true }
      }),
      prisma.user.count({
        where: { businessId: params.businessId, deletedAt: null }
      }),
      prisma.location.count({
        where: { businessId: params.businessId, deletedAt: null }
      }),
      prisma.menuItem.count({
        where: { businessId: params.businessId, deletedAt: null }
      }),
      prisma.category.count({
        where: { businessId: params.businessId, deletedAt: null }
      }),
      prisma.policy.count({
        where: { businessId: params.businessId, deletedAt: null }
      }),
      prisma.knowledgeBase.count({
        where: { businessId: params.businessId, deletedAt: null }
      }),
      prisma.order.count({
        where: { businessId: params.businessId, deletedAt: null }
      }),
      prisma.queryLog.count({
        where: { businessId: params.businessId }
      })
    ]);

    if (!business) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Business not found'
        }
      }, { status: 404 });
    }

    // Calculate additional stats
    const daysSinceCreated = Math.floor(
      (Date.now() - business.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const stats = {
      business: {
        name: business.name,
        status: business.status,
        daysActive: daysSinceCreated
      },
      counts: {
        users: userCount,
        locations: locationCount,
        menuItems: menuItemCount,
        categories: categoryCount,
        policies: policyCount,
        knowledgeBase: knowledgeBaseCount,
        orders: orderCount,
        queries: queryLogCount
      },
      // Mock performance metrics for now
      performance: {
        averageResponseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
        successRate: 98.5,
        totalQueriesToday: Math.floor(Math.random() * 100) + 20,
        activeUsersToday: Math.floor(Math.random() * 10) + 1
      },
      // Mock revenue metrics for now
      revenue: {
        totalOrders: orderCount,
        averageOrderValue: 25.50,
        monthlyRevenue: orderCount * 25.50,
        growthRate: 12.5
      }
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('Get business stats error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve business statistics'
      }
    }, { status: 500 });
  }
}
