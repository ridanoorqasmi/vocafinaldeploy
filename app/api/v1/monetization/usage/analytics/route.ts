import { NextRequest, NextResponse } from 'next/server';
import { usageBillingService } from '@/lib/services/usage-billing-service';
import { z } from 'zod';

// Validation schemas
const GetUsageAnalyticsSchema = z.object({
  businessId: z.string().uuid(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str))
});

const GetUsageVsQuotaSchema = z.object({
  businessId: z.string().uuid(),
  targetDate: z.string().transform(str => new Date(str)).optional()
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const targetDate = searchParams.get('targetDate');
    const type = searchParams.get('type');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'Business ID is required' },
        { status: 400 }
      );
    }

    if (type === 'analytics' && startDate && endDate) {
      const validatedData = GetUsageAnalyticsSchema.parse({
        businessId,
        startDate,
        endDate
      });

      const analytics = await usageBillingService.getUsageAnalytics(
        validatedData.businessId,
        validatedData.startDate,
        validatedData.endDate
      );

      return NextResponse.json({
        success: true,
        data: analytics
      });
    }

    if (type === 'quota') {
      const validatedData = GetUsageVsQuotaSchema.parse({
        businessId,
        targetDate
      });

      const usageVsQuota = await usageBillingService.getUsageVsQuota(
        validatedData.businessId,
        validatedData.targetDate
      );

      return NextResponse.json({
        success: true,
        data: usageVsQuota
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error getting usage analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get usage analytics' },
      { status: 500 }
    );
  }
}
