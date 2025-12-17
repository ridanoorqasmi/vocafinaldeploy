import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

// Validation schemas
const CustomPlanSchema = z.object({
  businessId: z.string().uuid(),
  planName: z.string().min(1).max(100),
  basePriceCents: z.number().min(0),
  billingPeriod: z.enum(['monthly', 'yearly']),
  limits: z.record(z.any()),
  discounts: z.record(z.any()).default({}),
  features: z.record(z.any()).default({}),
  status: z.enum(['active', 'inactive', 'expired']).default('active'),
  createdBy: z.string().uuid()
});

const CustomPlanUsageSchema = z.object({
  customPlanId: z.string().uuid(),
  eventType: z.string(),
  currentUsage: z.number().min(0).default(0),
  usageLimit: z.number().min(0),
  overageChargesCents: z.number().min(0).default(0),
  lastResetDate: z.string().transform(str => new Date(str))
});

export class CustomPlanService {
  /**
   * Create a custom plan for a business
   */
  async createCustomPlan(planData: z.infer<typeof CustomPlanSchema>): Promise<any> {
    try {
      // Check if business already has a custom plan
      const existingPlan = await prisma.customPlan.findUnique({
        where: { businessId: planData.businessId }
      });

      if (existingPlan && existingPlan.status === 'active') {
        throw new Error('Business already has an active custom plan');
      }

      // Create Stripe price for the custom plan
      const stripePrice = await this.createStripePrice(planData);

      // Create custom plan
      const customPlan = await prisma.customPlan.create({
        data: {
          businessId: planData.businessId,
          planName: planData.planName,
          basePriceCents: planData.basePriceCents,
          billingPeriod: planData.billingPeriod,
          limits: planData.limits,
          discounts: planData.discounts,
          features: planData.features,
          status: planData.status,
          stripePriceId: stripePrice.id,
          createdBy: planData.createdBy
        }
      });

      // Create usage tracking records for each limit
      await this.createUsageTracking(customPlan.id, planData.limits);

      return customPlan;
    } catch (error) {
      console.error('Error creating custom plan:', error);
      throw new Error('Failed to create custom plan');
    }
  }

  /**
   * Get custom plan for a business
   */
  async getCustomPlan(businessId: string): Promise<any> {
    try {
      const customPlan = await prisma.customPlan.findUnique({
        where: { businessId },
        include: {
          customPlanUsage: true,
          business: {
            select: {
              id: true,
              name: true,
              createdAt: true
            }
          }
        }
      });

      return customPlan;
    } catch (error) {
      console.error('Error getting custom plan:', error);
      throw new Error('Failed to get custom plan');
    }
  }

