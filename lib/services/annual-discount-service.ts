import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const AnnualDiscountCampaignSchema = z.object({
  campaignName: z.string(),
  discountPercentage: z.number().min(0).max(100),
  discountAmountCents: z.number().min(0).default(0),
  minimumPlanPriceCents: z.number().min(0).default(0),
  maximumDiscountCents: z.number().min(0).default(0),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  isActive: z.boolean().default(true),
  targetPlans: z.array(z.string()).default([])
});

const AnnualSubscriptionSchema = z.object({
  businessId: z.string().uuid(),
  originalPlanId: z.string(),
  annualPlanId: z.string(),
  discountCampaignId: z.string().uuid().optional(),
  discountAppliedCents: z.number().min(0).default(0),
  originalPriceCents: z.number().min(0),
  discountedPriceCents: z.number().min(0),
  savingsCents: z.number().min(0),
  subscriptionStartDate: z.string().transform(str => new Date(str)),
  subscriptionEndDate: z.string().transform(str => new Date(str)),
  stripeSubscriptionId: z.string().optional()
});

const AnnualUpgradeOfferSchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid(),
  currentPlanId: z.string(),
  offerMessage: z.string(),
  discountPercentage: z.number().min(0).max(100),
  savingsAmountCents: z.number().min(0)
});

export class AnnualDiscountService {
  /**
   * Create a new annual discount campaign
   */
  async createCampaign(campaignData: z.infer<typeof AnnualDiscountCampaignSchema>): Promise<any> {
    try {
      const campaign = await prisma.annualDiscountCampaign.create({
        data: {
          campaignName: campaignData.campaignName,
          discountPercentage: campaignData.discountPercentage,
          discountAmountCents: campaignData.discountAmountCents,
          minimumPlanPriceCents: campaignData.minimumPlanPriceCents,
          maximumDiscountCents: campaignData.maximumDiscountCents,
          startDate: campaignData.startDate,
          endDate: campaignData.endDate,
          isActive: campaignData.isActive,
          targetPlans: campaignData.targetPlans
        }
      });

      return campaign;
    } catch (error) {
      console.error('Error creating annual discount campaign:', error);
      throw new Error('Failed to create annual discount campaign');
    }
  }

