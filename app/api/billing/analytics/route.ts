import { NextRequest, NextResponse } from 'next/server';
import { billingTracker } from '../../../lib/billing-tracker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const period = searchParams.get('period') as 'current_month' | 'last_30_days' || 'current_month';
    const days = parseInt(searchParams.get('days') || '30');

    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'Business ID is required'
      }, { status: 400 });
    }

    // Get billing usage data
    const billingUsage = await billingTracker.getBillingUsage(businessId, period);
    
    // Get usage trends
    const trends = await billingTracker.getUsageTrends(businessId, days);

    return NextResponse.json({
      success: true,
      data: {
        billingUsage,
        trends,
        period,
        days
      }
    });

  } catch (error) {
    console.error('Billing analytics error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get billing analytics'
    }, { status: 500 });
  }
}
