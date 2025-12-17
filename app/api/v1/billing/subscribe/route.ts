import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/lib/billing-service';
import { authMiddleware } from '@/lib/auth-middleware';

const billingService = new BillingService();

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const businessId = authResult.businessId;
    const body = await request.json();

    // Validate request body
    const { planId, paymentMethodId, trialPeriodDays, couponId, customerDetails } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Create subscription
    const result = await billingService.createSubscription({
      businessId,
      planId,
      paymentMethodId,
      trialPeriodDays,
      couponId,
      customerDetails,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Subscribe API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