  /**
   * Get active annual discount campaigns
   */
  async getActiveCampaigns(): Promise<any[]> {
    try {
      const campaigns = await prisma.annualDiscountCampaign.findMany({
        where: {
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      return campaigns;
    } catch (error) {
      console.error('Error getting active campaigns:', error);
      throw new Error('Failed to get active campaigns');
    }
  }

  /**
   * Check if a business is eligible for annual discount
   */
  async checkEligibility(businessId: string, campaignId: string): Promise<boolean> {
    try {
      const campaign = await prisma.annualDiscountCampaign.findUnique({
        where: { id: campaignId }
      });

      if (!campaign || !campaign.isActive) {
        return false;
      }

      // Check if campaign is currently active
      const now = new Date();
      if (now < campaign.startDate || now > campaign.endDate) {
        return false;
      }

      // Get business current subscription
      const subscription = await prisma.subscription.findFirst({
        where: {
          businessId,
          status: 'active'
        },
        include: { planDefinition: true }
      });

      if (!subscription) {
        return false;
      }

      // Check if plan is eligible
      if (campaign.targetPlans.length > 0 && !campaign.targetPlans.includes(subscription.planId)) {
        return false;
      }

      // Check minimum plan price
      if (campaign.minimumPlanPriceCents > 0 && subscription.planDefinition.priceCents < campaign.minimumPlanPriceCents) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking eligibility:', error);
      return false;
    }
  }

  /**
   * Calculate annual discount savings
   */
  async calculateSavings(businessId: string, campaignId: string): Promise<any> {
    try {
      const campaign = await prisma.annualDiscountCampaign.findUnique({
        where: { id: campaignId }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          businessId,
          status: 'active'
        },
        include: { planDefinition: true }
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const monthlyPrice = subscription.planDefinition.priceCents;
      const annualPrice = monthlyPrice * 12;

      let discountAmount = 0;

      if (campaign.discountPercentage > 0) {
        discountAmount = Math.round(annualPrice * (campaign.discountPercentage / 100));
      } else if (campaign.discountAmountCents > 0) {
        discountAmount = campaign.discountAmountCents;
      }

      // Apply maximum discount cap
      if (campaign.maximumDiscountCents > 0 && discountAmount > campaign.maximumDiscountCents) {
        discountAmount = campaign.maximumDiscountCents;
      }

      const discountedPrice = annualPrice - discountAmount;
      const savings = discountAmount;

      return {
        originalAnnualPrice: annualPrice,
        discountAmount,
        discountedPrice,
        savings,
        discountPercentage: campaign.discountPercentage,
        monthlyEquivalent: Math.round(discountedPrice / 12)
      };
    } catch (error) {
      console.error('Error calculating savings:', error);
      throw new Error('Failed to calculate savings');
    }
  }

  /**
   * Create annual upgrade offer for a business
   */
  async createUpgradeOffer(offerData: z.infer<typeof AnnualUpgradeOfferSchema>): Promise<any> {
    try {
      const offer = await prisma.annualUpgradeOffer.create({
        data: {
          businessId: offerData.businessId,
          campaignId: offerData.campaignId,
          currentPlanId: offerData.currentPlanId,
          offerMessage: offerData.offerMessage,
          discountPercentage: offerData.discountPercentage,
          savingsAmountCents: offerData.savingsAmountCents
        }
      });

      return offer;
    } catch (error) {
      console.error('Error creating upgrade offer:', error);
      throw new Error('Failed to create upgrade offer');
    }
  }

  /**
   * Get annual upgrade offers for a business
   */
  async getUpgradeOffers(businessId: string): Promise<any[]> {
    try {
      const offers = await prisma.annualUpgradeOffer.findMany({
        where: {
          businessId,
          dismissedAt: null,
          acceptedAt: null
        },
        include: {
          campaign: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return offers;
    } catch (error) {
      console.error('Error getting upgrade offers:', error);
      throw new Error('Failed to get upgrade offers');
    }
  }

  /**
   * Process annual subscription upgrade
   */
  async processAnnualUpgrade(
    businessId: string, 
    campaignId: string, 
    stripeSubscriptionId?: string
  ): Promise<any> {
    try {
      const campaign = await prisma.annualDiscountCampaign.findUnique({
        where: { id: campaignId }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const subscription = await prisma.subscription.findFirst({
        where: {
          businessId,
          status: 'active'
        },
        include: { planDefinition: true }
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const savings = await this.calculateSavings(businessId, campaignId);

      // Create annual subscription record
      const annualSubscription = await prisma.annualSubscription.create({
        data: {
          businessId,
          originalPlanId: subscription.planId,
          annualPlanId: subscription.planId, // Same plan, but annual billing
          discountCampaignId: campaignId,
          discountAppliedCents: savings.discountAmount,
          originalPriceCents: savings.originalAnnualPrice,
          discountedPriceCents: savings.discountedPrice,
          savingsCents: savings.savings,
          subscriptionStartDate: new Date(),
          subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          stripeSubscriptionId
        }
      });

      // Update business subscription to annual
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          billingInterval: 'year',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });

      return annualSubscription;
    } catch (error) {
      console.error('Error processing annual upgrade:', error);
      throw new Error('Failed to process annual upgrade');
    }
  }

  /**
   * Mark upgrade offer as shown
   */
  async markOfferAsShown(offerId: string): Promise<any> {
    try {
      const offer = await prisma.annualUpgradeOffer.update({
        where: { id: offerId },
        data: { shownAt: new Date() }
      });

      return offer;
    } catch (error) {
      console.error('Error marking offer as shown:', error);
      throw new Error('Failed to mark offer as shown');
    }
  }

  /**
   * Dismiss upgrade offer
   */
  async dismissOffer(offerId: string): Promise<any> {
    try {
      const offer = await prisma.annualUpgradeOffer.update({
        where: { id: offerId },
        data: { dismissedAt: new Date() }
      });

      return offer;
    } catch (error) {
      console.error('Error dismissing offer:', error);
      throw new Error('Failed to dismiss offer');
    }
  }

  /**
   * Accept upgrade offer
   */
  async acceptOffer(offerId: string): Promise<any> {
    try {
      const offer = await prisma.annualUpgradeOffer.update({
        where: { id: offerId },
        data: { acceptedAt: new Date() }
      });

      // Process the annual upgrade
      await this.processAnnualUpgrade(offer.businessId, offer.campaignId);

      return offer;
    } catch (error) {
      console.error('Error accepting offer:', error);
      throw new Error('Failed to accept offer');
    }
  }

  /**
   * Get annual subscription analytics
   */
  async getAnnualAnalytics(): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_annual_subscriptions,
          COALESCE(SUM(savings_cents), 0) as total_savings_cents,
          COALESCE(AVG(savings_cents), 0) as average_savings_cents,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_upgrades
        FROM annual_subscriptions
        WHERE subscription_start_date >= NOW() - INTERVAL '1 year'
      `;

      return analytics[0];
    } catch (error) {
      console.error('Error getting annual analytics:', error);
      throw new Error('Failed to get annual analytics');
    }
  }

  /**
   * Get businesses eligible for annual discounts
   */
  async getEligibleBusinesses(campaignId: string): Promise<any[]> {
    try {
      const campaign = await prisma.annualDiscountCampaign.findUnique({
        where: { id: campaignId }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const eligibleBusinesses = await prisma.business.findMany({
        where: {
          subscriptions: {
            some: {
              status: 'active',
              planId: campaign.targetPlans.length > 0 ? { in: campaign.targetPlans } : undefined,
              planDefinition: {
                priceCents: { gte: campaign.minimumPlanPriceCents }
              }
            }
          }
        },
        include: {
          subscriptions: {
            where: { status: 'active' },
            include: { planDefinition: true }
          }
        }
      });

      return eligibleBusinesses;
    } catch (error) {
      console.error('Error getting eligible businesses:', error);
      throw new Error('Failed to get eligible businesses');
    }
  }

  /**
   * Create upgrade offers for eligible businesses
   */
  async createUpgradeOffersForEligibleBusinesses(campaignId: string): Promise<void> {
    try {
      const eligibleBusinesses = await this.getEligibleBusinesses(campaignId);

      for (const business of eligibleBusinesses) {
        try {
          const savings = await this.calculateSavings(business.id, campaignId);
          
          await this.createUpgradeOffer({
            businessId: business.id,
            campaignId,
            currentPlanId: business.subscriptions[0].planId,
            offerMessage: `Save $${(savings.savings / 100).toFixed(2)} with our annual plan!`,
            discountPercentage: savings.discountPercentage,
            savingsAmountCents: savings.savings
          });
        } catch (error) {
          console.error(`Error creating offer for business ${business.id}:`, error);
          // Continue with other businesses
        }
      }
    } catch (error) {
      console.error('Error creating upgrade offers:', error);
      throw new Error('Failed to create upgrade offers');
    }
  }
}

export const annualDiscountService = new AnnualDiscountService();
