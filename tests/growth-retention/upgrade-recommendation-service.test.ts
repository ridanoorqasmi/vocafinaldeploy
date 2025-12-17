import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { upgradeRecommendationService } from '@/lib/services/upgrade-recommendation-service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    business: {
      findUnique: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
    },
    planDefinition: {
      findUnique: vi.fn(),
    },
    usageAnalysis: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    upgradeRule: {
      findMany: vi.fn(),
    },
    upgradeRecommendation: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    queryLog: {
      count: vi.fn(),
    },
    businessUser: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  })),
}));

describe('UpgradeRecommendationService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeUsageAndRecommendUpgrades', () => {
    it('should analyze usage and generate upgrade recommendations', async () => {
      const businessId = 'test-business-id';
      
      const mockBusiness = {
        id: businessId,
        subscriptions: [{
          status: 'active',
          planDefinition: {
            id: 'starter-plan',
            priceCents: 2000,
            apiCallsLimit: 1000
          }
        }]
      };

      const mockUsageAnalysis = {
        businessId,
        apiCallsCount: 900,
        activeSeats: 2,
        storageUsedMb: 500,
        billingLimitUtilization: 0.9,
        usageTrend: 'increasing',
        growthRate: 0.2
      };

      const mockRules = [
        {
          id: 'rule-1',
          ruleName: 'High Usage Rule',
          currentPlanFilter: { plans: ['starter-plan'] },
          triggerConditions: {
            apiCalls: { min: 800 },
            utilization: { min: 0.8 }
          },
          recommendedPlanId: 'pro-plan',
          recommendationMessage: 'You are using 90% of your API calls. Upgrade to Pro for unlimited usage.',
          priorityScore: 90
        }
      ];

      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
      mockPrisma.usageAnalysis.findFirst.mockResolvedValue(mockUsageAnalysis);
      mockPrisma.upgradeRule.findMany.mockResolvedValue(mockRules);
      mockPrisma.planDefinition.findUnique.mockResolvedValue({ id: 'pro-plan', priceCents: 5000 });
      mockPrisma.upgradeRecommendation.create.mockResolvedValue({
        id: 'recommendation-1',
        businessId,
        ruleId: 'rule-1',
        currentPlanId: 'starter-plan',
        recommendedPlanId: 'pro-plan',
        recommendationReason: 'You are using 90% of your API calls. Upgrade to Pro for unlimited usage.',
        confidenceScore: 0.85,
        potentialRevenueIncreaseCents: 36000,
        urgencyLevel: 'high'
      });

      const result = await upgradeRecommendationService.analyzeUsageAndRecommendUpgrades(businessId);

      expect(mockPrisma.business.findUnique).toHaveBeenCalledWith({
        where: { id: businessId },
        include: {
          subscriptions: {
            where: { status: 'active' },
            include: { planDefinition: true }
          }
        }
      });

      expect(mockPrisma.upgradeRule.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          currentPlanFilter: {
            path: ['plans'],
            array_contains: ['starter-plan']
          }
        },
        orderBy: { priorityScore: 'desc' }
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        businessId,
        ruleId: 'rule-1',
        currentPlanId: 'starter-plan',
        recommendedPlanId: 'pro-plan'
      });
    });

    it('should return empty array for business without active subscription', async () => {
      const businessId = 'test-business-id';
      
      mockPrisma.business.findUnique.mockResolvedValue({
        id: businessId,
        subscriptions: []
      });

      const result = await upgradeRecommendationService.analyzeUsageAndRecommendUpgrades(businessId);

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      const businessId = 'test-business-id';
      
      mockPrisma.business.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(upgradeRecommendationService.analyzeUsageAndRecommendUpgrades(businessId))
        .rejects.toThrow('Failed to analyze usage and recommend upgrades');
    });
  });

  describe('getUsageAnalysis', () => {
    it('should get existing usage analysis', async () => {
      const businessId = 'test-business-id';
      const mockUsageAnalysis = {
        businessId,
        analysisDate: new Date(),
        apiCallsCount: 500,
        activeSeats: 1,
        storageUsedMb: 200,
        billingLimitUtilization: 0.5,
        usageTrend: 'stable',
        growthRate: 0.0
      };

      mockPrisma.usageAnalysis.findFirst.mockResolvedValue(mockUsageAnalysis);

      const result = await upgradeRecommendationService.getUsageAnalysis(businessId);

      expect(mockPrisma.usageAnalysis.findFirst).toHaveBeenCalledWith({
        where: {
          businessId,
          analysisDate: new Date()
        }
      });

      expect(result).toEqual(mockUsageAnalysis);
    });

    it('should calculate usage analysis if not exists', async () => {
      const businessId = 'test-business-id';
      
      mockPrisma.usageAnalysis.findFirst.mockResolvedValue(null);
      mockPrisma.queryLog.count.mockResolvedValue(500);
      mockPrisma.businessUser.count.mockResolvedValue(2);
      mockPrisma.subscription.findFirst.mockResolvedValue({
        planDefinition: { apiCallsLimit: 1000 }
      });
      mockPrisma.usageAnalysis.upsert.mockResolvedValue({
        businessId,
        analysisDate: new Date(),
        apiCallsCount: 500,
        activeSeats: 2,
        storageUsedMb: 0,
        billingLimitUtilization: 0.5,
        usageTrend: 'stable',
        growthRate: 0.0
      });

      const result = await upgradeRecommendationService.getUsageAnalysis(businessId);

      expect(mockPrisma.usageAnalysis.upsert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getRecommendations', () => {
    it('should get upgrade recommendations for a business', async () => {
      const businessId = 'test-business-id';
      const mockRecommendations = [
        {
          id: 'rec-1',
          businessId,
          currentPlanId: 'starter-plan',
          recommendedPlanId: 'pro-plan',
          recommendationReason: 'High usage detected',
          confidenceScore: 0.85,
          urgencyLevel: 'high',
          rule: {
            ruleName: 'High Usage Rule',
            ruleDescription: 'Detects high usage patterns'
          }
        }
      ];

      mockPrisma.upgradeRecommendation.findMany.mockResolvedValue(mockRecommendations);

      const result = await upgradeRecommendationService.getRecommendations(businessId);

      expect(mockPrisma.upgradeRecommendation.findMany).toHaveBeenCalledWith({
        where: {
          businessId,
          dismissedAt: null,
          acceptedAt: null
        },
        include: { rule: true },
        orderBy: [
          { urgencyLevel: 'desc' },
          { confidenceScore: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      expect(result).toEqual(mockRecommendations);
    });
  });

  describe('markRecommendationAsShown', () => {
    it('should mark a recommendation as shown', async () => {
      const recommendationId = 'rec-1';
      const mockRecommendation = {
        id: recommendationId,
        shownAt: new Date()
      };

      mockPrisma.upgradeRecommendation.update.mockResolvedValue(mockRecommendation);

      const result = await upgradeRecommendationService.markRecommendationAsShown(recommendationId);

      expect(mockPrisma.upgradeRecommendation.update).toHaveBeenCalledWith({
        where: { id: recommendationId },
        data: { shownAt: expect.any(Date) }
      });

      expect(result).toEqual(mockRecommendation);
    });
  });

  describe('dismissRecommendation', () => {
    it('should dismiss a recommendation', async () => {
      const recommendationId = 'rec-1';
      const mockRecommendation = {
        id: recommendationId,
        dismissedAt: new Date()
      };

      mockPrisma.upgradeRecommendation.update.mockResolvedValue(mockRecommendation);

      const result = await upgradeRecommendationService.dismissRecommendation(recommendationId);

      expect(mockPrisma.upgradeRecommendation.update).toHaveBeenCalledWith({
        where: { id: recommendationId },
        data: { dismissedAt: expect.any(Date) }
      });

      expect(result).toEqual(mockRecommendation);
    });
  });

  describe('acceptRecommendation', () => {
    it('should accept a recommendation', async () => {
      const recommendationId = 'rec-1';
      const mockRecommendation = {
        id: recommendationId,
        acceptedAt: new Date()
      };

      mockPrisma.upgradeRecommendation.update.mockResolvedValue(mockRecommendation);

      const result = await upgradeRecommendationService.acceptRecommendation(recommendationId);

      expect(mockPrisma.upgradeRecommendation.update).toHaveBeenCalledWith({
        where: { id: recommendationId },
        data: { acceptedAt: expect.any(Date) }
      });

      expect(result).toEqual(mockRecommendation);
    });
  });

  describe('getUpgradeAnalytics', () => {
    it('should get upgrade recommendation analytics', async () => {
      const mockAnalytics = {
        total_recommendations: 50,
        accepted_recommendations: 15,
        dismissed_recommendations: 20,
        acceptance_rate: 30.0,
        total_potential_revenue_cents: 150000
      };

      mockPrisma.$queryRaw.mockResolvedValue([mockAnalytics]);

      const result = await upgradeRecommendationService.getUpgradeAnalytics();

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('evaluateRuleConditions', () => {
    it('should evaluate rule conditions correctly', async () => {
      const rule = {
        triggerConditions: {
          apiCalls: { min: 800 },
          utilization: { min: 0.8 }
        }
      };

      const usageAnalysis = {
        apiCallsCount: 900,
        billingLimitUtilization: 0.9
      };

      const currentPlan = { id: 'starter-plan' };

      // This is a private method, so we test it indirectly through analyzeUsageAndRecommendUpgrades
      const businessId = 'test-business-id';
      
      mockPrisma.business.findUnique.mockResolvedValue({
        id: businessId,
        subscriptions: [{ status: 'active', planDefinition: currentPlan }]
      });

      mockPrisma.usageAnalysis.findFirst.mockResolvedValue(usageAnalysis);
      mockPrisma.upgradeRule.findMany.mockResolvedValue([rule]);
      mockPrisma.planDefinition.findUnique.mockResolvedValue({ id: 'pro-plan', priceCents: 5000 });
      mockPrisma.upgradeRecommendation.create.mockResolvedValue({});

      const result = await upgradeRecommendationService.analyzeUsageAndRecommendUpgrades(businessId);

      // Should create recommendation since conditions are met
      expect(mockPrisma.upgradeRecommendation.create).toHaveBeenCalled();
    });
  });
});
