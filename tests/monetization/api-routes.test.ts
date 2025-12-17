import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the services
vi.mock('@/lib/services/usage-billing-service', () => ({
  usageBillingService: {
    recordUsageEvent: vi.fn(),
    getUsageEvents: vi.fn(),
    getUsageAnalytics: vi.fn(),
    getUsageVsQuota: vi.fn(),
    processPendingUsageEvents: vi.fn()
  }
}));

vi.mock('@/lib/services/addon-service', () => ({
  addOnService: {
    getActiveAddOns: vi.fn(),
    getBusinessAddOns: vi.fn(),
    getUpsellCampaigns: vi.fn(),
    createAddOn: vi.fn(),
    purchaseAddOn: vi.fn(),
    cancelBusinessAddOn: vi.fn(),
    createUpsellCampaign: vi.fn(),
    recordUpsellInteraction: vi.fn(),
    getAddOnAnalytics: vi.fn()
  }
}));

vi.mock('@/lib/services/custom-plan-service', () => ({
  customPlanService: {
    createCustomPlan: vi.fn(),
    getCustomPlan: vi.fn(),
    updateCustomPlan: vi.fn(),
    deactivateCustomPlan: vi.fn(),
    getCustomPlanBillingInfo: vi.fn(),
    getCustomPlanUsageAnalytics: vi.fn(),
    shouldUseCustomPlan: vi.fn()
  }
}));

vi.mock('@/lib/services/invoice-service', () => ({
  invoiceService: {
    createInvoice: vi.fn(),
    generateInvoiceFromStripe: vi.fn(),
    getBusinessInvoices: vi.fn(),
    getInvoiceById: vi.fn(),
    getInvoiceDownloadUrl: vi.fn(),
    updateBusinessBillingInfo: vi.fn(),
    getBillingInsights: vi.fn(),
    getBillingAlerts: vi.fn(),
    createBillingAlert: vi.fn(),
    markBillingAlertAsRead: vi.fn(),
    getInvoiceAnalytics: vi.fn()
  }
}));

vi.mock('@/lib/services/billing-insights-service', () => ({
  billingInsightsService: {
    getBillingInsights: vi.fn(),
    getBillingKPIs: vi.fn(),
    getMonthlySpendData: vi.fn(),
    getUsageVsQuotaData: vi.fn(),
    getReferralCreditsData: vi.fn(),
    getAnnualSavingsData: vi.fn(),
    getAddOnAnalytics: vi.fn(),
    getInvoiceHistory: vi.fn(),
    getBillingAlerts: vi.fn()
  }
}));

