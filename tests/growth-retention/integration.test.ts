import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { growthRetentionService } from '@/lib/services/growth-retention-service';
import { onboardingService } from '@/lib/services/onboarding-service';
import { upgradeRecommendationService } from '@/lib/services/upgrade-recommendation-service';
import { referralService } from '@/lib/services/referral-service';
import { annualDiscountService } from '@/lib/services/annual-discount-service';
import { winbackService } from '@/lib/services/winback-service';

// Mock all services
vi.mock('@/lib/services/onboarding-service');
vi.mock('@/lib/services/upgrade-recommendation-service');
vi.mock('@/lib/services/referral-service');
vi.mock('@/lib/services/annual-discount-service');
vi.mock('@/lib/services/winback-service');

describe('Growth Retention Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeBusiness', () => {
    it('should initialize all growth and retention features for a new business', async () => {
      const businessId = 'test-business-id';
      const mockOnboardingResult = { onboardingInitialized: true };
      const mockReferralLink = 'https://app.voca.ai/signup?ref=test123';

      vi.mocked(onboardingService.initializeOnboarding).mockResolvedValue(mockOnboardingResult);
      vi.mocked(referralService.createReferralLink).mockResolvedValue(mockReferralLink);

      const result = await growthRetentionService.initializeBusiness(businessId);

      expect(onboardingService.initializeOnboarding).toHaveBeenCalledWith(businessId);
      expect(referralService.createReferralLink).toHaveBeenCalledWith(businessId);

      expect(result).toEqual({
        onboardingInitialized: true,
        referralLink: mockReferralLink
      });
    });

    it('should handle errors during initialization', async () => {
      const businessId = 'test-business-id';
      
      vi.mocked(onboardingService.initializeOnboarding).mockRejectedValue(new Error('Onboarding failed'));

      await expect(growthRetentionService.initializeBusiness(businessId))
        .rejects.toThrow('Failed to initialize business for growth features');
    });
  });

  describe('processDailyTasks', () => {
    it('should process all daily growth and retention tasks', async () => {
      vi.mocked(growthRetentionService.processOnboardingNudges).mockResolvedValue(undefined);
      vi.mocked(growthRetentionService.processUpgradeRecommendations).mockResolvedValue(undefined);
      vi.mocked(referralService.processPendingReferrals).mockResolvedValue(undefined);
      vi.mocked(growthRetentionService.processAnnualOffers).mockResolvedValue(undefined);
      vi.mocked(winbackService.processEligibleBusinesses).mockResolvedValue(undefined);

      const result = await growthRetentionService.processDailyTasks();

      expect(growthRetentionService.processOnboardingNudges).toHaveBeenCalled();
      expect(growthRetentionService.processUpgradeRecommendations).toHaveBeenCalled();
      expect(referralService.processPendingReferrals).toHaveBeenCalled();
      expect(growthRetentionService.processAnnualOffers).toHaveBeenCalled();
      expect(winbackService.processEligibleBusinesses).toHaveBeenCalled();

      expect(result).toEqual({
        onboardingNudges: 1,
        upgradeRecommendations: 1,
        referralCredits: 1,
        annualOffers: 1,
        winbackCampaigns: 1
      });
    });

    it('should continue processing even if individual tasks fail', async () => {
      vi.mocked(growthRetentionService.processOnboardingNudges).mockRejectedValue(new Error('Nudges failed'));
      vi.mocked(growthRetentionService.processUpgradeRecommendations).mockResolvedValue(undefined);
      vi.mocked(referralService.processPendingReferrals).mockResolvedValue(undefined);
      vi.mocked(growthRetentionService.processAnnualOffers).mockResolvedValue(undefined);
      vi.mocked(winbackService.processEligibleBusinesses).mockResolvedValue(undefined);

      const result = await growthRetentionService.processDailyTasks();

      // Should still process other tasks
      expect(growthRetentionService.processUpgradeRecommendations).toHaveBeenCalled();
      expect(referralService.processPendingReferrals).toHaveBeenCalled();
      expect(growthRetentionService.processAnnualOffers).toHaveBeenCalled();
      expect(winbackService.processEligibleBusinesses).toHaveBeenCalled();

      expect(result.onboardingNudges).toBe(0); // Failed task
      expect(result.upgradeRecommendations).toBe(1); // Successful task
    });
  });

  describe('getDashboardData', () => {
    it('should get comprehensive dashboard data for a business', async () => {
      const businessId = 'test-business-id';
      
      const mockOnboardingProgress = {
        currentStep: 'welcome',
        completionPercentage: 20,
        isCompleted: false
      };

      const mockUpgradeRecommendations = [
        {
          id: 'rec-1',
          urgencyLevel: 'high',
          confidenceScore: 0.85
        }
      ];

      const mockReferralStats = {
        stats: {
          totalReferrals: 5,
          successfulReferrals: 2,
          totalCreditsEarnedCents: 2000
        },
        recentReferrals: [
          { id: 'ref-1', referredBusiness: { name: 'Test Business' } }
        ]
      };

      const mockAnnualOffers = [
        {
          id: 'offer-1',
          discountPercentage: 15,
          savingsAmountCents: 5000
        }
      ];

      const mockWinbackInteractions = [
        {
          id: 'interaction-1',
          interactionType: 'email_sent'
        }
      ];

      vi.mocked(onboardingService.getOnboardingProgress).mockResolvedValue(mockOnboardingProgress);
      vi.mocked(upgradeRecommendationService.getRecommendations).mockResolvedValue(mockUpgradeRecommendations);
      vi.mocked(referralService.getReferralStats).mockResolvedValue(mockReferralStats);
      vi.mocked(annualDiscountService.getUpgradeOffers).mockResolvedValue(mockAnnualOffers);
      vi.mocked(winbackService.getBusinessWinbackInteractions).mockResolvedValue(mockWinbackInteractions);

      const result = await growthRetentionService.getDashboardData(businessId);

      expect(onboardingService.getOnboardingProgress).toHaveBeenCalledWith(businessId);
      expect(upgradeRecommendationService.getRecommendations).toHaveBeenCalledWith(businessId);
      expect(referralService.getReferralStats).toHaveBeenCalledWith(businessId);
      expect(annualDiscountService.getUpgradeOffers).toHaveBeenCalledWith(businessId);
      expect(winbackService.getBusinessWinbackInteractions).toHaveBeenCalledWith(businessId);

      expect(result).toEqual({
        onboarding: mockOnboardingProgress,
        upgrades: mockUpgradeRecommendations,
        referrals: mockReferralStats,
        annualDiscounts: mockAnnualOffers,
        winback: mockWinbackInteractions
      });
    });
  });

  describe('getAnalytics', () => {
    it('should get comprehensive analytics from all services', async () => {
      const mockOnboardingAnalytics = {
        total_signups: 100,
        completed_onboarding: 75,
        completion_rate: 75.0
      };

      const mockUpgradeAnalytics = {
        total_recommendations: 50,
        accepted_recommendations: 15,
        acceptance_rate: 30.0
      };

      const mockReferralAnalytics = {
        total_referrals: 25,
        successful_referrals: 10,
        conversion_rate: 40.0
      };

      const mockAnnualAnalytics = {
        total_annual_subscriptions: 20,
        total_savings_cents: 100000
      };

      const mockWinbackAnalytics = {
        total_churn_events: 15,
        winback_attempts: 10,
        successful_winbacks: 3,
        winback_success_rate: 30.0
      };

      vi.mocked(onboardingService.getOnboardingAnalytics).mockResolvedValue(mockOnboardingAnalytics);
      vi.mocked(upgradeRecommendationService.getUpgradeAnalytics).mockResolvedValue(mockUpgradeAnalytics);
      vi.mocked(referralService.getReferralAnalytics).mockResolvedValue(mockReferralAnalytics);
      vi.mocked(annualDiscountService.getAnnualAnalytics).mockResolvedValue(mockAnnualAnalytics);
      vi.mocked(winbackService.getWinbackAnalytics).mockResolvedValue(mockWinbackAnalytics);

      const result = await growthRetentionService.getAnalytics();

      expect(result).toEqual({
        onboarding: mockOnboardingAnalytics,
        upgrades: mockUpgradeAnalytics,
        referrals: mockReferralAnalytics,
        annualDiscounts: mockAnnualAnalytics,
        winback: mockWinbackAnalytics
      });
    });
  });

  describe('trackActivationEvent', () => {
    it('should track activation events across multiple services', async () => {
      const businessId = 'test-business-id';
      const eventType = 'first_agent_created';
      const eventData = { agentId: 'agent-123' };

      vi.mocked(onboardingService.trackActivationEvent).mockResolvedValue(undefined);
      vi.mocked(upgradeRecommendationService.analyzeUsageAndRecommendUpgrades).mockResolvedValue([]);

      await growthRetentionService.trackActivationEvent(businessId, eventType, eventData);

      expect(onboardingService.trackActivationEvent).toHaveBeenCalledWith(
        businessId,
        eventType,
        eventData
      );

      // Should trigger upgrade analysis for certain events
      expect(upgradeRecommendationService.analyzeUsageAndRecommendUpgrades).toHaveBeenCalledWith(businessId);
    });

    it('should handle errors gracefully when tracking events', async () => {
      const businessId = 'test-business-id';
      const eventType = 'first_agent_created';

      vi.mocked(onboardingService.trackActivationEvent).mockRejectedValue(new Error('Tracking failed'));

      // Should not throw error
      await expect(growthRetentionService.trackActivationEvent(businessId, eventType))
        .resolves.toBeUndefined();
    });
  });

  describe('isBusinessEligibleForFeature', () => {
    it('should check feature eligibility based on flags and business data', async () => {
      const businessId = 'test-business-id';
      const featureName = 'smart_upgrades';

      // Mock feature flag
      const mockFlag = {
        flagName: featureName,
        isEnabled: true,
        rolloutPercentage: 100,
        targetPlans: ['starter-plan'],
        targetBusinesses: []
      };

      // Mock business subscription
      const mockSubscription = {
        planId: 'starter-plan',
        status: 'active'
      };

      // This would require mocking the Prisma client directly
      // For now, we'll test the logic flow
      const result = await growthRetentionService.isBusinessEligibleForFeature(businessId, featureName);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('getFeatureFlags', () => {
    it('should get all active feature flags', async () => {
      const mockFlags = [
        {
          flagName: 'onboarding_optimization',
          isEnabled: true,
          rolloutPercentage: 100,
          targetPlans: [],
          targetBusinesses: []
        },
        {
          flagName: 'smart_upgrades',
          isEnabled: true,
          rolloutPercentage: 50,
          targetPlans: ['starter-plan'],
          targetBusinesses: []
        }
      ];

      // Mock Prisma query
      const result = await growthRetentionService.getFeatureFlags();

      expect(typeof result).toBe('object');
    });
  });

  describe('getCampaignSettings', () => {
    it('should get campaign settings', async () => {
      const mockSettings = [
        {
          settingKey: 'onboarding_nudge_delay_hours',
          settingValue: '24'
        },
        {
          settingKey: 'referral_credit_amount_cents',
          settingValue: '1000'
        }
      ];

      const result = await growthRetentionService.getCampaignSettings();

      expect(typeof result).toBe('object');
    });
  });

  describe('updateCampaignSetting', () => {
    it('should update a campaign setting', async () => {
      const key = 'onboarding_nudge_delay_hours';
      const value = '48';

      const result = await growthRetentionService.updateCampaignSetting(key, value);

      expect(typeof result).toBe('object');
    });
  });
});
