import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const WinbackCampaignSchema = z.object({
  campaignName: z.string(),
  campaignType: z.enum(['email', 'dashboard', 'in_app']),
  triggerConditions: z.record(z.any()),
  incentiveType: z.enum(['discount', 'credit', 'free_months']),
  incentiveValue: z.record(z.any()),
  messageTemplate: z.string(),
  ctaText: z.string(),
  isActive: z.boolean().default(true)
});

const ChurnEventSchema = z.object({
  businessId: z.string().uuid(),
  churnDate: z.string().transform(str => new Date(str)),
  churnReason: z.enum(['cancelled', 'payment_failed', 'inactive']).optional(),
  lastPaymentDate: z.string().transform(str => new Date(str)).optional(),
  totalRevenueLostCents: z.number().min(0).default(0)
});

const WinbackInteractionSchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid(),
  interactionType: z.enum(['email_sent', 'dashboard_shown', 'cta_clicked', 'offer_accepted', 'offer_declined']),
  interactionData: z.record(z.any()).default({}),
  incentiveOffered: z.record(z.any()),
  userResponse: z.enum(['accepted', 'dismissed', 'ignored']).optional()
});

export class WinbackService {
  /**
   * Create a new win-back campaign
   */
  async createCampaign(campaignData: z.infer<typeof WinbackCampaignSchema>): Promise<any> {
    try {
      const campaign = await prisma.winbackCampaign.create({
        data: {
          campaignName: campaignData.campaignName,
          campaignType: campaignData.campaignType,
          triggerConditions: campaignData.triggerConditions,
          incentiveType: campaignData.incentiveType,
          incentiveValue: campaignData.incentiveValue,
          messageTemplate: campaignData.messageTemplate,
          ctaText: campaignData.ctaText,
          isActive: campaignData.isActive
        }
      });

      return campaign;
    } catch (error) {
      console.error('Error creating win-back campaign:', error);
      throw new Error('Failed to create win-back campaign');
    }
  }