describe('Monetization API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Usage API Routes', () => {
    it('should handle POST /api/v1/monetization/usage', async () => {
      const { usageBillingService } = await import('@/lib/services/usage-billing-service');
      const mockUsageEvent = {
        id: 'usage-123',
        businessId: 'business-123',
        eventType: 'api_call',
        quantity: 100,
        totalCostCents: 100
      };

      vi.mocked(usageBillingService.recordUsageEvent).mockResolvedValue(mockUsageEvent);

      const { POST } = await import('@/app/api/v1/monetization/usage/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/usage', {
        method: 'POST',
        body: JSON.stringify({
          businessId: 'business-123',
          eventType: 'api_call',
          quantity: 100,
          unitPriceCents: 1,
          metadata: {}
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockUsageEvent);
      expect(usageBillingService.recordUsageEvent).toHaveBeenCalledWith({
        businessId: 'business-123',
        eventType: 'api_call',
        quantity: 100,
        unitPriceCents: 1,
        metadata: {}
      });
    });

    it('should handle GET /api/v1/monetization/usage', async () => {
      const { usageBillingService } = await import('@/lib/services/usage-billing-service');
      const mockUsageEvents = [
        {
          id: 'usage-1',
          businessId: 'business-123',
          eventType: 'api_call',
          quantity: 100
        }
      ];

      vi.mocked(usageBillingService.getUsageEvents).mockResolvedValue(mockUsageEvents);

      const { GET } = await import('@/app/api/v1/monetization/usage/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/usage?businessId=business-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockUsageEvents);
    });

    it('should handle PUT /api/v1/monetization/usage for processing', async () => {
      const { usageBillingService } = await import('@/lib/services/usage-billing-service');
      vi.mocked(usageBillingService.processPendingUsageEvents).mockResolvedValue();

      const { PUT } = await import('@/app/api/v1/monetization/usage/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/usage', {
        method: 'PUT',
        body: JSON.stringify({ action: 'process_pending' })
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(usageBillingService.processPendingUsageEvents).toHaveBeenCalled();
    });
  });

  describe('Add-ons API Routes', () => {
    it('should handle GET /api/v1/monetization/addons?type=active', async () => {
      const { addOnService } = await import('@/lib/services/addon-service');
      const mockAddOns = [
        {
          id: 'addon-1',
          name: 'Extra API Calls',
          priceCents: 2000,
          isActive: true
        }
      ];

      vi.mocked(addOnService.getActiveAddOns).mockResolvedValue(mockAddOns);

      const { GET } = await import('@/app/api/v1/monetization/addons/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/addons?type=active');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockAddOns);
    });

    it('should handle POST /api/v1/monetization/addons for purchase', async () => {
      const { addOnService } = await import('@/lib/services/addon-service');
      const mockPurchaseResult = {
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
        sessionId: 'cs_test_123'
      };

      vi.mocked(addOnService.purchaseAddOn).mockResolvedValue(mockPurchaseResult);

      const { POST } = await import('@/app/api/v1/monetization/addons/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/addons', {
        method: 'POST',
        body: JSON.stringify({
          action: 'purchase',
          businessId: 'business-123',
          addOnId: 'addon-123',
          quantity: 1
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockPurchaseResult);
    });

    it('should handle PUT /api/v1/monetization/addons for cancellation', async () => {
      const { addOnService } = await import('@/lib/services/addon-service');
      const mockCancelledAddOn = {
        id: 'business-addon-123',
        status: 'cancelled',
        cancelledAt: new Date()
      };

      vi.mocked(addOnService.cancelBusinessAddOn).mockResolvedValue(mockCancelledAddOn);

      const { PUT } = await import('@/app/api/v1/monetization/addons/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/addons', {
        method: 'PUT',
        body: JSON.stringify({
          action: 'cancel',
          businessAddOnId: 'business-addon-123'
        })
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockCancelledAddOn);
    });
  });

  describe('Custom Plans API Routes', () => {
    it('should handle GET /api/v1/monetization/custom-plans?type=business', async () => {
      const { customPlanService } = await import('@/lib/services/custom-plan-service');
      const mockCustomPlan = {
        id: 'custom-plan-123',
        businessId: 'business-123',
        planName: 'Enterprise Plan',
        basePriceCents: 50000,
        status: 'active'
      };

      vi.mocked(customPlanService.getCustomPlan).mockResolvedValue(mockCustomPlan);

      const { GET } = await import('@/app/api/v1/monetization/custom-plans/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/custom-plans?type=business&businessId=business-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockCustomPlan);
    });

    it('should handle POST /api/v1/monetization/custom-plans for creation', async () => {
      const { customPlanService } = await import('@/lib/services/custom-plan-service');
      const mockCustomPlan = {
        id: 'custom-plan-123',
        businessId: 'business-123',
        planName: 'Enterprise Plan',
        basePriceCents: 50000,
        status: 'active'
      };

      vi.mocked(customPlanService.createCustomPlan).mockResolvedValue(mockCustomPlan);

      const { POST } = await import('@/app/api/v1/monetization/custom-plans/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/custom-plans', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          businessId: 'business-123',
          planName: 'Enterprise Plan',
          basePriceCents: 50000,
          billingPeriod: 'monthly',
          limits: { api_call: 100000 },
          createdBy: 'user-123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockCustomPlan);
    });
  });

  describe('Invoices API Routes', () => {
    it('should handle GET /api/v1/monetization/invoices?type=business', async () => {
      const { invoiceService } = await import('@/lib/services/invoice-service');
      const mockInvoices = [
        {
          id: 'invoice-123',
          businessId: 'business-123',
          invoiceNumber: 'INV-001',
          status: 'paid',
          amountCents: 5000
        }
      ];

      vi.mocked(invoiceService.getBusinessInvoices).mockResolvedValue(mockInvoices);

      const { GET } = await import('@/app/api/v1/monetization/invoices/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/invoices?type=business&businessId=business-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockInvoices);
    });

    it('should handle POST /api/v1/monetization/invoices for generation', async () => {
      const { invoiceService } = await import('@/lib/services/invoice-service');
      const mockInvoice = {
        id: 'invoice-123',
        businessId: 'business-123',
        stripeInvoiceId: 'in_123',
        invoiceNumber: 'INV-001',
        status: 'paid'
      };

      vi.mocked(invoiceService.generateInvoiceFromStripe).mockResolvedValue(mockInvoice);

      const { POST } = await import('@/app/api/v1/monetization/invoices/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/invoices', {
        method: 'POST',
        body: JSON.stringify({
          action: 'generate_from_stripe',
          businessId: 'business-123',
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockInvoice);
    });
  });

  describe('Billing Insights API Routes', () => {
    it('should handle GET /api/v1/monetization/insights?type=comprehensive', async () => {
      const { billingInsightsService } = await import('@/lib/services/billing-insights-service');
      const mockInsights = {
        monthlySpend: {
          monthlyData: [],
          trends: { trend: 'stable', changePercentage: 0 }
        },
        usageVsQuota: [],
        summary: {
          currentSpendCents: 5000,
          spendChangePercentage: 0,
          totalQuotaUtilization: 50,
          overageRisk: 0,
          totalSavingsCents: 1000,
          addOnRevenueCents: 500
        }
      };

      vi.mocked(billingInsightsService.getBillingInsights).mockResolvedValue(mockInsights);

      const { GET } = await import('@/app/api/v1/monetization/insights/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/insights?businessId=business-123&type=comprehensive&startDate=2024-01-01&endDate=2024-01-31');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockInsights);
    });

    it('should handle GET /api/v1/monetization/insights?type=kpis', async () => {
      const { billingInsightsService } = await import('@/lib/services/billing-insights-service');
      const mockKPIs = {
        currentSpendCents: 5000,
        spendGrowthPercentage: 10,
        quotaUtilizationPercentage: 75,
        totalSavingsCents: 1000,
        overageRisk: 0
      };

      vi.mocked(billingInsightsService.getBillingKPIs).mockResolvedValue(mockKPIs);

      const { GET } = await import('@/app/api/v1/monetization/insights/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/insights?businessId=business-123&type=kpis');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockKPIs);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const { POST } = await import('@/app/api/v1/monetization/usage/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/usage', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
          businessId: 'business-123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to record usage event');
    });

    it('should handle missing business ID', async () => {
      const { GET } = await import('@/app/api/v1/monetization/usage/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/usage');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Business ID is required');
    });

    it('should handle service errors', async () => {
      const { usageBillingService } = await import('@/lib/services/usage-billing-service');
      vi.mocked(usageBillingService.recordUsageEvent).mockRejectedValue(new Error('Service error'));

      const { POST } = await import('@/app/api/v1/monetization/usage/route');
      const request = new NextRequest('http://localhost:3000/api/v1/monetization/usage', {
        method: 'POST',
        body: JSON.stringify({
          businessId: 'business-123',
          eventType: 'api_call',
          quantity: 100,
          unitPriceCents: 1,
          metadata: {}
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to record usage event');
    });
  });
});
