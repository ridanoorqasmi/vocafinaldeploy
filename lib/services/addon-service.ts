import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

// Validation schemas
const AddOnSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  priceCents: z.number().min(0),
  billingPeriod: z.enum(['monthly', 'yearly', 'one_time']),
  eventType: z.string().optional(),
  quantityIncluded: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
  metadata: z.record(z.any()).default({})
});

const BusinessAddOnSchema = z.object({
  businessId: z.string().uuid(),
  addOnId: z.string().uuid(),
  quantity: z.number().min(1).default(1),
  priceCents: z.number().min(0)
});

const UpsellCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  triggerConditions: z.record(z.any()),
  targetAddOnId: z.string().uuid(),
  ctaText: z.string().min(1).max(100),
  ctaUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().default(0)
});

export class AddOnService {
  /**
   * Create a new add-on
   */
  async createAddOn(addOnData: z.infer<typeof AddOnSchema>): Promise<any> {
    try {
      const addOn = await prisma.addOn.create({
        data: {
          name: addOnData.name,
          description: addOnData.description,
          priceCents: addOnData.priceCents,
          billingPeriod: addOnData.billingPeriod,
          eventType: addOnData.eventType,
          quantityIncluded: addOnData.quantityIncluded,
          isActive: addOnData.isActive,
          sortOrder: addOnData.sortOrder,
          metadata: addOnData.metadata
        }
      });

      // Create Stripe price for the add-on
      await this.createStripePrice(addOn);

      return addOn;
    } catch (error) {
      console.error('Error creating add-on:', error);
      throw new Error('Failed to create add-on');
    }
  }

  /**
   * Get all active add-ons
   */
  async getActiveAddOns(): Promise<any[]> {
    try {
      const addOns = await prisma.addOn.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      return addOns;
    } catch (error) {
      console.error('Error getting active add-ons:', error);
      throw new Error('Failed to get active add-ons');
    }
  }

