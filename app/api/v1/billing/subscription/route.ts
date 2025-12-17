import { NextRequest, NextResponse } from 'next/server';
import { BillingService } from '@/lib/billing-service';
import { authMiddleware } from '@/lib/auth-middleware';

const billingService = new BillingService();

export async function GET(request: NextRequest) {
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

    // Get subscription details
    const subscription = await billingService.getSubscription(businessId);
    const availablePlans = await billingService.getAvailablePlans();
    const billingPortalUrl = await billingService.getBillingPortalUrl(businessId);

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        available_plans: availablePlans,
        billing_portal_url: billingPortalUrl,
      },
    });

  } catch (error) {
    console.error('Get Subscription API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Update subscription
    const result = await billingService.updateSubscription(businessId, planId);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Update Subscription API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const immediately = searchParams.get('immediately') === 'true';

    // Cancel subscription
    const result = await billingService.cancelSubscription(businessId, immediately);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Cancel Subscription API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cancel subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
