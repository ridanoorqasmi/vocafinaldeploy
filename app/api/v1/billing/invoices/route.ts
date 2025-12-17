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
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '20');
    const startingAfter = searchParams.get('starting_after') || undefined;
    const status = searchParams.get('status') || undefined;

    // Validate parameters
    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      );
    }

    // Get invoices
    const result = await billingService.getInvoices(businessId, limit, startingAfter, status);

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Get Invoices API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get invoices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