  /**
   * Get add-ons for a business
   */
  async getBusinessAddOns(businessId: string): Promise<any[]> {
    try {
      const businessAddOns = await prisma.businessAddOn.findMany({
        where: { businessId },
        include: {
          addOn: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return businessAddOns;
    } catch (error) {
      console.error('Error getting business add-ons:', error);
      throw new Error('Failed to get business add-ons');
    }
  }

  /**
   * Purchase an add-on for a business
   */
  async purchaseAddOn(
    businessId: string,
    addOnId: string,
    quantity: number = 1
  ): Promise<any> {
    try {
      const addOn = await prisma.addOn.findUnique({
        where: { id: addOnId }
      });

      if (!addOn || !addOn.isActive) {
        throw new Error('Add-on not found or inactive');
      }

      // Check if business already has this add-on
      const existingAddOn = await prisma.businessAddOn.findUnique({
        where: {
          business_id_add_on_id: {
            businessId,
            addOnId
          }
        }
      });

      if (existingAddOn && existingAddOn.status === 'active') {
        throw new Error('Business already has this add-on');
      }

      // Get business subscription
      const subscription = await prisma.subscription.findFirst({
        where: {
          businessId,
          status: 'active'
        }
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Create Stripe checkout session
      const checkoutSession = await this.createAddOnCheckoutSession(
        businessId,
        addOn,
        quantity,
        subscription.stripeSubscriptionId!
      );

      return {
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id
      };
    } catch (error) {
      console.error('Error purchasing add-on:', error);
      throw new Error('Failed to purchase add-on');
    }
  }

  /**
   * Create Stripe checkout session for add-on
   */
  private async createAddOnCheckoutSession(
    businessId: string,
    addOn: any,
    quantity: number,
    subscriptionId: string
  ): Promise<any> {
    try {
      const price = await this.getOrCreateStripePrice(addOn);

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: await this.getBusinessStripeCustomerId(businessId),
        line_items: [
          {
            price: price.id,
            quantity: quantity
          }
        ],
        subscription_data: {
          metadata: {
            business_id: businessId,
            add_on_id: addOn.id,
            add_on_name: addOn.name
          }
        },
        success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/billing/add-ons`,
        metadata: {
          business_id: businessId,
          add_on_id: addOn.id
        }
      });

      return checkoutSession;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Get or create Stripe price for add-on
   */
  private async getOrCreateStripePrice(addOn: any): Promise<any> {
    try {
      // Look for existing price
      const existingPrices = await stripe.prices.list({
        lookup_key: `addon_${addOn.id}`,
        active: true
      });

      if (existingPrices.data.length > 0) {
        return existingPrices.data[0];
      }

      // Create new price
      const price = await stripe.prices.create({
        unit_amount: addOn.priceCents,
        currency: 'usd',
        recurring: addOn.billingPeriod === 'one_time' ? undefined : {
          interval: addOn.billingPeriod === 'yearly' ? 'year' : 'month'
        },
        lookup_key: `addon_${addOn.id}`,
        metadata: {
          add_on_id: addOn.id,
          add_on_name: addOn.name
        }
      });

      return price;
    } catch (error) {
      console.error('Error getting/creating Stripe price:', error);
      throw new Error('Failed to get or create Stripe price');
    }
  }

  /**
   * Get business Stripe customer ID
   */
  private async getBusinessStripeCustomerId(businessId: string): Promise<string> {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          subscriptions: {
            where: { status: 'active' },
            take: 1
          }
        }
      });

      if (!business || !business.subscriptions.length) {
        throw new Error('No active subscription found');
      }

      const subscription = await stripe.subscriptions.retrieve(
        business.subscriptions[0].stripeSubscriptionId!
      );

      return subscription.customer as string;
    } catch (error) {
      console.error('Error getting Stripe customer ID:', error);
      throw new Error('Failed to get Stripe customer ID');
    }
  }

  /**
   * Handle successful add-on purchase
   */
  async handleAddOnPurchaseSuccess(sessionId: string): Promise<any> {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const businessId = session.metadata?.business_id;
      const addOnId = session.metadata?.add_on_id;

      if (!businessId || !addOnId) {
        throw new Error('Missing metadata in checkout session');
      }

      // Create business add-on record
      const businessAddOn = await prisma.businessAddOn.create({
        data: {
          businessId,
          addOnId,
          stripeSubscriptionItemId: session.subscription as string,
          status: 'active',
          quantity: 1,
          priceCents: session.amount_total || 0
        }
      });

      return businessAddOn;
    } catch (error) {
      console.error('Error handling add-on purchase success:', error);
      throw new Error('Failed to handle add-on purchase success');
    }
  }

  /**
   * Cancel business add-on
   */
  async cancelBusinessAddOn(businessAddOnId: string): Promise<any> {
    try {
      const businessAddOn = await prisma.businessAddOn.findUnique({
        where: { id: businessAddOnId }
      });

      if (!businessAddOn) {
        throw new Error('Business add-on not found');
      }

      // Cancel in Stripe
      if (businessAddOn.stripeSubscriptionItemId) {
        await stripe.subscriptionItems.del(businessAddOn.stripeSubscriptionItemId);
      }

      // Update database
      const updatedAddOn = await prisma.businessAddOn.update({
        where: { id: businessAddOnId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date()
        }
      });

      return updatedAddOn;
    } catch (error) {
      console.error('Error cancelling business add-on:', error);
      throw new Error('Failed to cancel business add-on');
    }
  }

  /**
   * Create upsell campaign
   */
  async createUpsellCampaign(campaignData: z.infer<typeof UpsellCampaignSchema>): Promise<any> {
    try {
      const campaign = await prisma.upsellCampaign.create({
        data: {
          name: campaignData.name,
          description: campaignData.description,
          triggerConditions: campaignData.triggerConditions,
          targetAddOnId: campaignData.targetAddOnId,
          ctaText: campaignData.ctaText,
          ctaUrl: campaignData.ctaUrl,
          isActive: campaignData.isActive,
          priority: campaignData.priority
        }
      });

      return campaign;
    } catch (error) {
      console.error('Error creating upsell campaign:', error);
      throw new Error('Failed to create upsell campaign');
    }
  }

  /**
   * Get upsell campaigns for a business
   */
  async getUpsellCampaigns(businessId: string): Promise<any[]> {
    try {
      // Get business usage data
      const usageVsQuota = await prisma.$queryRaw`
        WITH current_usage AS (
          SELECT 
            event_type,
            SUM(quantity) as total_usage
          FROM usage_events
          WHERE business_id = $1
            AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
          GROUP BY event_type
        ),
        plan_quotas AS (
          SELECT 
            uq.event_type,
            uq.quota_limit
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
          END as usage_percentage
        FROM current_usage cu
        FULL OUTER JOIN plan_quotas pq ON cu.event_type = pq.event_type
      `;

      // Get active campaigns
      const campaigns = await prisma.upsellCampaign.findMany({
        where: { isActive: true },
        include: { targetAddOn: true },
        orderBy: { priority: 'desc' }
      });

      // Filter campaigns based on trigger conditions
      const applicableCampaigns = campaigns.filter(campaign => {
        const conditions = campaign.triggerConditions;
        
        // Check usage percentage condition
        if (conditions.usage_percentage?.min) {
          const relevantUsage = usageVsQuota.find(
            (usage: any) => usage.event_type === campaign.targetAddOn.eventType
          );
          
          if (!relevantUsage || relevantUsage.usage_percentage < conditions.usage_percentage.min) {
            return false;
          }
        }

        // Check total usage condition
        if (conditions.total_usage?.min) {
          const totalUsage = usageVsQuota.reduce(
            (sum: number, usage: any) => sum + parseFloat(usage.current_usage || 0), 0
          );
          
          if (totalUsage < conditions.total_usage.min) {
            return false;
          }
        }

        return true;
      });

      return applicableCampaigns;
    } catch (error) {
      console.error('Error getting upsell campaigns:', error);
      throw new Error('Failed to get upsell campaigns');
    }
  }

  /**
   * Record upsell interaction
   */
  async recordUpsellInteraction(
    businessId: string,
    campaignId: string,
    interactionType: string,
    interactionData: Record<string, any> = {}
  ): Promise<any> {
    try {
      const interaction = await prisma.upsellInteraction.create({
        data: {
          businessId,
          campaignId,
          interactionType,
          interactionData
        }
      });

      return interaction;
    } catch (error) {
      console.error('Error recording upsell interaction:', error);
      throw new Error('Failed to record upsell interaction');
    }
  }

  /**
   * Get add-on analytics
   */
  async getAddOnAnalytics(): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          ao.name as add_on_name,
          COUNT(bao.id) as total_purchases,
          COUNT(CASE WHEN bao.status = 'active' THEN 1 END) as active_purchases,
          COUNT(CASE WHEN bao.status = 'cancelled' THEN 1 END) as cancelled_purchases,
          COALESCE(SUM(bao.price_cents), 0) as total_revenue_cents,
          COALESCE(AVG(bao.price_cents), 0) as average_price_cents
        FROM add_ons ao
        LEFT JOIN business_add_ons bao ON ao.id = bao.add_on_id
        WHERE ao.is_active = true
        GROUP BY ao.id, ao.name
        ORDER BY total_revenue_cents DESC
      `;

      return analytics;
    } catch (error) {
      console.error('Error getting add-on analytics:', error);
      throw new Error('Failed to get add-on analytics');
    }
  }

  /**
   * Create Stripe price for add-on
   */
  private async createStripePrice(addOn: any): Promise<any> {
    try {
      const price = await stripe.prices.create({
        unit_amount: addOn.priceCents,
        currency: 'usd',
        recurring: addOn.billingPeriod === 'one_time' ? undefined : {
          interval: addOn.billingPeriod === 'yearly' ? 'year' : 'month'
        },
        lookup_key: `addon_${addOn.id}`,
        metadata: {
          add_on_id: addOn.id,
          add_on_name: addOn.name
        }
      });

      return price;
    } catch (error) {
      console.error('Error creating Stripe price:', error);
      throw new Error('Failed to create Stripe price');
    }
  }
}

export const addOnService = new AddOnService();
