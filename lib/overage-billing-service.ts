/**
 * Phase 4B: Overage Billing Integration with Stripe
 * Automated overage billing and usage-based charges
 */

import { PrismaClient } from '@prisma/client';
import { StripeService } from './stripe-service';
import { BillingService } from './billing-service';

export interface OverageCalculation {
  business_id: string;
  quota_type: string;
  overage_amount: number;
  rate_per_unit: number;
  total_charge_cents: number;
  billing_period_start: Date;
  billing_period_end: Date;
  stripe_invoice_item_id?: string;
}

export interface OverageBillingResult {
  success: boolean;
  invoice_item_id?: string;
  total_charge_cents: number;
  billing_period: {
    start: Date;
    end: Date;
  };
  overage_details: Array<{
    quota_type: string;
    overage_amount: number;
    rate_per_unit: number;
    charge_cents: number;
  }>;
}

export interface UsageBasedBillingConfig {
  overage_rates: Record<string, number>; // cents per unit
  grace_periods: Record<string, number>; // free overage units
  billing_thresholds: Record<string, number>; // minimum overage to bill
  bulk_discounts: Array<{
    threshold: number;
    discount_percentage: number;
  }>;
}

export class OverageBillingService {
  private prisma: PrismaClient;
  private stripeService: StripeService;
  private billingService: BillingService;

  constructor() {
    this.prisma = new PrismaClient();
    this.stripeService = new StripeService();
    this.billingService = new BillingService();
  }

  /**
   * Calculate overage charges for a business
   */
  async calculateOverageCharges(businessId: string): Promise<OverageCalculation[]> {
    try {
      // Get current usage quotas
      const quotas = await this.prisma.usage_quotas.findMany({
        where: { business_id: businessId }
      });

      const overageCalculations: OverageCalculation[] = [];

      for (const quota of quotas) {
        if (quota.quota_overage > 0) {
          const overageConfig = await this.getOverageConfig(businessId, quota.quota_type);
          
          // Apply grace period
          const billableOverage = Math.max(0, quota.quota_overage - overageConfig.grace_period);
          
          if (billableOverage > 0) {
            // Apply bulk discounts
            const discountedRate = this.applyBulkDiscounts(
              overageConfig.base_rate,
              billableOverage,
              overageConfig.bulk_discounts
            );

            const totalCharge = billableOverage * discountedRate;

            // Only create charge if above threshold
            if (totalCharge >= overageConfig.billing_threshold) {
              overageCalculations.push({
                business_id: businessId,
                quota_type: quota.quota_type,
                overage_amount: billableOverage,
                rate_per_unit: discountedRate,
                total_charge_cents: totalCharge,
                billing_period_start: quota.reset_date,
                billing_period_end: this.getNextResetDate(quota.reset_date)
              });
            }
          }
        }
      }

      return overageCalculations;

    } catch (error) {
      console.error('Overage calculation error:', error);
      throw error;
    }
  }