  /**
   * Update custom plan
   */
  async updateCustomPlan(
    customPlanId: string,
    updateData: Partial<z.infer<typeof CustomPlanSchema>>
  ): Promise<any> {
    try {
      const customPlan = await prisma.customPlan.findUnique({
        where: { id: customPlanId }
      });

      if (!customPlan) {
        throw new Error('Custom plan not found');
      }

      // Update Stripe price if price changed
      if (updateData.basePriceCents && updateData.basePriceCents !== customPlan.basePriceCents) {
        await this.updateStripePrice(customPlan.stripePriceId!, updateData.basePriceCents);
      }

      // Update custom plan
      const updatedPlan = await prisma.customPlan.update({
        where: { id: customPlanId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      // Update usage tracking if limits changed
      if (updateData.limits) {
        await this.updateUsageTracking(customPlanId, updateData.limits);
      }

      return updatedPlan;
    } catch (error) {
      console.error('Error updating custom plan:', error);
      throw new Error('Failed to update custom plan');
    }
  }

  /**
   * Deactivate custom plan
   */
  async deactivateCustomPlan(customPlanId: string): Promise<any> {
    try {
      const customPlan = await prisma.customPlan.findUnique({
        where: { id: customPlanId }
      });

      if (!customPlan) {
        throw new Error('Custom plan not found');
      }

      // Archive Stripe price
      if (customPlan.stripePriceId) {
        await stripe.prices.update(customPlan.stripePriceId, {
          active: false
        });
      }

      // Update custom plan status
      const updatedPlan = await prisma.customPlan.update({
        where: { id: customPlanId },
        data: {
          status: 'inactive',
          updatedAt: new Date()
        }
      });

      return updatedPlan;
    } catch (error) {
      console.error('Error deactivating custom plan:', error);
      throw new Error('Failed to deactivate custom plan');
    }
  }

  /**
   * Get all custom plans (admin only)
   */
  async getAllCustomPlans(): Promise<any[]> {
    try {
      const customPlans = await prisma.customPlan.findMany({
        include: {
          business: {
            select: {
              id: true,
              name: true,
              createdAt: true
            }
          },
          customPlanUsage: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return customPlans;
    } catch (error) {
      console.error('Error getting all custom plans:', error);
      throw new Error('Failed to get all custom plans');
    }
  }

  /**
   * Update custom plan usage
   */
  async updateCustomPlanUsage(
    customPlanId: string,
    eventType: string,
    additionalUsage: number
  ): Promise<any> {
    try {
      const usageRecord = await prisma.customPlanUsage.findFirst({
        where: {
          customPlanId,
          eventType
        }
      });

      if (!usageRecord) {
        throw new Error('Usage record not found for event type');
      }

      const newUsage = usageRecord.currentUsage + additionalUsage;
      const overageQuantity = Math.max(0, newUsage - usageRecord.usageLimit);
      const overageCharges = overageQuantity * this.getOveragePrice(eventType);

      const updatedUsage = await prisma.customPlanUsage.update({
        where: { id: usageRecord.id },
        data: {
          currentUsage: newUsage,
          overageChargesCents: overageCharges,
          updatedAt: new Date()
        }
      });

      return updatedUsage;
    } catch (error) {
      console.error('Error updating custom plan usage:', error);
      throw new Error('Failed to update custom plan usage');
    }
  }

  /**
   * Reset custom plan usage (monthly/yearly)
   */
  async resetCustomPlanUsage(customPlanId: string): Promise<void> {
    try {
      const customPlan = await prisma.customPlan.findUnique({
        where: { id: customPlanId }
      });

      if (!customPlan) {
        throw new Error('Custom plan not found');
      }

      const resetDate = new Date();
      
      await prisma.customPlanUsage.updateMany({
        where: { customPlanId },
        data: {
          currentUsage: 0,
          overageChargesCents: 0,
          lastResetDate: resetDate,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error resetting custom plan usage:', error);
      throw new Error('Failed to reset custom plan usage');
    }
  }

  /**
   * Get custom plan usage analytics
   */
  async getCustomPlanUsageAnalytics(customPlanId: string): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          cpu.event_type,
          cpu.current_usage,
          cpu.usage_limit,
          cpu.overage_charges_cents,
          ROUND((cpu.current_usage / NULLIF(cpu.usage_limit, 0)) * 100, 2) as usage_percentage
        FROM custom_plan_usage cpu
        WHERE cpu.custom_plan_id = $1
        ORDER BY cpu.current_usage DESC
      `;

      return analytics;
    } catch (error) {
      console.error('Error getting custom plan usage analytics:', error);
      throw new Error('Failed to get custom plan usage analytics');
    }
  }

  /**
   * Check if business should use custom plan
   */
  async shouldUseCustomPlan(businessId: string): Promise<boolean> {
    try {
      const customPlan = await prisma.customPlan.findUnique({
        where: {
          businessId,
          status: 'active'
        }
      });

      return !!customPlan;
    } catch (error) {
      console.error('Error checking custom plan usage:', error);
      return false;
    }
  }

  /**
   * Get custom plan billing information
   */
  async getCustomPlanBillingInfo(businessId: string): Promise<any> {
    try {
      const customPlan = await prisma.customPlan.findUnique({
        where: { businessId },
        include: {
          customPlanUsage: true
        }
      });

      if (!customPlan) {
        return null;
      }

      const totalOverageCharges = customPlan.customPlanUsage.reduce(
        (sum, usage) => sum + usage.overageChargesCents, 0
      );

      return {
        basePrice: customPlan.basePriceCents,
        totalOverageCharges,
        totalCost: customPlan.basePriceCents + totalOverageCharges,
        usage: customPlan.customPlanUsage,
        limits: customPlan.limits,
        discounts: customPlan.discounts,
        features: customPlan.features
      };
    } catch (error) {
      console.error('Error getting custom plan billing info:', error);
      throw new Error('Failed to get custom plan billing info');
    }
  }

  /**
   * Create Stripe price for custom plan
   */
  private async createStripePrice(planData: z.infer<typeof CustomPlanSchema>): Promise<any> {
    try {
      const price = await stripe.prices.create({
        unit_amount: planData.basePriceCents,
        currency: 'usd',
        recurring: {
          interval: planData.billingPeriod === 'yearly' ? 'year' : 'month'
        },
        lookup_key: `custom_plan_${planData.businessId}`,
        metadata: {
          business_id: planData.businessId,
          plan_name: planData.planName,
          custom_plan: 'true'
        }
      });

      return price;
    } catch (error) {
      console.error('Error creating Stripe price:', error);
      throw new Error('Failed to create Stripe price');
    }
  }

  /**
   * Update Stripe price
   */
  private async updateStripePrice(stripePriceId: string, newPriceCents: number): Promise<void> {
    try {
      // Create new price with updated amount
      const oldPrice = await stripe.prices.retrieve(stripePriceId);
      
      const newPrice = await stripe.prices.create({
        unit_amount: newPriceCents,
        currency: oldPrice.currency,
        recurring: oldPrice.recurring,
        lookup_key: `custom_plan_${oldPrice.metadata.business_id}_${Date.now()}`,
        metadata: oldPrice.metadata
      });

      // Archive old price
      await stripe.prices.update(stripePriceId, {
        active: false
      });

      // Update custom plan with new price ID
      await prisma.customPlan.update({
        where: { stripePriceId },
        data: { stripePriceId: newPrice.id }
      });
    } catch (error) {
      console.error('Error updating Stripe price:', error);
      throw new Error('Failed to update Stripe price');
    }
  }

  /**
   * Create usage tracking records
   */
  private async createUsageTracking(customPlanId: string, limits: Record<string, any>): Promise<void> {
    try {
      const usageRecords = Object.entries(limits).map(([eventType, limit]) => ({
        customPlanId,
        eventType,
        currentUsage: 0,
        usageLimit: typeof limit === 'number' ? limit : limit.limit || 0,
        overageChargesCents: 0,
        lastResetDate: new Date()
      }));

      await prisma.customPlanUsage.createMany({
        data: usageRecords
      });
    } catch (error) {
      console.error('Error creating usage tracking:', error);
      throw new Error('Failed to create usage tracking');
    }
  }

  /**
   * Update usage tracking records
   */
  private async updateUsageTracking(customPlanId: string, limits: Record<string, any>): Promise<void> {
    try {
      // Delete existing usage records
      await prisma.customPlanUsage.deleteMany({
        where: { customPlanId }
      });

      // Create new usage records
      await this.createUsageTracking(customPlanId, limits);
    } catch (error) {
      console.error('Error updating usage tracking:', error);
      throw new Error('Failed to update usage tracking');
    }
  }

  /**
   * Get overage price for event type
   */
  private getOveragePrice(eventType: string): number {
    const prices = {
      'api_call': 1,      // $0.01 per API call
      'voice_minute': 2,  // $0.02 per voice minute
      'storage_mb': 0.1,  // $0.001 per MB
      'ai_query': 5       // $0.05 per AI query
    };

    return Math.round((prices[eventType] || 1) * 100); // Convert to cents
  }
}

export const customPlanService = new CustomPlanService();
