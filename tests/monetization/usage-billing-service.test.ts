import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usageBillingService } from '@/lib/services/usage-billing-service';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    usageEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn()
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn()
  }))
}));

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscriptionItems: {
      createUsageRecord: vi.fn(),
      del: vi.fn()
    },
    subscriptions: {
      retrieve: vi.fn(),
      list: vi.fn()
    },
    prices: {
      list: vi.fn(),
      create: vi.fn()
    }
  }))
}));

describe('UsageBillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordUsageEvent', () => {
    it('should record a usage event successfully', async () => {
      const mockUsageEvent = {
        id: 'test-id',
        businessId: 'business-123',
        eventType: 'api_call',
        quantity: 100,
        unitPriceCents: 1,
        totalCostCents: 100,
        metadata: {}
      };

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        usageEvent: {
          create: vi.fn().mockResolvedValue(mockUsageEvent)
        }
      } as any));

      const result = await usageBillingService.recordUsageEvent({
        businessId: 'business-123',
        eventType: 'api_call',
        quantity: 100,
        unitPriceCents: 1,
        metadata: {}
      });

      expect(result).toEqual(mockUsageEvent);
    });

    it('should throw error when recording fails', async () => {
      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        usageEvent: {
          create: vi.fn().mockRejectedValue(new Error('Database error'))
        }
      } as any));

      await expect(usageBillingService.recordUsageEvent({
        businessId: 'business-123',
        eventType: 'api_call',
        quantity: 100,
        unitPriceCents: 1,
        metadata: {}
      })).rejects.toThrow('Failed to record usage event');
    });
  });

  describe('aggregateUsageForPeriod', () => {
    it('should aggregate usage for a period', async () => {
      const mockAggregations = [
        {
          event_type: 'api_call',
          total_quantity: 1000,
          total_cost_cents: 1000
        }
      ];

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        $queryRaw: vi.fn().mockResolvedValue(mockAggregations)
      } as any));

      const result = await usageBillingService.aggregateUsageForPeriod(
        'business-123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toEqual(mockAggregations);
    });
  });

  describe('getUsageVsQuota', () => {
    it('should get usage vs quota data', async () => {
      const mockUsageVsQuota = [
        {
          event_type: 'api_call',
          current_usage: 800,
          quota_limit: 1000,
          usage_percentage: 80
        }
      ];

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        $queryRaw: vi.fn().mockResolvedValue(mockUsageVsQuota)
      } as any));

      const result = await usageBillingService.getUsageVsQuota('business-123');

      expect(result).toEqual(mockUsageVsQuota);
    });
  });

  describe('getUsageAnalytics', () => {
    it('should get usage analytics', async () => {
      const mockAnalytics = [
        {
          event_type: 'api_call',
          event_count: 100,
          total_quantity: 1000,
          total_cost_cents: 1000,
          avg_quantity_per_event: 10,
          max_quantity_per_event: 50
        }
      ];

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        $queryRaw: vi.fn().mockResolvedValue(mockAnalytics)
      } as any));

      const result = await usageBillingService.getUsageAnalytics(
        'business-123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('processPendingUsageEvents', () => {
    it('should process pending usage events', async () => {
      const mockPendingEvents = [
        {
          id: 'event-1',
          businessId: 'business-123',
          eventType: 'api_call',
          quantity: 100,
          totalCostCents: 100
        }
      ];

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        usageEvent: {
          findMany: vi.fn().mockResolvedValue(mockPendingEvents)
        }
      } as any));

      // Mock the syncUsageToStripe method
      vi.spyOn(usageBillingService, 'syncUsageToStripe').mockResolvedValue({} as any);

      await usageBillingService.processPendingUsageEvents();

      expect(usageBillingService.syncUsageToStripe).toHaveBeenCalledWith('event-1');
    });
  });
});