  /**
   * Process overage billing with Stripe
   */
  async processOverageBilling(businessId: string): Promise<OverageBillingResult> {
    try {
      // Get business subscription
      const subscription = await this.prisma.subscriptions.findFirst({
        where: { businessId, status: 'ACTIVE' }
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Calculate overage charges
      const overageCalculations = await this.calculateOverageCharges(businessId);

      if (overageCalculations.length === 0) {
        return {
          success: true,
          total_charge_cents: 0,
          billing_period: {
            start: new Date(),
            end: new Date()
          },
          overage_details: []
        };
      }

      // Get Stripe customer ID
      const stripeCustomerId = await this.getStripeCustomerId(businessId);

      // Create invoice items in Stripe
      const invoiceItems = [];
      let totalCharge = 0;

      for (const calculation of overageCalculations) {
        const invoiceItem = await this.stripeService.createInvoiceItem({
          customer: stripeCustomerId,
          amount: calculation.total_charge_cents,
          currency: 'usd',
          description: `Overage charges for ${calculation.quota_type} (${calculation.overage_amount} units)`,
          metadata: {
            business_id: businessId,
            quota_type: calculation.quota_type,
            overage_amount: calculation.overage_amount.toString(),
            rate_per_unit: calculation.rate_per_unit.toString(),
            billing_period_start: calculation.billing_period_start.toISOString(),
            billing_period_end: calculation.billing_period_end.toISOString()
          }
        });

        invoiceItems.push(invoiceItem);
        totalCharge += calculation.total_charge_cents;

        // Store overage charge record
        await this.prisma.overage_charges.create({
          data: {
            business_id: businessId,
            quota_type: calculation.quota_type,
            overage_amount: calculation.overage_amount,
            rate_per_unit: calculation.rate_per_unit,
            total_charge_cents: calculation.total_charge_cents,
            billing_period_start: calculation.billing_period_start,
            billing_period_end: calculation.billing_period_end,
            stripe_invoice_item_id: invoiceItem.id,
            status: 'billed'
          }
        });
      }

      // Create or update invoice
      const invoice = await this.stripeService.createInvoice({
        customer: stripeCustomerId,
        description: 'Usage overage charges',
        metadata: {
          business_id: businessId,
          billing_type: 'overage',
          period_start: overageCalculations[0].billing_period_start.toISOString(),
          period_end: overageCalculations[0].billing_period_end.toISOString()
        }
      });

      // Finalize invoice
      await this.stripeService.finalizeInvoice(invoice.id);

      return {
        success: true,
        total_charge_cents: totalCharge,
        billing_period: {
          start: overageCalculations[0].billing_period_start,
          end: overageCalculations[0].billing_period_end
        },
        overage_details: overageCalculations.map(calc => ({
          quota_type: calc.quota_type,
          overage_amount: calc.overage_amount,
          rate_per_unit: calc.rate_per_unit,
          charge_cents: calc.total_charge_cents
        }))
      };

    } catch (error) {
      console.error('Overage billing processing error:', error);
      throw error;
    }
  }

  /**
   * Get overage billing configuration for a business
   */
  async getOverageConfig(businessId: string, quotaType: string): Promise<{
    base_rate: number;
    grace_period: number;
    billing_threshold: number;
    bulk_discounts: Array<{ threshold: number; discount_percentage: number }>;
  }> {
    // Get business plan to determine overage rates
    const subscription = await this.prisma.subscriptions.findFirst({
      where: { businessId, status: 'ACTIVE' }
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Get plan features for overage rates
    const planFeature = await this.prisma.plan_features.findFirst({
      where: {
        plan_id: subscription.planId,
        feature_key: `${quotaType}_overage_rate`
      }
    });

    // Default overage configuration
    const defaultConfig = {
      base_rate: 500, // $5.00 per 1000 units
      grace_period: 50, // 50 free overage units
      billing_threshold: 100, // $1.00 minimum charge
      bulk_discounts: [
        { threshold: 1000, discount_percentage: 10 },
        { threshold: 5000, discount_percentage: 20 },
        { threshold: 10000, discount_percentage: 30 }
      ]
    };

    if (planFeature && planFeature.limit_value) {
      return {
        base_rate: planFeature.limit_value,
        grace_period: 50,
        billing_threshold: 100,
        bulk_discounts: defaultConfig.bulk_discounts
      };
    }

    return defaultConfig;
  }

  /**
   * Apply bulk discounts to overage rates
   */
  private applyBulkDiscounts(
    baseRate: number,
    overageAmount: number,
    bulkDiscounts: Array<{ threshold: number; discount_percentage: number }>
  ): number {
    // Sort discounts by threshold (ascending)
    const sortedDiscounts = bulkDiscounts.sort((a, b) => a.threshold - b.threshold);
    
    // Find applicable discount
    let applicableDiscount = 0;
    for (const discount of sortedDiscounts) {
      if (overageAmount >= discount.threshold) {
        applicableDiscount = discount.discount_percentage;
      }
    }

    // Apply discount
    const discountMultiplier = 1 - (applicableDiscount / 100);
    return Math.round(baseRate * discountMultiplier);
  }

  /**
   * Get Stripe customer ID for a business
   */
  private async getStripeCustomerId(businessId: string): Promise<string> {
    const subscription = await this.prisma.subscriptions.findFirst({
      where: { businessId, status: 'ACTIVE' }
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Extract Stripe customer ID from subscription metadata
    // This would be stored during subscription creation
    const stripeCustomerId = subscription.metadata?.stripe_customer_id;
    
    if (!stripeCustomerId) {
      throw new Error('Stripe customer ID not found');
    }

    return stripeCustomerId;
  }

  /**
   * Get next reset date for billing period
   */
  private getNextResetDate(currentResetDate: Date): Date {
    const nextMonth = new Date(currentResetDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  }

  /**
   * Process monthly overage billing for all businesses
   */
  async processMonthlyOverageBilling(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    total_revenue: number;
  }> {
    try {
      // Get all businesses with active subscriptions
      const businesses = await this.prisma.subscriptions.findMany({
        where: { status: 'ACTIVE' },
        select: { businessId: true }
      });

      let processed = 0;
      let successful = 0;
      let failed = 0;
      let totalRevenue = 0;

      for (const business of businesses) {
        try {
          const result = await this.processOverageBilling(business.businessId);
          
          if (result.success) {
            successful++;
            totalRevenue += result.total_charge_cents;
          } else {
            failed++;
          }
          
          processed++;
        } catch (error) {
          console.error(`Overage billing failed for business ${business.businessId}:`, error);
          failed++;
          processed++;
        }
      }

      return {
        processed,
        successful,
        failed,
        total_revenue: totalRevenue
      };

    } catch (error) {
      console.error('Monthly overage billing error:', error);
      throw error;
    }
  }

  /**
   * Get overage billing history for a business
   */
  async getOverageBillingHistory(businessId: string, limit: number = 10): Promise<Array<{
    id: string;
    quota_type: string;
    overage_amount: number;
    total_charge_cents: number;
    billing_period_start: Date;
    billing_period_end: Date;
    status: string;
    created_at: Date;
  }>> {
    try {
      const overageCharges = await this.prisma.overage_charges.findMany({
        where: { business_id: businessId },
        orderBy: { created_at: 'desc' },
        take: limit
      });

      return overageCharges.map(charge => ({
        id: charge.id,
        quota_type: charge.quota_type,
        overage_amount: charge.overage_amount,
        total_charge_cents: charge.total_charge_cents,
        billing_period_start: charge.billing_period_start,
        billing_period_end: charge.billing_period_end,
        status: charge.status,
        created_at: charge.created_at
      }));

    } catch (error) {
      console.error('Get overage billing history error:', error);
      throw error;
    }
  }

  /**
   * Get overage billing analytics
   */
  async getOverageBillingAnalytics(periodStart: Date, periodEnd: Date): Promise<{
    total_revenue: number;
    total_overage_charges: number;
    average_charge_per_business: number;
    top_quota_types: Array<{
      quota_type: string;
      total_charges: number;
      business_count: number;
    }>;
    revenue_trends: Array<{
      date: string;
      revenue: number;
      charge_count: number;
    }>;
  }> {
    try {
      // Get overage charges for the period
      const overageCharges = await this.prisma.overage_charges.findMany({
        where: {
          created_at: {
            gte: periodStart,
            lte: periodEnd
          }
        }
      });

      // Calculate analytics
      const totalRevenue = overageCharges.reduce((sum, charge) => sum + charge.total_charge_cents, 0);
      const totalOverageCharges = overageCharges.length;
      const uniqueBusinesses = new Set(overageCharges.map(charge => charge.business_id)).size;
      const averageChargePerBusiness = uniqueBusinesses > 0 ? totalRevenue / uniqueBusinesses : 0;

      // Top quota types
      const quotaTypeStats = overageCharges.reduce((acc, charge) => {
        if (!acc[charge.quota_type]) {
          acc[charge.quota_type] = { total_charges: 0, business_count: 0 };
        }
        acc[charge.quota_type].total_charges += charge.total_charge_cents;
        acc[charge.quota_type].business_count++;
        return acc;
      }, {} as Record<string, { total_charges: number; business_count: number }>);

      const topQuotaTypes = Object.entries(quotaTypeStats)
        .map(([quota_type, stats]) => ({
          quota_type,
          total_charges: stats.total_charges,
          business_count: stats.business_count
        }))
        .sort((a, b) => b.total_charges - a.total_charges)
        .slice(0, 5);

      // Revenue trends (daily)
      const dailyRevenue = overageCharges.reduce((acc, charge) => {
        const date = charge.created_at.toISOString().slice(0, 10);
        if (!acc[date]) {
          acc[date] = { revenue: 0, charge_count: 0 };
        }
        acc[date].revenue += charge.total_charge_cents;
        acc[date].charge_count++;
        return acc;
      }, {} as Record<string, { revenue: number; charge_count: number }>);

      const revenueTrends = Object.entries(dailyRevenue)
        .map(([date, stats]) => ({
          date,
          revenue: stats.revenue,
          charge_count: stats.charge_count
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        total_revenue: totalRevenue,
        total_overage_charges: totalOverageCharges,
        average_charge_per_business: Math.round(averageChargePerBusiness),
        top_quota_types: topQuotaTypes,
        revenue_trends: revenueTrends
      };

    } catch (error) {
      console.error('Get overage billing analytics error:', error);
      throw error;
    }
  }

  /**
   * Refund overage charges (for disputes or errors)
   */
  async refundOverageCharge(
    overageChargeId: string,
    reason: string,
    refundAmount?: number
  ): Promise<{
    success: boolean;
    refund_id?: string;
    refunded_amount: number;
  }> {
    try {
      // Get overage charge record
      const overageCharge = await this.prisma.overage_charges.findUnique({
        where: { id: overageChargeId }
      });

      if (!overageCharge) {
        throw new Error('Overage charge not found');
      }

      if (!overageCharge.stripe_invoice_item_id) {
        throw new Error('No Stripe invoice item ID found');
      }

      // Create refund in Stripe
      const refundAmountToProcess = refundAmount || overageCharge.total_charge_cents;
      
      const refund = await this.stripeService.createRefund({
        payment_intent: overageCharge.stripe_invoice_item_id,
        amount: refundAmountToProcess,
        reason: 'requested_by_customer',
        metadata: {
          business_id: overageCharge.business_id,
          overage_charge_id: overageChargeId,
          refund_reason: reason
        }
      });

      // Update overage charge status
      await this.prisma.overage_charges.update({
        where: { id: overageChargeId },
        data: {
          status: 'refunded',
          metadata: {
            refund_id: refund.id,
            refund_reason: reason,
            refunded_amount: refundAmountToProcess
          }
        }
      });

      return {
        success: true,
        refund_id: refund.id,
        refunded_amount: refundAmountToProcess
      };

    } catch (error) {
      console.error('Refund overage charge error:', error);
      throw error;
    }
  }
}
