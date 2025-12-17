import { PrismaClient } from '@prisma/client';
import { onboardingService } from './onboarding-service';
import { upgradeRecommendationService } from './upgrade-recommendation-service';
import { referralService } from './referral-service';
import { annualDiscountService } from './annual-discount-service';
import { winbackService } from './winback-service';

const prisma = new PrismaClient();

export class GrowthRetentionService {
  /**
   * Initialize growth and retention features for a new business
   */
  async initializeBusiness(businessId: string): Promise<any> {
    try {
      // Initialize onboarding progress
      await onboardingService.initializeOnboarding(businessId);

      // Generate referral link
      const referralLink = await referralService.createReferralLink(businessId);

      return {
        onboardingInitialized: true,
        referralLink
      };
    } catch (error) {
      console.error('Error initializing business for growth features:', error);
      throw new Error('Failed to initialize business for growth features');
    }
  }

  /**
   * Process daily growth and retention tasks
   */
  async processDailyTasks(): Promise<any> {
    try {
      const results = {
        onboardingNudges: 0,
        upgradeRecommendations: 0,
        referralCredits: 0,
        annualOffers: 0,
        winbackCampaigns: 0
      };

      // Process onboarding nudges
      try {
        await this.processOnboardingNudges();
        results.onboardingNudges = 1;
      } catch (error) {
        console.error('Error processing onboarding nudges:', error);
      }

      // Generate upgrade recommendations
      try {
        await this.processUpgradeRecommendations();
        results.upgradeRecommendations = 1;
      } catch (error) {
        console.error('Error processing upgrade recommendations:', error);
      }

      // Process referral credits
      try {
        await referralService.processPendingReferrals();
        results.referralCredits = 1;
      } catch (error) {
        console.error('Error processing referral credits:', error);
      }

      // Create annual upgrade offers
      try {
        await this.processAnnualOffers();
        results.annualOffers = 1;
      } catch (error) {
        console.error('Error processing annual offers:', error);
      }

      // Execute win-back campaigns
      try {
        await winbackService.processEligibleBusinesses();
        results.winbackCampaigns = 1;
      } catch (error) {
        console.error('Error processing win-back campaigns:', error);
      }

      return results;
    } catch (error) {
      console.error('Error processing daily tasks:', error);
      throw new Error('Failed to process daily tasks');
    }
  }

