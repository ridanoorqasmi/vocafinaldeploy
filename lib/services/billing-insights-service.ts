import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { usageBillingService } from './usage-billing-service';
import { addOnService } from './addon-service';
import { invoiceService } from './invoice-service';

const prisma = new PrismaClient();

// Validation schemas
const BillingInsightsSchema = z.object({
  businessId: z.string().uuid(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str))
});

export class BillingInsightsService {
  /**
   * Get comprehensive billing insights for a business
   */
  async getBillingInsights(insightsData: z.infer<typeof BillingInsightsSchema>): Promise<any> {
    try {
      const { businessId, startDate, endDate } = insightsData;

      const [
        monthlySpend,
        usageVsQuota,
        referralCredits,
        annualSavings,
        addOnAnalytics,
        invoiceHistory,
        billingAlerts
      ] = await Promise.all([
        this.getMonthlySpendData(businessId, startDate, endDate),
        this.getUsageVsQuotaData(businessId),
        this.getReferralCreditsData(businessId, startDate, endDate),
        this.getAnnualSavingsData(businessId, startDate, endDate),
        this.getAddOnAnalytics(businessId, startDate, endDate),
        this.getInvoiceHistory(businessId, startDate, endDate),
        this.getBillingAlerts(businessId)
      ]);

      return {
        monthlySpend,
        usageVsQuota,
        referralCredits,
        annualSavings,
        addOnAnalytics,
        invoiceHistory,
        billingAlerts,
        summary: this.calculateBillingSummary({
          monthlySpend,
          usageVsQuota,
          referralCredits,
          annualSavings,
          addOnAnalytics
        })
      };
    } catch (error) {
      console.error('Error getting billing insights:', error);
      throw new Error('Failed to get billing insights');
    }
  }

