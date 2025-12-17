/**
 * Phase 4B: Plan Management & Usage Enforcement Tests
 * Comprehensive test suite for plan management and usage tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlanManagementService } from '../lib/plan-management-service';
import { UsageEnforcementService } from '../lib/usage-enforcement-service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    plan_definitions: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    plan_features: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    usage_quotas: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    usage_events: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn()
    },
    usage_alerts: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    emergency_usage_pools: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    feature_flags: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    },
    business_feature_overrides: {
      findFirst: vi.fn()
    },
    emergency_usage_pools: {
      findFirst: vi.fn(),
      create: vi.fn()
    },
    plan_changes: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    payment_history: {
      count: vi.fn()
    }
  }))
}));

// Mock Stripe and Billing services
vi.mock('../lib/stripe-service', () => ({
  StripeService: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../lib/billing-service', () => ({
  BillingService: vi.fn().mockImplementation(() => ({}))
}));

describe('Phase 4B: Plan Management & Usage Enforcement', () => {
  let planManagement: PlanManagementService;
  let usageEnforcement: UsageEnforcementService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    planManagement = new PlanManagementService(mockPrisma);
    usageEnforcement = new UsageEnforcementService(mockPrisma);
    
    // Mock subscription data
    mockPrisma.subscription.findFirst.mockResolvedValue({
      id: 'sub_123',
      businessId: 'business_123',
      planId: 'starter',
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Mock plan definitions
    mockPrisma.plan_definitions.findMany.mockResolvedValue([
      {
        id: 'free',
        name: 'Free Plan',
        description: 'Free plan for testing',
        price_cents: 0,
        currency: 'usd',
        billing_interval: 'month',
        trial_days: 0,
        stripe_price_id: null,
        is_active: true,
        display_order: 0,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'starter',
        name: 'Starter Plan',
        description: 'Starter plan for small businesses',
        price_cents: 2900,
        currency: 'usd',
        billing_interval: 'month',
        trial_days: 7,
        stripe_price_id: 'price_starter',
        is_active: true,
        display_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Mock usage quotas
    mockPrisma.usage_quotas.findMany.mockResolvedValue([
      {
        id: 'quota_1',
        business_id: 'business_123',
        plan_id: 'starter',
        quota_type: 'queries',
        quota_limit: 2000,
        quota_used: 100,
        quota_overage: 0,
        reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        last_reset_date: new Date(),
        overage_rate_cents: 500,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Mock usage alerts
    mockPrisma.usage_alerts.findMany.mockResolvedValue([]);

    // Mock emergency usage pools
    mockPrisma.emergency_usage_pools.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Plan Management Service', () => {
    describe('getAvailablePlans', () => {
      it('should return all active plans with features', async () => {
        const mockPlans = [
          {
            id: 'free',
            name: 'Free Plan',
            description: 'Perfect for small businesses',
            price_cents: 0,
            currency: 'usd',
            billing_interval: 'month',
            trial_days: 14,
            stripe_price_id: null,
            is_active: true,
            display_order: 1,
            plan_features: [
              {
                feature_key: 'queries_per_month',
                feature_type: 'limit',
                limit_value: 100,
                boolean_value: null,
                enum_value: null,
                metadata: {}
              }
            ]
          }
        ];

        mockPrisma.plan_definitions.findMany.mockResolvedValue(mockPlans);

        const result = await planManagement.getAvailablePlans();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('free');
        expect(result[0].features).toHaveLength(1);
        expect(result[0].features[0].feature_key).toBe('queries_per_month');
      });
    });

    describe('getBusinessPlan', () => {
      it('should return current business plan with usage quotas and feature flags', async () => {
        const mockSubscription = {
          id: 'sub_123',
          businessId: 'business_123',
          planId: 'starter',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };

        const mockPlan = {
          id: 'starter',
          name: 'Starter Plan',
          description: 'Ideal for growing businesses',
          price_cents: 2900,
          currency: 'usd',
          billing_interval: 'month',
          trial_days: 14,
          stripe_price_id: 'price_123',
          is_active: true,
          display_order: 2,
          plan_features: [
            {
              feature_key: 'queries_per_month',
              feature_type: 'limit',
              limit_value: 2000,
              boolean_value: null,
              enum_value: null,
              metadata: {}
            }
          ]
        };

        const mockQuotas = [
          {
            business_id: 'business_123',
            plan_id: 'starter',
            quota_type: 'queries',
            quota_limit: 2000,
            quota_used: 500,
            quota_overage: 0,
            reset_date: new Date(),
            overage_rate_cents: 500
          }
        ];

        const mockFeatureFlags = [
          {
            feature_key: 'advanced_analytics',
            is_enabled: true
          }
        ];

        mockPrisma.subscriptions.findFirst.mockResolvedValue(mockSubscription);
        mockPrisma.plan_definitions.findUnique.mockResolvedValue(mockPlan);
        mockPrisma.usage_quotas.findMany.mockResolvedValue(mockQuotas);
        mockPrisma.feature_flags.findMany.mockResolvedValue(mockFeatureFlags);

        const result = await planManagement.getBusinessPlan('business_123');

        expect(result.current_plan.id).toBe('starter');
        expect(result.usage_quotas).toHaveLength(1);
        expect(result.feature_flags['advanced_analytics']).toBe(true);
      });
    });

    describe('checkUsageLimit', () => {
      it('should allow operation when within limits', async () => {
        const mockBusinessPlan = {
          current_plan: { id: 'starter', name: 'Starter Plan' },
          usage_quotas: [
            {
              business_id: 'business_123',
              plan_id: 'starter',
              quota_type: 'queries',
              quota_limit: 2000,
              quota_used: 500,
              quota_overage: 0,
              reset_date: new Date(),
              overage_rate_cents: 500
            }
          ],
          feature_flags: { 'advanced_analytics': true }
        };

        vi.spyOn(planManagement, 'getBusinessPlan').mockResolvedValue(mockBusinessPlan as any);

        const result = await planManagement.checkUsageLimit(
          'business_123',
          'query',
          100,
          'advanced_analytics'
        );

        expect(result.allowed).toBe(true);
        expect(result.current_usage.remaining).toBe(1500);
      });

      it('should deny operation when limits exceeded', async () => {
        const mockBusinessPlan = {
          current_plan: { id: 'starter', name: 'Starter Plan' },
          usage_quotas: [
            {
              business_id: 'business_123',
              plan_id: 'starter',
              quota_type: 'queries',
              quota_limit: 2000,
              quota_used: 2000,
              quota_overage: 0,
              reset_date: new Date(),
              overage_rate_cents: 500
            }
          ],
          feature_flags: { 'advanced_analytics': true }
        };

        vi.spyOn(planManagement, 'getBusinessPlan').mockResolvedValue(mockBusinessPlan as any);

        const result = await planManagement.checkUsageLimit(
          'business_123',
          'query',
          100,
          'advanced_analytics'
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Usage limit exceeded');
      });

      it('should deny operation when feature not available', async () => {
        const mockBusinessPlan = {
          current_plan: { id: 'free', name: 'Free Plan' },
          usage_quotas: [],
          feature_flags: { 'advanced_analytics': false }
        };

        vi.spyOn(planManagement, 'getBusinessPlan').mockResolvedValue(mockBusinessPlan as any);

        const result = await planManagement.checkUsageLimit(
          'business_123',
          'query',
          100,
          'advanced_analytics'
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not available on Free Plan');
      });
    });

    describe('recordUsageEvent', () => {
      it('should record usage event and update quotas', async () => {
        const mockEvent = {
          business_id: 'business_123',
          event_type: 'query' as const,
          quantity: 1,
          tokens_consumed: 100,
          cost_cents: 5,
          metadata: { session_id: 'session_123' }
        };

        mockPrisma.usage_events.create.mockResolvedValue({ id: 'event_123' });
        mockPrisma.usage_quotas.upsert.mockResolvedValue({ id: 'quota_123' });
        mockPrisma.usage_alerts.findMany.mockResolvedValue([]);

        await planManagement.recordUsageEvent(mockEvent);

        expect(mockPrisma.usage_events.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            business_id: 'business_123',
            event_type: 'query',
            quantity: 1
          })
        });
      });
    });

    describe('changePlan', () => {
      it('should process immediate plan upgrade', async () => {
        const mockRequest = {
          business_id: 'business_123',
          from_plan_id: 'starter',
          to_plan_id: 'pro',
          change_type: 'upgrade' as const,
          change_timing: 'immediate' as const,
          reason: 'Need more features'
        };

        const mockCurrentPlan = { id: 'starter', name: 'Starter Plan' };
        const mockTargetPlan = { id: 'pro', name: 'Pro Plan' };

        mockPrisma.plan_definitions.findUnique
          .mockResolvedValueOnce(mockCurrentPlan)
          .mockResolvedValueOnce(mockTargetPlan);

        mockPrisma.plan_changes.create.mockResolvedValue({
          id: 'change_123',
          effective_date: new Date()
        });

        // Mock the private methods by mocking the service dependencies
        vi.spyOn(planManagement, 'getBusinessPlan').mockResolvedValue({
          current_plan: { 
            id: 'starter', 
            name: 'Starter Plan',
            description: 'Starter plan for small businesses',
            price_cents: 2900,
            currency: 'usd',
            billing_interval: 'month',
            trial_days: 7,
            stripe_price_id: 'price_starter',
            is_active: true,
            display_order: 1,
            created_at: new Date(),
            updated_at: new Date()
          },
          usage_quotas: [],
          feature_flags: {}
        });

        const result = await planManagement.changePlan(mockRequest);

        expect(result.success).toBe(true);
        expect(result.new_limits.queries_per_month).toBe(10000);
        expect(result.new_features).toContain('advanced_analytics');
      });
    });
  });

  describe('Usage Enforcement Service', () => {
    describe('enforceUsageLimit', () => {
      it('should allow operation when within limits', async () => {
        const mockContext = {
          businessId: 'business_123',
          userId: 'user_123',
          sessionId: 'session_123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        };

        const mockUsageCheck = {
          allowed: true,
          current_usage: { used: 500, limit: 2000, remaining: 1500 }
        };

        vi.spyOn(planManagement, 'checkUsageLimit').mockResolvedValue(mockUsageCheck as any);

        const result = await usageEnforcement.enforceUsageLimit(
          mockContext,
          'query',
          100,
          'advanced_analytics'
        );

        expect(result.allowed).toBe(true);
      });

      it('should deny operation when limits exceeded', async () => {
        const mockContext = {
          businessId: 'business_123',
          userId: 'user_123',
          sessionId: 'session_123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        };

        const mockUsageCheck = {
          allowed: false,
          reason: 'Usage limit exceeded for queries',
          current_usage: { used: 2000, limit: 2000, remaining: 0 }
        };

        vi.spyOn(planManagement, 'checkUsageLimit').mockResolvedValue(mockUsageCheck as any);

        const result = await usageEnforcement.enforceUsageLimit(
          mockContext,
          'query',
          100
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Usage limit exceeded for queries');
      });
    });

    describe('checkFeatureAccess', () => {
      it('should allow access to enabled features', async () => {
        const mockContext = {
          businessId: 'business_123',
          userId: 'user_123'
        };

        const mockBusinessPlan = {
          current_plan: { id: 'pro', name: 'Pro Plan' },
          feature_flags: { 'advanced_analytics': true }
        };

        const mockFeatureFlag = {
          feature_key: 'advanced_analytics',
          is_enabled: true,
          access_level: 'full'
        };

        vi.spyOn(planManagement, 'getBusinessPlan').mockResolvedValue(mockBusinessPlan as any);
        mockPrisma.feature_flags.findFirst.mockResolvedValue(mockFeatureFlag);
        mockPrisma.business_feature_overrides.findFirst.mockResolvedValue(null);

        const result = await usageEnforcement.checkFeatureAccess(
          mockContext,
          'advanced_analytics'
        );

        expect(result.allowed).toBe(true);
        expect(result.access_level).toBe('full');
      });

      it('should deny access to disabled features', async () => {
        const mockContext = {
          businessId: 'business_123',
          userId: 'user_123'
        };

        const mockBusinessPlan = {
          current_plan: { id: 'free', name: 'Free Plan' },
          feature_flags: { 'advanced_analytics': false }
        };

        const mockFeatureFlag = {
          feature_key: 'advanced_analytics',
          is_enabled: false,
          access_level: 'restricted'
        };

        vi.spyOn(planManagement, 'getBusinessPlan').mockResolvedValue(mockBusinessPlan as any);
        mockPrisma.feature_flags.findFirst.mockResolvedValue(mockFeatureFlag);

        const result = await usageEnforcement.checkFeatureAccess(
          mockContext,
          'advanced_analytics'
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not available on Free Plan');
      });
    });

    describe('applyRateLimit', () => {
      it('should allow requests within rate limits', async () => {
        const mockContext = {
          businessId: 'business_123',
          userId: 'user_123'
        };

        const mockBusinessPlan = {
          current_plan: { id: 'pro', name: 'Pro Plan' }
        };

        vi.spyOn(planManagement, 'getBusinessPlan').mockResolvedValue(mockBusinessPlan as any);
        mockPrisma.usage_events.count
          .mockResolvedValueOnce(10) // minute usage
          .mockResolvedValueOnce(100); // hour usage

        mockPrisma.usage_events.create.mockResolvedValue({ id: 'event_123' });

        const result = await usageEnforcement.applyRateLimit(
          mockContext,
          'query'
        );

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThan(0);
      });

      it('should deny requests exceeding rate limits', async () => {
        const mockContext = {
          businessId: 'business_123',
          userId: 'user_123'
        };

        const mockBusinessPlan = {
          current_plan: { id: 'free', name: 'Free Plan' }
        };

        vi.spyOn(planManagement, 'getBusinessPlan').mockResolvedValue(mockBusinessPlan as any);
        mockPrisma.usage_events.count
          .mockResolvedValueOnce(15) // minute usage (exceeds free plan limit of 10)
          .mockResolvedValueOnce(50); // hour usage

        const result = await usageEnforcement.applyRateLimit(
          mockContext,
          'query'
        );

        expect(result.allowed).toBe(false);
        expect(result.retry_after).toBe(60);
      });
    });

    describe('recordUsageWithEnforcement', () => {
      it('should record usage event and update counters', async () => {
        const mockContext = {
          businessId: 'business_123',
          userId: 'user_123'
        };

        mockPrisma.usage_events.create.mockResolvedValue({ id: 'event_123' });
        mockPrisma.usage_quotas.upsert.mockResolvedValue({ id: 'quota_123' });
        mockPrisma.usage_alerts.findMany.mockResolvedValue([]);

        await usageEnforcement.recordUsageWithEnforcement(
          mockContext,
          'query',
          1,
          100,
          5,
          { session_id: 'session_123' }
        );

        expect(mockPrisma.usage_events.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            business_id: 'business_123',
            event_type: 'query',
            quantity: 1,
            tokens_consumed: 100,
            cost_cents: 5
          })
        });
      });
    });

    describe('getCurrentUsageStatus', () => {
      it('should return current usage status with quotas and alerts', async () => {
        const mockQuotas = [
          {
            quota_type: 'queries',
            quota_used: 500,
            quota_limit: 2000,
            quota_overage: 0
          }
        ];

        const mockAlerts = [
          {
            alert_type: 'approaching_limit',
            quota_type: 'queries',
            threshold_percentage: 75
          }
        ];

        const mockEmergencyPools = [
          {
            pool_type: 'queries',
            total_allocated: 100,
            used_amount: 0,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        ];

        mockPrisma.usage_quotas.findMany.mockResolvedValue(mockQuotas);
        mockPrisma.usage_alerts.findMany.mockResolvedValue(mockAlerts);
        mockPrisma.emergency_usage_pools.findMany.mockResolvedValue(mockEmergencyPools);

        const result = await usageEnforcement.getCurrentUsageStatus('business_123');

        expect(result.quotas).toHaveLength(1);
        expect(result.quotas[0].type).toBe('queries');
        expect(result.quotas[0].percentage).toBe(25);
        expect(result.alerts).toHaveLength(1);
        expect(result.emergency_pools).toHaveLength(1);
      });
    });

    describe('accessEmergencyPool', () => {
      it('should approve emergency pool access for eligible businesses', async () => {
        mockPrisma.subscriptions.findFirst.mockResolvedValue({
          businessId: 'business_123',
          status: 'ACTIVE'
        });
        mockPrisma.payment_history.count.mockResolvedValue(5);

        const mockEmergencyPool = {
          business_id: 'business_123',
          pool_type: 'queries',
          total_allocated: 100,
          used_amount: 0,
          cost_per_unit: 1000,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockPrisma.emergency_usage_pools.create.mockResolvedValue(mockEmergencyPool);

        const result = await usageEnforcement.accessEmergencyPool(
          'business_123',
          'queries',
          50,
          'Critical business operation'
        );

        expect(result.approved).toBe(true);
        expect(result.granted_amount).toBe(50);
        expect(result.cost_per_unit).toBe(1000);
      });

      it('should deny emergency pool access for ineligible businesses', async () => {
        mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

        const result = await usageEnforcement.accessEmergencyPool(
          'business_123',
          'queries',
          50,
          'Critical business operation'
        );

        expect(result.approved).toBe(false);
        expect(result.granted_amount).toBe(0);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete usage enforcement flow', async () => {
      const mockContext = {
        businessId: 'business_123',
        userId: 'user_123',
        sessionId: 'session_123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      // Mock successful usage check
      const mockUsageCheck = {
        allowed: true,
        current_usage: { used: 500, limit: 2000, remaining: 1500 }
      };

      vi.spyOn(planManagement, 'checkUsageLimit').mockResolvedValue(mockUsageCheck as any);

      // Mock successful rate limit check
      const mockRateLimit = {
        allowed: true,
        remaining: 50,
        reset_time: Date.now() + 60000
      };

      vi.spyOn(usageEnforcement, 'applyRateLimit').mockResolvedValue(mockRateLimit as any);

      // Mock successful usage recording
      mockPrisma.usage_events.create.mockResolvedValue({ id: 'event_123' });
      mockPrisma.usage_quotas.upsert.mockResolvedValue({ id: 'quota_123' });
      mockPrisma.usage_alerts.findMany.mockResolvedValue([]);

      // Test complete flow
      const usageCheck = await usageEnforcement.enforceUsageLimit(
        mockContext,
        'query',
        100
      );

      expect(usageCheck.allowed).toBe(true);

      const rateLimit = await usageEnforcement.applyRateLimit(
        mockContext,
        'query'
      );

      expect(rateLimit.allowed).toBe(true);

      await usageEnforcement.recordUsageWithEnforcement(
        mockContext,
        'query',
        1,
        100,
        5
      );

      expect(mockPrisma.usage_events.create).toHaveBeenCalled();
    });
  });
});
