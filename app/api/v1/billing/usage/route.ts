/**
 * Phase 4B: Usage Monitoring API
 * GET /api/v1/billing/usage - Current Usage Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlanManagementService } from '@/lib/plan-management-service';
import { UsageEnforcementService } from '@/lib/usage-enforcement-service';
import { authenticateToken } from '@/lib/next-auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request and get business context
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const businessId = authResult.user.businessId;

    const planManagement = new PlanManagementService();
    const usageEnforcement = new UsageEnforcementService();

    // Get usage dashboard
    const dashboard = await planManagement.getUsageDashboard(businessId);

    // Get current usage status
    const usageStatus = await usageEnforcement.getCurrentUsageStatus(businessId);

    return NextResponse.json({
      success: true,
      data: {
        dashboard,
        usage_status: usageStatus
      }
    });

  } catch (error) {
    console.error('Usage dashboard error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch usage dashboard',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