  /**
   * Get monthly spend data with trends
   */
  async getMonthlySpendData(businessId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const monthlyData = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', bs.snapshot_date) as month,
          bs.total_spend_cents,
          bs.subscription_cost_cents,
          bs.usage_cost_cents,
          bs.addon_cost_cents,
          bs.tax_cents,
          bs.discount_cents,
          bs.referral_credits_cents,
          bs.annual_savings_cents
        FROM billing_snapshots bs
        WHERE bs.business_id = $1
          AND bs.snapshot_date >= $2
          AND bs.snapshot_date <= $3
        ORDER BY bs.snapshot_date ASC
      `;

      // Calculate trends
      const trendData = this.calculateSpendTrends(monthlyData);

      return {
        monthlyData,
        trends: trendData
      };
    } catch (error) {
      console.error('Error getting monthly spend data:', error);
      throw new Error('Failed to get monthly spend data');
    }
  }

  /**
   * Get usage vs quota data
   */
  async getUsageVsQuotaData(businessId: string): Promise<any> {
    try {
      const usageVsQuota = await usageBillingService.getUsageVsQuota(businessId);
      
      // Calculate quota utilization
      const quotaUtilization = usageVsQuota.map((item: any) => ({
        ...item,
        isOverQuota: item.current_usage > item.quota_limit,
        remainingQuota: Math.max(0, item.quota_limit - item.current_usage),
        overagePercentage: item.quota_limit > 0 ? 
          Math.max(0, ((item.current_usage - item.quota_limit) / item.quota_limit) * 100) : 0
      }));

      return quotaUtilization;
    } catch (error) {
      console.error('Error getting usage vs quota data:', error);
      throw new Error('Failed to get usage vs quota data');
    }
  }

  /**
   * Get referral credits data
   */
  async getReferralCreditsData(businessId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const referralCredits = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          SUM(referral_credit_cents) as total_credits_cents,
          COUNT(*) as referral_count
        FROM referrals
        WHERE referrer_business_id = $1
          AND status = 'credited'
          AND credit_issued_at >= $2
          AND credit_issued_at <= $3
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month ASC
      `;

      const totalCredits = await prisma.$queryRaw`
        SELECT 
          COALESCE(SUM(referral_credit_cents), 0) as total_credits_cents,
          COUNT(*) as total_referrals
        FROM referrals
        WHERE referrer_business_id = $1
          AND status = 'credited'
      `;

      return {
        monthlyCredits: referralCredits,
        totalCredits: totalCredits[0]
      };
    } catch (error) {
      console.error('Error getting referral credits data:', error);
      throw new Error('Failed to get referral credits data');
    }
  }

  /**
   * Get annual savings data
   */
  async getAnnualSavingsData(businessId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const annualSavings = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          SUM(savings_cents) as monthly_savings_cents,
          COUNT(*) as annual_subscriptions
        FROM annual_subscriptions
        WHERE business_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month ASC
      `;

      const totalSavings = await prisma.$queryRaw`
        SELECT 
          COALESCE(SUM(savings_cents), 0) as total_savings_cents,
          COUNT(*) as total_annual_subscriptions
        FROM annual_subscriptions
        WHERE business_id = $1
      `;

      return {
        monthlySavings: annualSavings,
        totalSavings: totalSavings[0]
      };
    } catch (error) {
      console.error('Error getting annual savings data:', error);
      throw new Error('Failed to get annual savings data');
    }
  }

  /**
   * Get add-on analytics
   */
  async getAddOnAnalytics(businessId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const addOnAnalytics = await prisma.$queryRaw`
        SELECT 
          ao.name as add_on_name,
          ao.price_cents,
          COUNT(bao.id) as purchase_count,
          SUM(bao.price_cents) as total_revenue_cents,
          AVG(bao.price_cents) as average_price_cents,
          COUNT(CASE WHEN bao.status = 'active' THEN 1 END) as active_count,
          COUNT(CASE WHEN bao.status = 'cancelled' THEN 1 END) as cancelled_count
        FROM add_ons ao
        LEFT JOIN business_add_ons bao ON ao.id = bao.add_on_id
        WHERE bao.business_id = $1
          AND bao.created_at >= $2
          AND bao.created_at <= $3
        GROUP BY ao.id, ao.name, ao.price_cents
        ORDER BY total_revenue_cents DESC
      `;

      return addOnAnalytics;
    } catch (error) {
      console.error('Error getting add-on analytics:', error);
      throw new Error('Failed to get add-on analytics');
    }
  }

  /**
   * Get invoice history
   */
  async getInvoiceHistory(businessId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const invoices = await prisma.invoice.findMany({
        where: {
          businessId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          invoiceLineItems: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const invoiceSummary = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_invoices,
          COALESCE(SUM(amount_cents), 0) as total_amount_cents,
          COALESCE(SUM(amount_paid_cents), 0) as total_paid_cents,
          COALESCE(AVG(amount_cents), 0) as average_invoice_amount_cents
        FROM invoices
        WHERE business_id = $1
          AND created_at >= $2
          AND created_at <= $3
      `;

      return {
        invoices,
        summary: invoiceSummary[0]
      };
    } catch (error) {
      console.error('Error getting invoice history:', error);
      throw new Error('Failed to get invoice history');
    }
  }

  /**
   * Get billing alerts
   */
  async getBillingAlerts(businessId: string): Promise<any[]> {
    try {
      const alerts = await prisma.billingAlert.findMany({
        where: { businessId },
        orderBy: { triggeredAt: 'desc' },
        take: 10
      });

      return alerts;
    } catch (error) {
      console.error('Error getting billing alerts:', error);
      throw new Error('Failed to get billing alerts');
    }
  }

  /**
   * Calculate billing summary
   */
  private calculateBillingSummary(data: any): any {
    const { monthlySpend, usageVsQuota, referralCredits, annualSavings, addOnAnalytics } = data;

    // Calculate current month spend
    const currentMonth = monthlySpend.monthlyData[monthlySpend.monthlyData.length - 1];
    const previousMonth = monthlySpend.monthlyData[monthlySpend.monthlyData.length - 2];

    const currentSpend = currentMonth?.total_spend_cents || 0;
    const previousSpend = previousMonth?.total_spend_cents || 0;
    const spendChange = previousSpend > 0 ? 
      ((currentSpend - previousSpend) / previousSpend) * 100 : 0;

    // Calculate quota utilization
    const totalQuotaUtilization = usageVsQuota.reduce((sum: number, item: any) => 
      sum + (item.usage_percentage || 0), 0) / usageVsQuota.length;

    // Calculate overage risk
    const overageRisk = usageVsQuota.filter((item: any) => 
      item.usage_percentage > 80).length;

    // Calculate total savings
    const totalReferralCredits = referralCredits.totalCredits.total_credits_cents || 0;
    const totalAnnualSavings = annualSavings.totalSavings.total_savings_cents || 0;
    const totalSavings = totalReferralCredits + totalAnnualSavings;

    // Calculate add-on revenue
    const addOnRevenue = addOnAnalytics.reduce((sum: number, addon: any) => 
      sum + (addon.total_revenue_cents || 0), 0);

    return {
      currentSpendCents: currentSpend,
      spendChangePercentage: Math.round(spendChange * 100) / 100,
      totalQuotaUtilization: Math.round(totalQuotaUtilization * 100) / 100,
      overageRisk,
      totalSavingsCents: totalSavings,
      addOnRevenueCents: addOnRevenue,
      recommendations: this.generateRecommendations({
        spendChange,
        totalQuotaUtilization,
        overageRisk,
        totalSavings,
        addOnRevenue
      })
    };
  }

  /**
   * Calculate spend trends
   */
  private calculateSpendTrends(monthlyData: any[]): any {
    if (monthlyData.length < 2) {
      return { trend: 'stable', changePercentage: 0 };
    }

    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];

    const changePercentage = previousMonth.total_spend_cents > 0 ?
      ((currentMonth.total_spend_cents - previousMonth.total_spend_cents) / previousMonth.total_spend_cents) * 100 : 0;

    let trend = 'stable';
    if (changePercentage > 10) trend = 'increasing';
    else if (changePercentage < -10) trend = 'decreasing';

    return {
      trend,
      changePercentage: Math.round(changePercentage * 100) / 100
    };
  }

  /**
   * Generate billing recommendations
   */
  private generateRecommendations(data: any): string[] {
    const recommendations: string[] = [];

    if (data.spendChange > 20) {
      recommendations.push('Your spending has increased significantly. Consider reviewing your usage patterns.');
    }

    if (data.totalQuotaUtilization > 80) {
      recommendations.push('You are approaching your usage quotas. Consider upgrading your plan or purchasing add-ons.');
    }

    if (data.overageRisk > 0) {
      recommendations.push('You have exceeded quotas in some areas. Monitor your usage to avoid overage charges.');
    }

    if (data.totalSavings < 1000) {
      recommendations.push('Consider annual plans or referral programs to save on your subscription costs.');
    }

    if (data.addOnRevenue > 0) {
      recommendations.push('You are using add-ons effectively. Consider if any could be included in a plan upgrade.');
    }

    return recommendations;
  }

  /**
   * Get billing KPIs
   */
  async getBillingKPIs(businessId: string): Promise<any> {
    try {
      const currentMonth = new Date();
      const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);

      const [
        currentMonthSpend,
        lastMonthSpend,
        usageData,
        referralData,
        annualSavingsData
      ] = await Promise.all([
        this.getMonthlySpendData(businessId, lastMonth, currentMonth),
        this.getMonthlySpendData(businessId, 
          new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1), 
          lastMonth
        ),
        this.getUsageVsQuotaData(businessId),
        this.getReferralCreditsData(businessId, lastMonth, currentMonth),
        this.getAnnualSavingsData(businessId, lastMonth, currentMonth)
      ]);

      const currentSpend = currentMonthSpend.monthlyData[0]?.total_spend_cents || 0;
      const previousSpend = lastMonthSpend.monthlyData[0]?.total_spend_cents || 0;
      const spendGrowth = previousSpend > 0 ? 
        ((currentSpend - previousSpend) / previousSpend) * 100 : 0;

      const totalQuotaUtilization = usageData.reduce((sum: number, item: any) => 
        sum + (item.usage_percentage || 0), 0) / usageData.length;

      const totalSavings = (referralData.totalCredits.total_credits_cents || 0) + 
        (annualSavingsData.totalSavings.total_savings_cents || 0);

      return {
        currentSpendCents: currentSpend,
        spendGrowthPercentage: Math.round(spendGrowth * 100) / 100,
        quotaUtilizationPercentage: Math.round(totalQuotaUtilization * 100) / 100,
        totalSavingsCents: totalSavings,
        overageRisk: usageData.filter((item: any) => item.usage_percentage > 80).length
      };
    } catch (error) {
      console.error('Error getting billing KPIs:', error);
      throw new Error('Failed to get billing KPIs');
    }
  }
}

export const billingInsightsService = new BillingInsightsService();