  /**
   * Get comprehensive growth and retention dashboard data
   */
  async getDashboardData(businessId: string): Promise<any> {
    try {
      const [
        onboardingProgress,
        upgradeRecommendations,
        referralStats,
        annualOffers,
        winbackInteractions
      ] = await Promise.all([
        onboardingService.getOnboardingProgress(businessId),
        upgradeRecommendationService.getRecommendations(businessId),
        referralService.getReferralStats(businessId),
        annualDiscountService.getUpgradeOffers(businessId),
        winbackService.getBusinessWinbackInteractions(businessId)
      ]);

      return {
        onboarding: onboardingProgress,
        upgrades: upgradeRecommendations,
        referrals: referralStats,
        annualDiscounts: annualOffers,
        winback: winbackInteractions
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw new Error('Failed to get dashboard data');
    }
  }

  /**
   * Get growth and retention analytics
   */
  async getAnalytics(): Promise<any> {
    try {
      const [
        onboardingAnalytics,
        upgradeAnalytics,
        referralAnalytics,
        annualAnalytics,
        winbackAnalytics
      ] = await Promise.all([
        onboardingService.getOnboardingAnalytics(),
        upgradeRecommendationService.getUpgradeAnalytics(),
        referralService.getReferralAnalytics(),
        annualDiscountService.getAnnualAnalytics(),
        winbackService.getWinbackAnalytics()
      ]);

      return {
        onboarding: onboardingAnalytics,
        upgrades: upgradeAnalytics,
        referrals: referralAnalytics,
        annualDiscounts: annualAnalytics,
        winback: winbackAnalytics
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw new Error('Failed to get analytics');
    }
  }

  /**
   * Track business activation event
   */
  async trackActivationEvent(
    businessId: string, 
    eventType: string, 
    eventData: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Track in onboarding service
      await onboardingService.trackActivationEvent(businessId, eventType, eventData);

      // Check if this triggers upgrade recommendations
      if (['first_agent_created', 'first_call_completed', 'integration_connected'].includes(eventType)) {
        await upgradeRecommendationService.analyzeUsageAndRecommendUpgrades(businessId);
      }
    } catch (error) {
      console.error('Error tracking activation event:', error);
    }
  }

  /**
   * Process onboarding nudges for all businesses
   */
  private async processOnboardingNudges(): Promise<void> {
    try {
      const businessesWithIncompleteOnboarding = await prisma.business.findMany({
        where: {
          onboardingProgress: {
            some: {
              completedAt: null,
              lastActivityAt: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last activity more than 24 hours ago
              }
            }
          }
        },
        include: {
          onboardingProgress: true
        }
      });

      for (const business of businessesWithIncompleteOnboarding) {
        try {
          const progress = business.onboardingProgress[0];
          const nudges = await onboardingService.getActiveNudges(business.id);
          
          if (nudges.length === 0) {
            // Create new nudge if none exists
            await onboardingService.createNudge({
              businessId: business.id,
              nudgeType: 'email',
              nudgeContent: {
                title: 'Continue Your VOCA Setup',
                message: 'You\'re almost there! Complete your setup to unlock the full potential of your AI chatbot.',
                cta: 'Continue Setup'
              },
              targetStep: progress.currentStep,
              triggerCondition: { delayHours: 24 }
            });
          }
        } catch (error) {
          console.error(`Error processing onboarding nudge for business ${business.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing onboarding nudges:', error);
      throw new Error('Failed to process onboarding nudges');
    }
  }

  /**
   * Process upgrade recommendations for all businesses
   */
  private async processUpgradeRecommendations(): Promise<void> {
    try {
      const activeBusinesses = await prisma.business.findMany({
        where: {
          subscriptions: {
            some: { status: 'active' }
          }
        }
      });

      for (const business of activeBusinesses) {
        try {
          await upgradeRecommendationService.analyzeUsageAndRecommendUpgrades(business.id);
        } catch (error) {
          console.error(`Error processing upgrade recommendations for business ${business.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing upgrade recommendations:', error);
      throw new Error('Failed to process upgrade recommendations');
    }
  }

  /**
   * Process annual upgrade offers
   */
  private async processAnnualOffers(): Promise<void> {
    try {
      const activeCampaigns = await annualDiscountService.getActiveCampaigns();

      for (const campaign of activeCampaigns) {
        try {
          await annualDiscountService.createUpgradeOffersForEligibleBusinesses(campaign.id);
        } catch (error) {
          console.error(`Error processing annual offers for campaign ${campaign.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing annual offers:', error);
      throw new Error('Failed to process annual offers');
    }
  }

  /**
   * Get feature flag status
   */
  async getFeatureFlags(): Promise<any> {
    try {
      const flags = await prisma.featureFlag.findMany({
        where: { isEnabled: true }
      });

      return flags.reduce((acc, flag) => {
        acc[flag.flagName] = {
          enabled: flag.isEnabled,
          rolloutPercentage: flag.rolloutPercentage,
          targetPlans: flag.targetPlans,
          targetBusinesses: flag.targetBusinesses
        };
        return acc;
      }, {});
    } catch (error) {
      console.error('Error getting feature flags:', error);
      throw new Error('Failed to get feature flags');
    }
  }

  /**
   * Check if a business is eligible for a feature
   */
  async isBusinessEligibleForFeature(businessId: string, featureName: string): Promise<boolean> {
    try {
      const flag = await prisma.featureFlag.findUnique({
        where: { flagName: featureName }
      });

      if (!flag || !flag.isEnabled) {
        return false;
      }

      // Check rollout percentage
      if (flag.rolloutPercentage < 100) {
        const businessHash = this.hashBusinessId(businessId);
        const rolloutThreshold = flag.rolloutPercentage;
        if (businessHash > rolloutThreshold) {
          return false;
        }
      }

      // Check target plans
      if (flag.targetPlans.length > 0) {
        const subscription = await prisma.subscription.findFirst({
          where: {
            businessId,
            status: 'active'
          }
        });

        if (!subscription || !flag.targetPlans.includes(subscription.planId)) {
          return false;
        }
      }

      // Check target businesses
      if (flag.targetBusinesses.length > 0 && !flag.targetBusinesses.includes(businessId)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking feature eligibility:', error);
      return false;
    }
  }

  /**
   * Hash business ID for consistent rollout
   */
  private hashBusinessId(businessId: string): number {
    let hash = 0;
    for (let i = 0; i < businessId.length; i++) {
      const char = businessId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Get campaign settings
   */
  async getCampaignSettings(): Promise<any> {
    try {
      const settings = await prisma.campaignSetting.findMany({
        where: { isActive: true }
      });

      return settings.reduce((acc, setting) => {
        acc[setting.settingKey] = setting.settingValue;
        return acc;
      }, {});
    } catch (error) {
      console.error('Error getting campaign settings:', error);
      throw new Error('Failed to get campaign settings');
    }
  }

  /**
   * Update campaign setting
   */
  async updateCampaignSetting(key: string, value: any): Promise<any> {
    try {
      const setting = await prisma.campaignSetting.upsert({
        where: { settingKey: key },
        update: { settingValue: value },
        create: {
          settingKey: key,
          settingValue: value,
          isActive: true
        }
      });

      return setting;
    } catch (error) {
      console.error('Error updating campaign setting:', error);
      throw new Error('Failed to update campaign setting');
    }
  }
}

export const growthRetentionService = new GrowthRetentionService();
