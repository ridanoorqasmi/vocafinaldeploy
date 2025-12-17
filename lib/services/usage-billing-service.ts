import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

// Validation schemas
const UsageEventSchema = z.object({
  businessId: z.string().uuid(),
  eventType: z.enum(['api_call', 'voice_minute', 'storage_mb', 'ai_query']),
  quantity: z.number().min(0),
  unitPriceCents: z.number().min(0),
  metadata: z.record(z.any()).default({})
});

const UsageAggregationSchema = z.object({
  businessId: z.string().uuid(),
  billingPeriodStart: z.string().transform(str => new Date(str)),
  billingPeriodEnd: z.string().transform(str => new Date(str)),
  eventType: z.string(),
  totalQuantity: z.number().min(0),
  totalCostCents: z.number().min(0)
});

export class UsageBillingService {
  /**
   * Record a usage event
   */
  async recordUsageEvent(eventData: z.infer<typeof UsageEventSchema>): Promise<any> {
    try {
      const totalCostCents = Math.round(eventData.quantity * eventData.unitPriceCents);

      const usageEvent = await prisma.usageEvent.create({
        data: {
          businessId: eventData.businessId,
          eventType: eventData.eventType,
          quantity: eventData.quantity,
          unitPriceCents: eventData.unitPriceCents,
          totalCostCents,
          metadata: eventData.metadata
        }
      });

      // Queue for Stripe sync
      await this.queueStripeSync(usageEvent.id);

      return usageEvent;
    } catch (error) {
      console.error('Error recording usage event:', error);
      throw new Error('Failed to record usage event');
    }
  }

