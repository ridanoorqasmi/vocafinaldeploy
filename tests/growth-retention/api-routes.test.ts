import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the services
vi.mock('@/lib/services/onboarding-service');
vi.mock('@/lib/services/upgrade-recommendation-service');
vi.mock('@/lib/services/referral-service');
vi.mock('@/lib/services/annual-discount-service');
vi.mock('@/lib/services/winback-service');
vi.mock('@/lib/services/growth-retention-service');

describe('Growth Retention API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Onboarding API Routes', () => {
    it('should handle GET /api/v1/growth-retention/onboarding', async () => {
      const { GET } = await import('@/app/api/v1/growth-retention/onboarding/route');
      
      const mockProgress = {
        currentStep: 'welcome',
        completionPercentage: 20,
        isCompleted: false
      };

      vi.mocked(require('@/lib/services/onboarding-service').onboardingService.getOnboardingProgress)
        .mockResolvedValue(mockProgress);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/onboarding?businessId=test-business-id');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.progress).toEqual(mockProgress);
    });

    it('should handle POST /api/v1/growth-retention/onboarding', async () => {
      const { POST } = await import('@/app/api/v1/growth-retention/onboarding/route');
      
      const mockResult = {
        id: 'progress-id',
        businessId: 'test-business-id',
        currentStep: 'welcome'
      };

      vi.mocked(require('@/lib/services/onboarding-service').onboardingService.initializeOnboarding)
        .mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/onboarding', {
        method: 'POST',
        body: JSON.stringify({ businessId: 'test-business-id' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.result).toEqual(mockResult);
    });

    it('should handle PUT /api/v1/growth-retention/onboarding', async () => {
      const { PUT } = await import('@/app/api/v1/growth-retention/onboarding/route');
      
      const mockResult = {
        id: 'progress-id',
        businessId: 'test-business-id',
        currentStep: 'first_agent',
        completionPercentage: 40
      };

      vi.mocked(require('@/lib/services/onboarding-service').onboardingService.updateOnboardingProgress)
        .mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/onboarding', {
        method: 'PUT',
        body: JSON.stringify({
          businessId: 'test-business-id',
          stepKey: 'first_agent',
          activationEvents: { agentCreated: true }
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.result).toEqual(mockResult);
    });

    it('should handle missing business ID', async () => {
      const { GET } = await import('@/app/api/v1/growth-retention/onboarding/route');
      
      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/onboarding');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Business ID is required');
    });

    it('should handle service errors', async () => {
      const { GET } = await import('@/app/api/v1/growth-retention/onboarding/route');
      
      vi.mocked(require('@/lib/services/onboarding-service').onboardingService.getOnboardingProgress)
        .mockRejectedValue(new Error('Service error'));

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/onboarding?businessId=test-business-id');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get onboarding progress');
    });
  });

  describe('Upgrade Recommendations API Routes', () => {
    it('should handle GET /api/v1/growth-retention/upgrades', async () => {
      const { GET } = await import('@/app/api/v1/growth-retention/upgrades/route');
      
      const mockRecommendations = [
        {
          id: 'rec-1',
          businessId: 'test-business-id',
          urgencyLevel: 'high',
          confidenceScore: 0.85
        }
      ];

      vi.mocked(require('@/lib/services/upgrade-recommendation-service').upgradeRecommendationService.getRecommendations)
        .mockResolvedValue(mockRecommendations);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/upgrades?businessId=test-business-id');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendations).toEqual(mockRecommendations);
    });

    it('should handle POST /api/v1/growth-retention/upgrades/analyze', async () => {
      const { POST_ANALYZE } = await import('@/app/api/v1/growth-retention/upgrades/route');
      
      const mockRecommendations = [
        {
          id: 'rec-1',
          businessId: 'test-business-id',
          urgencyLevel: 'high'
        }
      ];

      vi.mocked(require('@/lib/services/upgrade-recommendation-service').upgradeRecommendationService.analyzeUsageAndRecommendUpgrades)
        .mockResolvedValue(mockRecommendations);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/upgrades/analyze', {
        method: 'POST',
        body: JSON.stringify({ businessId: 'test-business-id' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST_ANALYZE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendations).toEqual(mockRecommendations);
    });

    it('should handle PUT /api/v1/growth-retention/upgrades/[id]/dismiss', async () => {
      const { PUT_DISMISS } = await import('@/app/api/v1/growth-retention/upgrades/route');
      
      const mockRecommendation = {
        id: 'rec-1',
        dismissedAt: new Date()
      };

      vi.mocked(require('@/lib/services/upgrade-recommendation-service').upgradeRecommendationService.dismissRecommendation)
        .mockResolvedValue(mockRecommendation);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/upgrades/rec-1/dismiss', {
        method: 'PUT'
      });

      const response = await PUT_DISMISS(request, { params: { recommendationId: 'rec-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendation).toEqual(mockRecommendation);
    });
  });

  describe('Referral API Routes', () => {
    it('should handle GET /api/v1/growth-retention/referrals', async () => {
      const { GET } = await import('@/app/api/v1/growth-retention/referrals/route');
      
      const mockStats = {
        stats: {
          totalReferrals: 5,
          successfulReferrals: 2,
          totalCreditsEarnedCents: 2000
        },
        recentReferrals: []
      };

      vi.mocked(require('@/lib/services/referral-service').referralService.getReferralStats)
        .mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/referrals?businessId=test-business-id');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual(mockStats);
    });

    it('should handle POST /api/v1/growth-retention/referrals/track', async () => {
      const { POST_TRACK } = await import('@/app/api/v1/growth-retention/referrals/route');
      
      const mockReferral = {
        id: 'ref-1',
        referrerBusinessId: 'referrer-id',
        referredBusinessId: 'referred-id',
        status: 'pending'
      };

      vi.mocked(require('@/lib/services/referral-service').referralService.trackReferral)
        .mockResolvedValue(mockReferral);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/referrals/track', {
        method: 'POST',
        body: JSON.stringify({
          referralCode: 'test123',
          referredBusinessId: 'referred-id'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST_TRACK(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.referral).toEqual(mockReferral);
    });

    it('should handle GET /api/v1/growth-retention/referrals/validate', async () => {
      const { GET_VALIDATE } = await import('@/app/api/v1/growth-retention/referrals/route');
      
      vi.mocked(require('@/lib/services/referral-service').referralService.validateReferralCode)
        .mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/referrals/validate?referralCode=test123');
      const response = await GET_VALIDATE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isValid).toBe(true);
    });
  });

  describe('Annual Discounts API Routes', () => {
    it('should handle GET /api/v1/growth-retention/annual-discounts', async () => {
      const { GET } = await import('@/app/api/v1/growth-retention/annual-discounts/route');
      
      const mockCampaigns = [
        {
          id: 'campaign-1',
          campaignName: 'Holiday Discount',
          discountPercentage: 15,
          isActive: true
        }
      ];

      vi.mocked(require('@/lib/services/annual-discount-service').annualDiscountService.getActiveCampaigns)
        .mockResolvedValue(mockCampaigns);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/annual-discounts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.campaigns).toEqual(mockCampaigns);
    });

    it('should handle POST /api/v1/growth-retention/annual-discounts/check-eligibility', async () => {
      const { POST_CHECK_ELIGIBILITY } = await import('@/app/api/v1/growth-retention/annual-discounts/route');
      
      vi.mocked(require('@/lib/services/annual-discount-service').annualDiscountService.checkEligibility)
        .mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/annual-discounts/check-eligibility', {
        method: 'POST',
        body: JSON.stringify({
          businessId: 'test-business-id',
          campaignId: 'campaign-1'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST_CHECK_ELIGIBILITY(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isEligible).toBe(true);
    });

    it('should handle POST /api/v1/growth-retention/annual-discounts/calculate-savings', async () => {
      const { POST_CALCULATE_SAVINGS } = await import('@/app/api/v1/growth-retention/annual-discounts/route');
      
      const mockSavings = {
        originalAnnualPrice: 12000,
        discountAmount: 1800,
        discountedPrice: 10200,
        savings: 1800,
        discountPercentage: 15
      };

      vi.mocked(require('@/lib/services/annual-discount-service').annualDiscountService.calculateSavings)
        .mockResolvedValue(mockSavings);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/annual-discounts/calculate-savings', {
        method: 'POST',
        body: JSON.stringify({
          businessId: 'test-business-id',
          campaignId: 'campaign-1'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST_CALCULATE_SAVINGS(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.savings).toEqual(mockSavings);
    });
  });

  describe('Win-back API Routes', () => {
    it('should handle GET /api/v1/growth-retention/winback', async () => {
      const { GET } = await import('@/app/api/v1/growth-retention/winback/route');
      
      const mockInteractions = [
        {
          id: 'interaction-1',
          businessId: 'test-business-id',
          interactionType: 'email_sent'
        }
      ];

      vi.mocked(require('@/lib/services/winback-service').winbackService.getBusinessWinbackInteractions)
        .mockResolvedValue(mockInteractions);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/winback?businessId=test-business-id');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.interactions).toEqual(mockInteractions);
    });

    it('should handle POST /api/v1/growth-retention/winback/detect-churn', async () => {
      const { POST_DETECT_CHURN } = await import('@/app/api/v1/growth-retention/winback/route');
      
      const mockChurnEvent = {
        id: 'churn-1',
        businessId: 'test-business-id',
        churnDate: new Date(),
        churnReason: 'cancelled'
      };

      vi.mocked(require('@/lib/services/winback-service').winbackService.detectChurn)
        .mockResolvedValue(mockChurnEvent);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/winback/detect-churn', {
        method: 'POST',
        body: JSON.stringify({
          businessId: 'test-business-id',
          churnReason: 'cancelled'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST_DETECT_CHURN(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.churnEvent).toEqual(mockChurnEvent);
    });
  });

  describe('Dashboard API Routes', () => {
    it('should handle GET /api/v1/growth-retention/dashboard', async () => {
      const { GET } = await import('@/app/api/v1/growth-retention/dashboard/route');
      
      const mockDashboardData = {
        onboarding: { completionPercentage: 50 },
        upgrades: [],
        referrals: { stats: {}, recentReferrals: [] },
        annualDiscounts: [],
        winback: []
      };

      vi.mocked(require('@/lib/services/growth-retention-service').growthRetentionService.getDashboardData)
        .mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/dashboard?businessId=test-business-id');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dashboardData).toEqual(mockDashboardData);
    });

    it('should handle POST /api/v1/growth-retention/dashboard/initialize', async () => {
      const { POST_INITIALIZE } = await import('@/app/api/v1/growth-retention/dashboard/route');
      
      const mockResult = {
        onboardingInitialized: true,
        referralLink: 'https://app.voca.ai/signup?ref=test123'
      };

      vi.mocked(require('@/lib/services/growth-retention-service').growthRetentionService.initializeBusiness)
        .mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/dashboard/initialize', {
        method: 'POST',
        body: JSON.stringify({ businessId: 'test-business-id' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST_INITIALIZE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.result).toEqual(mockResult);
    });

    it('should handle POST /api/v1/growth-retention/dashboard/track-event', async () => {
      const { POST_TRACK_EVENT } = await import('@/app/api/v1/growth-retention/dashboard/route');
      
      vi.mocked(require('@/lib/services/growth-retention-service').growthRetentionService.trackActivationEvent)
        .mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/v1/growth-retention/dashboard/track-event', {
        method: 'POST',
        body: JSON.stringify({
          businessId: 'test-business-id',
          eventType: 'first_agent_created',
          eventData: { agentId: 'agent-123' }
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST_TRACK_EVENT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