  /**
   * Detect and record churn events
   */
  async detectChurn(businessId: string, churnReason: string = 'cancelled'): Promise<any> {
    try {
      // Get business subscription info
      const subscription = await prisma.subscription.findFirst({
        where: {
          businessId,
          status: { in: ['canceled', 'past_due'] }
        },
        include: { planDefinition: true }
      });

      if (!subscription) {
        throw new Error('No subscription found for churn detection');
      }

      // Get last payment date
      const lastPayment = await prisma.paymentHistory.findFirst({
        where: {
          businessId,
          status: 'succeeded'
        },
        orderBy: { processedAt: 'desc' }
      });

      const lastPaymentDate = lastPayment?.processedAt || subscription.createdAt;
      const daysSinceLastPayment = Math.floor(
        (Date.now() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate total revenue lost
      const totalRevenue = await prisma.paymentHistory.aggregate({
        where: {
          businessId,
          status: 'succeeded'
        },
        _sum: { amount: true }
      });

      const totalRevenueLostCents = totalRevenue._sum.amount || 0;

      // Create churn event
      const churnEvent = await prisma.churnEvent.create({
        data: {
          businessId,
          churnDate: new Date(),
          churnReason,
          lastPaymentDate,
          daysSinceLastPayment,
          totalRevenueLostCents
        }
      });

      return churnEvent;
    } catch (error) {
      console.error('Error detecting churn:', error);
      throw new Error('Failed to detect churn');
    }
  }

  /**
   * Get businesses eligible for win-back campaigns
   */
  async getEligibleBusinesses(): Promise<any[]> {
    try {
      const eligibleBusinesses = await prisma.business.findMany({
        where: {
          churnEvents: {
            some: {
              churnDate: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
              },
              winbackAttemptedAt: null
            }
          }
        },
        include: {
          churnEvents: {
            where: {
              churnDate: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
              }
            },
            orderBy: { churnDate: 'desc' },
            take: 1
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
   * Get appropriate win-back campaign for a business
   */
  async getAppropriateCampaign(businessId: string): Promise<any> {
    try {
      const churnEvent = await prisma.churnEvent.findFirst({
        where: {
          businessId,
          winbackAttemptedAt: null
        },
        orderBy: { churnDate: 'desc' }
      });

      if (!churnEvent) {
        return null;
      }

      const daysSinceChurn = Math.floor(
        (Date.now() - churnEvent.churnDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Find campaign that matches trigger conditions
      const campaigns = await prisma.winbackCampaign.findMany({
        where: { isActive: true }
      });

      for (const campaign of campaigns) {
        const conditions = campaign.triggerConditions;
        
        // Check days since churn condition
        if (conditions.daysSinceChurn) {
          const { min, max } = conditions.daysSinceChurn;
          if (daysSinceChurn < min || (max && daysSinceChurn > max)) {
            continue;
          }
        }

        // Check churn reason condition
        if (conditions.churnReason && !conditions.churnReason.includes(churnEvent.churnReason)) {
          continue;
        }

        // Check revenue lost condition
        if (conditions.minRevenueLost && churnEvent.totalRevenueLostCents < conditions.minRevenueLost) {
          continue;
        }

        return campaign;
      }

      return null;
    } catch (error) {
      console.error('Error getting appropriate campaign:', error);
      return null;
    }
  }

  /**
   * Execute win-back campaign for a business
   */
  async executeWinbackCampaign(businessId: string, campaignId: string): Promise<any> {
    try {
      const campaign = await prisma.winbackCampaign.findUnique({
        where: { id: campaignId }
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const churnEvent = await prisma.churnEvent.findFirst({
        where: {
          businessId,
          winbackAttemptedAt: null
        },
        orderBy: { churnDate: 'desc' }
      });

      if (!churnEvent) {
        throw new Error('No churn event found');
      }

      // Create win-back interaction
      const interaction = await prisma.winbackInteraction.create({
        data: {
          businessId,
          campaignId,
          interactionType: this.getInitialInteractionType(campaign.campaignType),
          interactionData: {
            campaignType: campaign.campaignType,
            churnDate: churnEvent.churnDate,
            daysSinceChurn: Math.floor(
              (Date.now() - churnEvent.churnDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          },
          incentiveOffered: campaign.incentiveValue
        }
      });

      // Mark churn event as win-back attempted
      await prisma.churnEvent.update({
        where: { id: churnEvent.id },
        data: {
          winbackCampaignId: campaignId,
          winbackAttemptedAt: new Date()
        }
      });

      // Execute campaign-specific actions
      await this.executeCampaignActions(businessId, campaign, interaction);

      return interaction;
    } catch (error) {
      console.error('Error executing win-back campaign:', error);
      throw new Error('Failed to execute win-back campaign');
    }
  }

  /**
   * Record win-back interaction
   */
  async recordInteraction(interactionData: z.infer<typeof WinbackInteractionSchema>): Promise<any> {
    try {
      const interaction = await prisma.winbackInteraction.create({
        data: {
          businessId: interactionData.businessId,
          campaignId: interactionData.campaignId,
          interactionType: interactionData.interactionType,
          interactionData: interactionData.interactionData,
          incentiveOffered: interactionData.incentiveOffered,
          userResponse: interactionData.userResponse,
          responseDate: interactionData.userResponse ? new Date() : null
        }
      });

      return interaction;
    } catch (error) {
      console.error('Error recording interaction:', error);
      throw new Error('Failed to record interaction');
    }
  }

  /**
   * Process win-back success
   */
  async processWinbackSuccess(businessId: string, campaignId: string): Promise<any> {
    try {
      // Update churn event as successful
      const churnEvent = await prisma.churnEvent.findFirst({
        where: {
          businessId,
          winbackCampaignId: campaignId
        },
        orderBy: { churnDate: 'desc' }
      });

      if (churnEvent) {
        await prisma.churnEvent.update({
          where: { id: churnEvent.id },
          data: { winbackSuccessfulAt: new Date() }
        });
      }

      // Record success interaction
      await this.recordInteraction({
        businessId,
        campaignId,
        interactionType: 'offer_accepted',
        interactionData: { success: true, timestamp: new Date() },
        incentiveOffered: {},
        userResponse: 'accepted'
      });

      return { success: true };
    } catch (error) {
      console.error('Error processing win-back success:', error);
      throw new Error('Failed to process win-back success');
    }
  }

  /**
   * Get win-back campaign analytics
   */
  async getWinbackAnalytics(): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_churn_events,
          COUNT(CASE WHEN winback_attempted_at IS NOT NULL THEN 1 END) as winback_attempts,
          COUNT(CASE WHEN winback_successful_at IS NOT NULL THEN 1 END) as successful_winbacks,
          ROUND(
            COUNT(CASE WHEN winback_successful_at IS NOT NULL THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(CASE WHEN winback_attempted_at IS NOT NULL THEN 1 END), 0) * 100, 2
          ) as winback_success_rate,
          COALESCE(SUM(total_revenue_lost_cents), 0) as total_revenue_at_risk_cents
        FROM churn_events
        WHERE churn_date >= NOW() - INTERVAL '90 days'
      `;

      return analytics[0];
    } catch (error) {
      console.error('Error getting win-back analytics:', error);
      throw new Error('Failed to get win-back analytics');
    }
  }

  /**
   * Get win-back interactions for a business
   */
  async getBusinessWinbackInteractions(businessId: string): Promise<any[]> {
    try {
      const interactions = await prisma.winbackInteraction.findMany({
        where: { businessId },
        include: {
          campaign: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return interactions;
    } catch (error) {
      console.error('Error getting business win-back interactions:', error);
      throw new Error('Failed to get business win-back interactions');
    }
  }

  /**
   * Process all eligible businesses for win-back campaigns
   */
  async processEligibleBusinesses(): Promise<void> {
    try {
      const eligibleBusinesses = await this.getEligibleBusinesses();

      for (const business of eligibleBusinesses) {
        try {
          const campaign = await this.getAppropriateCampaign(business.id);
          
          if (campaign) {
            await this.executeWinbackCampaign(business.id, campaign.id);
          }
        } catch (error) {
          console.error(`Error processing win-back for business ${business.id}:`, error);
          // Continue with other businesses
        }
      }
    } catch (error) {
      console.error('Error processing eligible businesses:', error);
      throw new Error('Failed to process eligible businesses');
    }
  }

  /**
   * Get initial interaction type based on campaign type
   */
  private getInitialInteractionType(campaignType: string): string {
    switch (campaignType) {
      case 'email':
        return 'email_sent';
      case 'dashboard':
        return 'dashboard_shown';
      case 'in_app':
        return 'dashboard_shown';
      default:
        return 'email_sent';
    }
  }

  /**
   * Execute campaign-specific actions
   */
  private async executeCampaignActions(businessId: string, campaign: any, interaction: any): Promise<void> {
    try {
      switch (campaign.campaignType) {
        case 'email':
          await this.sendWinbackEmail(businessId, campaign, interaction);
          break;
        case 'dashboard':
          await this.showDashboardBanner(businessId, campaign, interaction);
          break;
        case 'in_app':
          await this.showInAppNotification(businessId, campaign, interaction);
          break;
      }
    } catch (error) {
      console.error('Error executing campaign actions:', error);
      throw new Error('Failed to execute campaign actions');
    }
  }

  /**
   * Send win-back email
   */
  private async sendWinbackEmail(businessId: string, campaign: any, interaction: any): Promise<void> {
    // TODO: Integrate with email service
    console.log(`Sending win-back email to business ${businessId} for campaign ${campaign.id}`);
  }

  /**
   * Show dashboard banner
   */
  private async showDashboardBanner(businessId: string, campaign: any, interaction: any): Promise<void> {
    // TODO: Create dashboard banner notification
    console.log(`Showing dashboard banner for business ${businessId} for campaign ${campaign.id}`);
  }

  /**
   * Show in-app notification
   */
  private async showInAppNotification(businessId: string, campaign: any, interaction: any): Promise<void> {
    // TODO: Create in-app notification
    console.log(`Showing in-app notification for business ${businessId} for campaign ${campaign.id}`);
  }
}

export const winbackService = new WinbackService();