  /**
   * Aggregate usage for a billing period
   */
  async aggregateUsageForPeriod(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const aggregations = await prisma.$queryRaw`
        SELECT 
          event_type,
          SUM(quantity) as total_quantity,
          SUM(total_cost_cents) as total_cost_cents
        FROM usage_events
        WHERE business_id = $1
          AND created_at >= $2
          AND created_at <= $3
          AND processed_at IS NOT NULL
        GROUP BY event_type
        ORDER BY total_cost_cents DESC
      `;

      return aggregations;
    } catch (error) {
      console.error('Error aggregating usage:', error);
      throw new Error('Failed to aggregate usage');
    }
  }

  /**
   * Sync usage to Stripe metered billing
   */
  async syncUsageToStripe(usageEventId: string): Promise<any> {
    try {
      const usageEvent = await prisma.usageEvent.findUnique({
        where: { id: usageEventId },
        include: {
          business: {
            include: {
              subscriptions: {
                where: { status: 'active' },
                include: { planDefinition: true }
              }
            }
          }
        }
      });

      if (!usageEvent || !usageEvent.business.subscriptions.length) {
        return null;
      }

      const subscription = usageEvent.business.subscriptions[0];
      
      // Get or create Stripe subscription item for this usage type
      const subscriptionItem = await this.getOrCreateSubscriptionItem(
        subscription.stripeSubscriptionId!,
        usageEvent.eventType
      );

      // Create usage record in Stripe
      const stripeUsageRecord = await stripe.subscriptionItems.createUsageRecord(
        subscriptionItem.id,
        {
          quantity: Math.round(usageEvent.quantity),
          timestamp: Math.floor(usageEvent.createdAt.getTime() / 1000),
          action: 'increment'
        }
      );

      // Update usage event with Stripe record ID
      const updatedEvent = await prisma.usageEvent.update({
        where: { id: usageEventId },
        data: {
          stripeUsageRecordId: stripeUsageRecord.id,
          processedAt: new Date()
        }
      });

      return updatedEvent;
    } catch (error) {
      console.error('Error syncing usage to Stripe:', error);
      throw new Error('Failed to sync usage to Stripe');
    }
  }

  /**
   * Get or create Stripe subscription item for usage type
   */
  private async getOrCreateSubscriptionItem(
    stripeSubscriptionId: string,
    eventType: string
  ): Promise<any> {
    try {
      // Get existing subscription items
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      // Look for existing item with this usage type
      const existingItem = subscription.items.data.find(
        item => item.metadata?.usage_type === eventType
      );

      if (existingItem) {
        return existingItem;
      }

      // Create new subscription item for this usage type
      const price = await this.getOrCreateUsagePrice(eventType);
      
      const subscriptionItem = await stripe.subscriptionItems.create({
        subscription: stripeSubscriptionId,
        price: price.id,
        quantity: 0,
        metadata: {
          usage_type: eventType
        }
      });

      return subscriptionItem;
    } catch (error) {
      console.error('Error getting/creating subscription item:', error);
      throw new Error('Failed to get or create subscription item');
    }
  }

  /**
   * Get or create Stripe price for usage type
   */
  private async getOrCreateUsagePrice(eventType: string): Promise<any> {
    try {
      // Look for existing price
      const existingPrices = await stripe.prices.list({
        lookup_key: `usage_${eventType}`,
        active: true
      });

      if (existingPrices.data.length > 0) {
        return existingPrices.data[0];
      }

      // Create new price for usage type
      const price = await stripe.prices.create({
        unit_amount: this.getUnitPriceForEventType(eventType),
        currency: 'usd',
        recurring: {
          interval: 'month',
          usage_type: 'metered'
        },
        lookup_key: `usage_${eventType}`,
        metadata: {
          event_type: eventType
        }
      });

      return price;
    } catch (error) {
      console.error('Error getting/creating usage price:', error);
      throw new Error('Failed to get or create usage price');
    }
  }

  /**
   * Get unit price for event type
   */
  private getUnitPriceForEventType(eventType: string): number {
    const prices = {
      'api_call': 1,      // $0.01 per API call
      'voice_minute': 2,  // $0.02 per voice minute
      'storage_mb': 0.1,  // $0.001 per MB
      'ai_query': 5       // $0.05 per AI query
    };

    return Math.round((prices[eventType] || 1) * 100); // Convert to cents
  }

  /**
   * Get usage vs quota for a business
   */
  async getUsageVsQuota(businessId: string, targetDate: Date = new Date()): Promise<any[]> {
    try {
      const usageVsQuota = await prisma.$queryRaw`
        WITH current_usage AS (
          SELECT 
            event_type,
            SUM(quantity) as total_usage
          FROM usage_events
          WHERE business_id = $1
            AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $2)
          GROUP BY event_type
        ),
        plan_quotas AS (
          SELECT 
            uq.event_type,
            uq.quota_limit,
            uq.overage_price_cents
          FROM usage_quotas uq
          JOIN subscriptions s ON uq.plan_id = s.plan_id
          WHERE s.business_id = $1
            AND s.status = 'active'
        )
        SELECT 
          COALESCE(cu.event_type, pq.event_type) as event_type,
          COALESCE(cu.total_usage, 0) as current_usage,
          COALESCE(pq.quota_limit, 0) as quota_limit,
          CASE 
            WHEN pq.quota_limit > 0 THEN 
              ROUND((COALESCE(cu.total_usage, 0) / pq.quota_limit) * 100, 2)
            ELSE 0
          END as usage_percentage,
          GREATEST(COALESCE(cu.total_usage, 0) - COALESCE(pq.quota_limit, 0), 0) as overage_quantity,
          CASE 
            WHEN COALESCE(cu.total_usage, 0) > COALESCE(pq.quota_limit, 0) THEN
              (COALESCE(cu.total_usage, 0) - COALESCE(pq.quota_limit, 0)) * COALESCE(pq.overage_price_cents, 0)
            ELSE 0
          END as overage_cost_cents
        FROM current_usage cu
        FULL OUTER JOIN plan_quotas pq ON cu.event_type = pq.event_type
      `;

      return usageVsQuota;
    } catch (error) {
      console.error('Error getting usage vs quota:', error);
      throw new Error('Failed to get usage vs quota');
    }
  }

  /**
   * Get usage analytics for a business
   */
  async getUsageAnalytics(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          event_type,
          COUNT(*) as event_count,
          SUM(quantity) as total_quantity,
          SUM(total_cost_cents) as total_cost_cents,
          AVG(quantity) as avg_quantity_per_event,
          MAX(quantity) as max_quantity_per_event,
          MIN(created_at) as first_event,
          MAX(created_at) as last_event
        FROM usage_events
        WHERE business_id = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY event_type
        ORDER BY total_cost_cents DESC
      `;

      return analytics;
    } catch (error) {
      console.error('Error getting usage analytics:', error);
      throw new Error('Failed to get usage analytics');
    }
  }

  /**
   * Process pending usage events
   */
  async processPendingUsageEvents(): Promise<void> {
    try {
      const pendingEvents = await prisma.usageEvent.findMany({
        where: {
          processedAt: null,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        take: 100 // Process in batches
      });

      for (const event of pendingEvents) {
        try {
          await this.syncUsageToStripe(event.id);
        } catch (error) {
          console.error(`Error processing usage event ${event.id}:`, error);
          // Continue with other events
        }
      }
    } catch (error) {
      console.error('Error processing pending usage events:', error);
      throw new Error('Failed to process pending usage events');
    }
  }

  /**
   * Queue usage event for Stripe sync
   */
  private async queueStripeSync(usageEventId: string): Promise<void> {
    try {
      // In a production environment, this would use a job queue like Bull or Agenda
      // For now, we'll process immediately
      setTimeout(async () => {
        try {
          await this.syncUsageToStripe(usageEventId);
        } catch (error) {
          console.error('Error in delayed Stripe sync:', error);
        }
      }, 5000); // 5 second delay
    } catch (error) {
      console.error('Error queueing Stripe sync:', error);
    }
  }

  /**
   * Get usage events for a business
   */
  async getUsageEvents(
    businessId: string,
    startDate?: Date,
    endDate?: Date,
    eventType?: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const whereClause: any = { businessId };
      
      if (startDate) {
        whereClause.createdAt = { ...whereClause.createdAt, gte: startDate };
      }
      
      if (endDate) {
        whereClause.createdAt = { ...whereClause.createdAt, lte: endDate };
      }
      
      if (eventType) {
        whereClause.eventType = eventType;
      }

      const events = await prisma.usageEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return events;
    } catch (error) {
      console.error('Error getting usage events:', error);
      throw new Error('Failed to get usage events');
    }
  }

  /**
   * Create usage aggregation record
   */
  async createUsageAggregation(aggregationData: z.infer<typeof UsageAggregationSchema>): Promise<any> {
    try {
      const aggregation = await prisma.usageAggregation.upsert({
        where: {
          business_id_billing_period_start_billing_period_end_event_type: {
            businessId: aggregationData.businessId,
            billingPeriodStart: aggregationData.billingPeriodStart,
            billingPeriodEnd: aggregationData.billingPeriodEnd,
            eventType: aggregationData.eventType
          }
        },
        update: {
          totalQuantity: aggregationData.totalQuantity,
          totalCostCents: aggregationData.totalCostCents
        },
        create: {
          businessId: aggregationData.businessId,
          billingPeriodStart: aggregationData.billingPeriodStart,
          billingPeriodEnd: aggregationData.billingPeriodEnd,
          eventType: aggregationData.eventType,
          totalQuantity: aggregationData.totalQuantity,
          totalCostCents: aggregationData.totalCostCents
        }
      });

      return aggregation;
    } catch (error) {
      console.error('Error creating usage aggregation:', error);
      throw new Error('Failed to create usage aggregation');
    }
  }

  /**
   * Get billing insights for a business
   */
  async getBillingInsights(businessId: string, monthsBack: number = 12): Promise<any[]> {
    try {
      const insights = await prisma.$queryRaw`
        SELECT 
          bs.snapshot_date as month_date,
          bs.total_spend_cents,
          bs.subscription_cost_cents,
          bs.usage_cost_cents,
          bs.addon_cost_cents,
          bs.referral_credits_cents,
          bs.annual_savings_cents
        FROM billing_snapshots bs
        WHERE bs.business_id = $1
          AND bs.snapshot_date >= CURRENT_DATE - INTERVAL '1 month' * $2
        ORDER BY bs.snapshot_date DESC
      `;

      return insights;
    } catch (error) {
      console.error('Error getting billing insights:', error);
      throw new Error('Failed to get billing insights');
    }
  }
}

export const usageBillingService = new UsageBillingService();
