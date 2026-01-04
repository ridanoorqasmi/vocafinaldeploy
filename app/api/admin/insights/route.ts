/**
 * Admin Insights API
 * Returns analytics insights for admin dashboard
 * Admin-facing only - no impact on chatbot responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { validateTenantId } from '@/lib/services/agent/tenantIsolation';
import { generateAdminInsights } from '@/lib/services/agent/insightsGenerator';

const prisma = getPrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const timeRange = parseInt(searchParams.get('timeRange') || '30', 10);

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Validate tenant
    const tenantValidation = await validateTenantId(tenantId);
    if (!tenantValidation.valid) {
      return NextResponse.json(
        { success: false, error: tenantValidation.error || 'Invalid tenant' },
        { status: 403 }
      );
    }

    // Generate insights
    const insights = await generateAdminInsights(tenantId, timeRange);

    return NextResponse.json({
      success: true,
      data: insights
    });

  } catch (error: any) {
    console.error('Error generating admin insights:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}












