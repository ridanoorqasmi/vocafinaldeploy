import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addOnService } from '@/lib/services/addon-service';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    addOn: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    businessAddOn: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    upsellCampaign: {
      findMany: vi.fn(),
      create: vi.fn()
    },
    upsellInteraction: {
      create: vi.fn()
    },
    $queryRaw: vi.fn()
  }))
}));

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn()
      }
    },
    subscriptions: {
      retrieve: vi.fn()
    },
    prices: {
      list: vi.fn(),
      create: vi.fn()
    }
  }))
}));

describe('AddOnService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAddOn', () => {
    it('should create an add-on successfully', async () => {
      const mockAddOn = {
        id: 'addon-123',
        name: 'Extra API Calls',
        description: 'Additional API calls',
        priceCents: 2000,
        billingPeriod: 'monthly',
        isActive: true
      };

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        addOn: {
          create: vi.fn().mockResolvedValue(mockAddOn)
        }
      } as any));

      const result = await addOnService.createAddOn({
        name: 'Extra API Calls',
        description: 'Additional API calls',
        priceCents: 2000,
        billingPeriod: 'monthly',
        isActive: true
      });

      expect(result).toEqual(mockAddOn);
    });

    it('should throw error when creation fails', async () => {
      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        addOn: {
          create: vi.fn().mockRejectedValue(new Error('Database error'))
        }
      } as any));

      await expect(addOnService.createAddOn({
        name: 'Extra API Calls',
        description: 'Additional API calls',
        priceCents: 2000,
        billingPeriod: 'monthly',
        isActive: true
      })).rejects.toThrow('Failed to create add-on');
    });
  });

  describe('getActiveAddOns', () => {
    it('should get active add-ons', async () => {
      const mockAddOns = [
        {
          id: 'addon-1',
          name: 'Extra API Calls',
          isActive: true
        },
        {
          id: 'addon-2',
          name: 'Extra Voice Minutes',
          isActive: true
        }
      ];

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        addOn: {
          findMany: vi.fn().mockResolvedValue(mockAddOns)
        }
      } as any));

      const result = await addOnService.getActiveAddOns();

      expect(result).toEqual(mockAddOns);
    });
  });

  describe('getBusinessAddOns', () => {
    it('should get business add-ons', async () => {
      const mockBusinessAddOns = [
        {
          id: 'business-addon-1',
          businessId: 'business-123',
          addOnId: 'addon-1',
          addOn: {
            id: 'addon-1',
            name: 'Extra API Calls'
          },
          status: 'active'
        }
      ];

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        businessAddOn: {
          findMany: vi.fn().mockResolvedValue(mockBusinessAddOns)
        }
      } as any));

      const result = await addOnService.getBusinessAddOns('business-123');

      expect(result).toEqual(mockBusinessAddOns);
    });
  });

  describe('purchaseAddOn', () => {
    it('should create checkout session for add-on purchase', async () => {
      const mockAddOn = {
        id: 'addon-123',
        name: 'Extra API Calls',
        priceCents: 2000,
        isActive: true
      };

      const mockCheckoutSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123'
      };

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        addOn: {
          findUnique: vi.fn().mockResolvedValue(mockAddOn)
        },
        businessAddOn: {
          findUnique: vi.fn().mockResolvedValue(null)
        },
        subscription: {
          findFirst: vi.fn().mockResolvedValue({
            stripeSubscriptionId: 'sub_123'
          })
        }
      } as any));

      // Mock Stripe
      const mockStripe = await import('stripe');
      vi.mocked(mockStripe.default).mockImplementation(() => ({
        checkout: {
          sessions: {
            create: vi.fn().mockResolvedValue(mockCheckoutSession)
          }
        },
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue({
            customer: 'cus_123'
          })
        },
        prices: {
          list: vi.fn().mockResolvedValue({ data: [] }),
          create: vi.fn().mockResolvedValue({ id: 'price_123' })
        }
      } as any));

      const result = await addOnService.purchaseAddOn('business-123', 'addon-123', 1);

      expect(result).toEqual({
        checkoutUrl: mockCheckoutSession.url,
        sessionId: mockCheckoutSession.id
      });
    });

    it('should throw error when add-on not found', async () => {
      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        addOn: {
          findUnique: vi.fn().mockResolvedValue(null)
        }
      } as any));

      await expect(addOnService.purchaseAddOn('business-123', 'addon-123', 1))
        .rejects.toThrow('Add-on not found or inactive');
    });
  });

  describe('getUpsellCampaigns', () => {
    it('should get upsell campaigns for business', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'API Usage Warning',
          targetAddOn: {
            id: 'addon-1',
            name: 'Extra API Calls'
          },
          isActive: true
        }
      ];

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        $queryRaw: vi.fn().mockResolvedValue([
          {
            event_type: 'api_call',
            current_usage: 800,
            quota_limit: 1000,
            usage_percentage: 80
          }
        ]),
        upsellCampaign: {
          findMany: vi.fn().mockResolvedValue(mockCampaigns)
        }
      } as any));

      const result = await addOnService.getUpsellCampaigns('business-123');

      expect(result).toEqual(mockCampaigns);
    });
  });

  describe('recordUpsellInteraction', () => {
    it('should record upsell interaction', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        businessId: 'business-123',
        campaignId: 'campaign-123',
        interactionType: 'clicked'
      };

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        upsellInteraction: {
          create: vi.fn().mockResolvedValue(mockInteraction)
        }
      } as any));

      const result = await addOnService.recordUpsellInteraction(
        'business-123',
        'campaign-123',
        'clicked',
        {}
      );

      expect(result).toEqual(mockInteraction);
    });
  });

  describe('getAddOnAnalytics', () => {
    it('should get add-on analytics', async () => {
      const mockAnalytics = [
        {
          add_on_name: 'Extra API Calls',
          total_purchases: 10,
          active_purchases: 8,
          total_revenue_cents: 20000
        }
      ];

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        $queryRaw: vi.fn().mockResolvedValue(mockAnalytics)
      } as any));

      const result = await addOnService.getAddOnAnalytics();

      expect(result).toEqual(mockAnalytics);
    });
  });
});
