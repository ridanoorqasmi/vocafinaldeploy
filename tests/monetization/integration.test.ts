import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usageBillingService } from '@/lib/services/usage-billing-service';
import { addOnService } from '@/lib/services/addon-service';
import { customPlanService } from '@/lib/services/custom-plan-service';
import { invoiceService } from '@/lib/services/invoice-service';
import { billingInsightsService } from '@/lib/services/billing-insights-service';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    usageEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      aggregate: vi.fn()
    },
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
    customPlan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    invoice: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    billingSnapshot: {
      upsert: vi.fn()
    },
    $queryRaw: vi.fn()
  }))
}));

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscriptionItems: {
      createUsageRecord: vi.fn()
    },
    subscriptions: {
      retrieve: vi.fn()
    },
    prices: {
      list: vi.fn(),
      create: vi.fn()
    },
    checkout: {
      sessions: {
        create: vi.fn()
      }
    },
    invoices: {
      list: vi.fn(),
      retrieve: vi.fn()
    }
  }))
}));

describe('Monetization Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Billing Flow', () => {
    it('should handle complete usage to billing flow', async () => {
      const businessId = 'business-123';
      const mockUsageEvent = {
        id: 'usage-123',
        businessId,
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
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            event_type: 'api_call',
            current_usage: 100,
            quota_limit: 1000,
            usage_percentage: 10
          }
        ])
      } as any));

      // Mock Stripe
      const mockStripe = await import('stripe');
      vi.mocked(mockStripe.default).mockImplementation(() => ({
        subscriptionItems: {
          createUsageRecord: vi.fn().mockResolvedValue({ id: 'usage_record_123' })
        },
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue({
            items: {
              data: []
            }
          })
        },
        prices: {
          list: vi.fn().mockResolvedValue({ data: [] }),
          create: vi.fn().mockResolvedValue({ id: 'price_123' })
        }
      } as any));

      // 1. Record usage event
      const usageEvent = await usageBillingService.recordUsageEvent({
        businessId,
        eventType: 'api_call',
        quantity: 100,
        unitPriceCents: 1,
        metadata: {}
      });

      expect(usageEvent).toEqual(mockUsageEvent);

      // 2. Get usage vs quota
      const usageVsQuota = await usageBillingService.getUsageVsQuota(businessId);
      expect(usageVsQuota).toHaveLength(1);
      expect(usageVsQuota[0].event_type).toBe('api_call');

      // 3. Process pending usage events
      await usageBillingService.processPendingUsageEvents();
    });
  });

  describe('Add-on Purchase Flow', () => {
    it('should handle complete add-on purchase flow', async () => {
      const businessId = 'business-123';
      const addOnId = 'addon-123';
      const mockAddOn = {
        id: addOnId,
        name: 'Extra API Calls',
        priceCents: 2000,
        billingPeriod: 'monthly',
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
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'business-addon-123',
            businessId,
            addOnId,
            status: 'active'
          })
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

      // 1. Purchase add-on
      const purchaseResult = await addOnService.purchaseAddOn(businessId, addOnId, 1);
      expect(purchaseResult.checkoutUrl).toBe(mockCheckoutSession.url);

      // 2. Handle successful purchase
      const businessAddOn = await addOnService.handleAddOnPurchaseSuccess('cs_test_123');
      expect(businessAddOn.businessId).toBe(businessId);
    });
  });

  describe('Custom Plan Management', () => {
    it('should handle custom plan creation and usage tracking', async () => {
      const businessId = 'business-123';
      const mockCustomPlan = {
        id: 'custom-plan-123',
        businessId,
        planName: 'Enterprise Plan',
        basePriceCents: 50000,
        billingPeriod: 'monthly',
        limits: {
          api_call: 100000,
          voice_minute: 10000
        },
        status: 'active'
      };

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        customPlan: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(mockCustomPlan)
        },
        customPlanUsage: {
          createMany: vi.fn().mockResolvedValue({})
        }
      } as any));

      // Mock Stripe
      const mockStripe = await import('stripe');
      vi.mocked(mockStripe.default).mockImplementation(() => ({
        prices: {
          create: vi.fn().mockResolvedValue({ id: 'price_custom_123' })
        }
      } as any));

      // 1. Create custom plan
      const customPlan = await customPlanService.createCustomPlan({
        businessId,
        planName: 'Enterprise Plan',
        basePriceCents: 50000,
        billingPeriod: 'monthly',
        limits: {
          api_call: 100000,
          voice_minute: 10000
        },
        createdBy: 'user-123'
      });

      expect(customPlan.planName).toBe('Enterprise Plan');

      // 2. Check if business should use custom plan
      const shouldUse = await customPlanService.shouldUseCustomPlan(businessId);
      expect(shouldUse).toBe(true);
    });
  });

  describe('Invoice Generation', () => {
    it('should handle invoice generation from Stripe', async () => {
      const businessId = 'business-123';
      const mockInvoice = {
        id: 'invoice-123',
        businessId,
        stripeInvoiceId: 'in_123',
        invoiceNumber: 'INV-001',
        status: 'paid',
        amountCents: 5000,
        amountPaidCents: 5000
      };

      const mockStripeInvoice = {
        id: 'in_123',
        number: 'INV-001',
        status: 'paid',
        amount_due: 5000,
        amount_paid: 5000,
        lines: {
          data: [
            {
              id: 'line_123',
              description: 'Monthly subscription',
              amount: 5000,
              price: {
                id: 'price_123',
                unit_amount: 5000
              }
            }
          ]
        }
      };

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        subscription: {
          findFirst: vi.fn().mockResolvedValue({
            stripeSubscriptionId: 'sub_123'
          })
        },
        invoice: {
          create: vi.fn().mockResolvedValue(mockInvoice)
        },
        invoiceLineItem: {
          createMany: vi.fn().mockResolvedValue({})
        }
      } as any));

      // Mock Stripe
      const mockStripe = await import('stripe');
      vi.mocked(mockStripe.default).mockImplementation(() => ({
        invoices: {
          list: vi.fn().mockResolvedValue({
            data: [mockStripeInvoice]
          }),
          retrieve: vi.fn().mockResolvedValue({
            ...mockStripeInvoice,
            invoice_pdf: 'https://invoice.stripe.com/i/acct_123/in_123.pdf'
          })
        }
      } as any));

      // 1. Generate invoice from Stripe
      const invoice = await invoiceService.generateInvoiceFromStripe(
        businessId,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(invoice.businessId).toBe(businessId);

      // 2. Get invoice download URL
      const downloadUrl = await invoiceService.getInvoiceDownloadUrl(invoice.id);
      expect(downloadUrl).toContain('invoice.stripe.com');
    });
  });

  describe('Billing Insights', () => {
    it('should generate comprehensive billing insights', async () => {
      const businessId = 'business-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockInsights = {
        monthlySpend: {
          monthlyData: [
            {
              month: '2024-01',
              total_spend_cents: 5000,
              subscription_cost_cents: 3000,
              usage_cost_cents: 1500,
              addon_cost_cents: 500
            }
          ],
          trends: {
            trend: 'stable',
            changePercentage: 0
          }
        },
        usageVsQuota: [
          {
            event_type: 'api_call',
            current_usage: 800,
            quota_limit: 1000,
            usage_percentage: 80
          }
        ],
        summary: {
          currentSpendCents: 5000,
          spendChangePercentage: 0,
          totalQuotaUtilization: 80,
          overageRisk: 0,
          totalSavingsCents: 1000,
          addOnRevenueCents: 500
        }
      };

      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        $queryRaw: vi.fn().mockImplementation((query) => {
          if (query.includes('billing_snapshots')) {
            return Promise.resolve(mockInsights.monthlySpend.monthlyData);
          }
          if (query.includes('usage_events')) {
            return Promise.resolve(mockInsights.usageVsQuota);
          }
          return Promise.resolve([]);
        })
      } as any));

      // Mock individual service methods
      vi.spyOn(billingInsightsService, 'getMonthlySpendData').mockResolvedValue(mockInsights.monthlySpend);
      vi.spyOn(billingInsightsService, 'getUsageVsQuotaData').mockResolvedValue(mockInsights.usageVsQuota);
      vi.spyOn(billingInsightsService, 'getReferralCreditsData').mockResolvedValue({ monthlyCredits: [], totalCredits: { total_credits_cents: 0, total_referrals: 0 } });
      vi.spyOn(billingInsightsService, 'getAnnualSavingsData').mockResolvedValue({ monthlySavings: [], totalSavings: { total_savings_cents: 0, total_annual_subscriptions: 0 } });
      vi.spyOn(billingInsightsService, 'getAddOnAnalytics').mockResolvedValue([]);
      vi.spyOn(billingInsightsService, 'getInvoiceHistory').mockResolvedValue({ invoices: [], summary: {} });
      vi.spyOn(billingInsightsService, 'getBillingAlerts').mockResolvedValue([]);

      const insights = await billingInsightsService.getBillingInsights({
        businessId,
        startDate,
        endDate
      });

      expect(insights.monthlySpend).toEqual(mockInsights.monthlySpend);
      expect(insights.usageVsQuota).toEqual(mockInsights.usageVsQuota);
      expect(insights.summary).toEqual(mockInsights.summary);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        usageEvent: {
          create: vi.fn().mockRejectedValue(new Error('Database connection failed'))
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

    it('should handle Stripe API errors', async () => {
      const mockPrisma = await import('@prisma/client');
      vi.mocked(mockPrisma.PrismaClient).mockImplementation(() => ({
        addOn: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'addon-123',
            name: 'Extra API Calls',
            priceCents: 2000,
            isActive: true
          })
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

      // Mock Stripe error
      const mockStripe = await import('stripe');
      vi.mocked(mockStripe.default).mockImplementation(() => ({
        checkout: {
          sessions: {
            create: vi.fn().mockRejectedValue(new Error('Stripe API error'))
          }
        }
      } as any));

      await expect(addOnService.purchaseAddOn('business-123', 'addon-123', 1))
        .rejects.toThrow('Failed to purchase add-on');
    });
  });
});
