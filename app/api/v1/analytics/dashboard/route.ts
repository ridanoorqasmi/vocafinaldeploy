// app/api/v1/analytics/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getDashboardManager } from '../../../../../lib/dashboard-manager';

const prisma = new PrismaClient();
const dashboardManager = getDashboardManager(prisma);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const userId = searchParams.get('userId');
    const dashboardType = searchParams.get('type') as 'tenant' | 'admin';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!userId || !dashboardType) {
      return NextResponse.json({ 
        error: 'userId and type are required' 
      }, { status: 400 });
    }

    // Set default date range if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    let dashboardData;

    if (dashboardType === 'tenant') {
      if (!businessId) {
        return NextResponse.json({ 
          error: 'businessId is required for tenant dashboard' 
        }, { status: 400 });
      }

      dashboardData = await dashboardManager.getTenantDashboardData(businessId, {
        start,
        end
      });
    } else {
      dashboardData = await dashboardManager.getAdminDashboardData({
        start,
        end
      });
    }

    // Get dashboard configuration
    const dashboardConfig = await dashboardManager.getDashboardConfig(userId, dashboardType);

    return NextResponse.json({
      dashboard_type: dashboardType,
      data: dashboardData,
      config: dashboardConfig,
      metadata: {
        date_range: { start_date: start.toISOString(), end_date: end.toISOString() },
        generated_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error getting dashboard data:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get dashboard data' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, businessId, dashboardType, layout } = body;

    if (!userId || !dashboardType || !layout) {
      return NextResponse.json({ 
        error: 'userId, dashboardType, and layout are required' 
      }, { status: 400 });
    }

    // Save dashboard configuration
    const dashboardConfig = await dashboardManager.saveDashboardConfig(
      userId,
      businessId || null,
      dashboardType,
      layout
    );

    return NextResponse.json({
      config: dashboardConfig,
      message: 'Dashboard configuration saved successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error saving dashboard configuration:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to save dashboard configuration' 
    }, { status: 500 });
  }
}
