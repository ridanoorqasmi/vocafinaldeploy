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
    const { paymentMethodId, setAsDefault = false } = body;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    // Add payment method
    const result = await billingService.addPaymentMethod(businessId, paymentMethodId, setAsDefault);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Add Payment Method API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add payment method',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
