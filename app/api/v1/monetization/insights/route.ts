import { NextRequest, NextResponse } from 'next/server';
import { billingInsightsService } from '@/lib/services/billing-insights-service';
import { z } from 'zod';

// Validation schemas
const GetBillingInsightsSchema = z.object({
  businessId: z.string().uuid(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str))
});

const GetBillingKPIsSchema = z.object({
  businessId: z.string().uuid()
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'Business ID is required' },
        { status: 400 }
      );
    }

    if (type === 'comprehensive' && startDate && endDate) {
      const validatedData = GetBillingInsightsSchema.parse({
        businessId,
        startDate,
        endDate
      });

      const insights = await billingInsightsService.getBillingInsights(validatedData);

      return NextResponse.json({
        success: true,
        data: insights
      });
    }

    if (type === 'kpis') {
      const validatedData = GetBillingKPIsSchema.parse({ businessId });
      const kpis = await billingInsightsService.getBillingKPIs(validatedData.businessId);

      return NextResponse.json({
        success: true,
        data: kpis
      });
    }

    if (type === 'monthly_spend' && startDate && endDate) {
      const validatedData = GetBillingInsightsSchema.parse({
        businessId,
        startDate,
        endDate
      });

      const monthlySpend = await billingInsightsService.getMonthlySpendData(
        validatedData.businessId,
        validatedData.startDate,
        validatedData.endDate
      );

      return NextResponse.json({
        success: true,
        data: monthlySpend
      });
    }

    if (type === 'usage_quota') {
      const usageVsQuota = await billingInsightsService.getUsageVsQuotaData(businessId);

      return NextResponse.json({
        success: true,
        data: usageVsQuota
      });
    }

    if (type === 'referral_credits' && startDate && endDate) {
      const validatedData = GetBillingInsightsSchema.parse({
        businessId,
        startDate,
        endDate
      });

      const referralCredits = await billingInsightsService.getReferralCreditsData(
        validatedData.businessId,
        validatedData.startDate,
        validatedData.endDate
      );

      return NextResponse.json({
        success: true,
        data: referralCredits
      });
    }

    if (type === 'annual_savings' && startDate && endDate) {
      const validatedData = GetBillingInsightsSchema.parse({
        businessId,
        startDate,
        endDate
      });

      const annualSavings = await billingInsightsService.getAnnualSavingsData(
        validatedData.businessId,
        validatedData.startDate,
        validatedData.endDate
      );

      return NextResponse.json({
        success: true,
        data: annualSavings
      });
    }

    if (type === 'addon_analytics' && startDate && endDate) {
      const validatedData = GetBillingInsightsSchema.parse({
        businessId,
        startDate,
        endDate
      });

      const addOnAnalytics = await billingInsightsService.getAddOnAnalytics(
        validatedData.businessId,
        validatedData.startDate,
        validatedData.endDate
      );

      return NextResponse.json({
        success: true,
        data: addOnAnalytics
      });
    }

    if (type === 'invoice_history' && startDate && endDate) {
      const validatedData = GetBillingInsightsSchema.parse({
        businessId,
        startDate,
        endDate
      });

      const invoiceHistory = await billingInsightsService.getInvoiceHistory(
        validatedData.businessId,
        validatedData.startDate,
        validatedData.endDate
      );

      return NextResponse.json({
        success: true,
        data: invoiceHistory
      });
    }

    if (type === 'billing_alerts') {
      const alerts = await billingInsightsService.getBillingAlerts(businessId);

      return NextResponse.json({
        success: true,
        data: alerts
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error getting billing insights:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get billing insights' },
      { status: 500 }
    );
  }
}
