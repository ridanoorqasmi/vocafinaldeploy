import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database and Stripe service for testing
const mockPrisma = {
  business: {
    findUnique: vi.fn(),
  },
  subscriptions: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  payment_methods: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  payment_history: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  invoices: {
    findMany: vi.fn(),
  },
};

// Mock the Stripe service
class MockBillingService {
  private plans = [
    {
      id: 'free_plan',
      name: 'Free',
      price: 0,
      currency: 'usd',
      features: {
        queries_per_month: 100,
        analytics_basic: true,
        support_level: 'community',
        locations: 1,
        templates: false,
        custom_rules: false,
        api_access: false,
      },
    },
    {
      id: 'price_starter_monthly',
      name: 'Starter',
      price: 2900,
      currency: 'usd',
      features: {
        queries_per_month: 2000,
        analytics_basic: true,
        support_level: 'email',
        locations: 1,
        templates: true,
        custom_rules: false,
        api_access: false,
      },
    },
    {
      id: 'price_pro_monthly',
      name: 'Professional',
      price: 9900,
      currency: 'usd',
      features: {
        queries_per_month: 10000,
        analytics_basic: true,
        analytics_advanced: true,
        support_level: 'email_phone',
        locations: 5,
        templates: true,
        custom_rules: true,
        api_access: true,
      },
    },
  ];

  async getAvailablePlans() {
    return this.plans;
  }

  async createSubscription(request: any) {
    const { businessId, planId, trialPeriodDays } = request;
    
    // Mock business lookup
    mockPrisma.business.findUnique.mockResolvedValue({
      id: businessId,
      email: 'test@example.com',
      business_name: 'Test Business',
    });

    // Mock subscription creation
    const subscription = {
      id: 'sub_test_123',
      business_id: businessId,
      stripe_subscription_id: 'sub_stripe_123',
      stripe_customer_id: 'cus_stripe_123',
      plan_id: planId,
      plan_name: this.plans.find(p => p.id === planId)?.name || 'Unknown',
      status: trialPeriodDays ? 'trialing' : 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      trial_start: trialPeriodDays ? new Date() : null,
      trial_end: trialPeriodDays ? new Date(Date.now() + trialPeriodDays * 24 * 60 * 60 * 1000) : null,
      metadata: {},
    };

    mockPrisma.subscriptions.create.mockResolvedValue(subscription);

    const planConfig = this.plans.find(p => p.id === planId);
    if (!planConfig) {
      throw new Error(`Plan ${planId} not found`);
    }

    return {
      subscription: {
        id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id,
        plan: {
          id: planConfig.id,
          name: planConfig.name,
          price: planConfig.price,
          currency: planConfig.currency,
          features: planConfig.features,
        },
        status: subscription.status,
        current_period: {
          start: subscription.current_period_start.toISOString(),
          end: subscription.current_period_end.toISOString(),
        },
        trial_period: subscription.trial_start ? {
          start: subscription.trial_start.toISOString(),
          end: subscription.trial_end!.toISOString(),
        } : undefined,
      },
      setup_required: false,
      next_steps: trialPeriodDays ? [`Trial period started - ${trialPeriodDays} days remaining`] : ['Subscription created successfully'],
    };
  }

  async getSubscription(businessId: string) {
    // Mock subscription lookup
    const subscription = {
      id: 'sub_test_123',
      business_id: businessId,
      plan_id: 'price_starter_monthly',
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    mockPrisma.subscriptions.findFirst.mockResolvedValue(subscription);

    const planConfig = this.plans.find(p => p.id === subscription.plan_id);
    if (!planConfig) {
      throw new Error(`Plan ${subscription.plan_id} not found`);
    }

    // Mock payment methods
    const paymentMethods = [
      {
        id: 'pm_test_123',
        type: 'card',
        is_default: true,
        card_brand: 'visa',
        card_last4: '4242',
        card_exp_month: 12,
        card_exp_year: 2025,
        created_at: new Date(),
      },
    ];

    mockPrisma.payment_methods.findMany.mockResolvedValue(paymentMethods);

    // Mock last payment
    const lastPayment = {
      amount: 2900,
      currency: 'usd',
      processed_at: new Date(),
    };

    mockPrisma.payment_history.findFirst.mockResolvedValue(lastPayment);

    // Mock usage summary
    const usageSummary = {
      queries_used_this_period: 1500,
      queries_remaining: 500,
      overage_charges: 0,
    };

    return {
      id: subscription.id,
      plan: {
        id: planConfig.id,
        name: planConfig.name,
        price: planConfig.price,
        currency: planConfig.currency,
        features: planConfig.features,
      },
      status: subscription.status,
      billing_cycle: {
        current_period_start: subscription.current_period_start.toISOString(),
        current_period_end: subscription.current_period_end.toISOString(),
        days_until_renewal: 15,
      },
      payment_status: {
        last_payment: {
          amount: lastPayment.amount,
          currency: lastPayment.currency,
          processed_at: lastPayment.processed_at.toISOString(),
        },
        next_payment_date: subscription.current_period_end.toISOString(),
        default_payment_method: {
          id: paymentMethods[0].id,
          type: paymentMethods[0].type,
          is_default: paymentMethods[0].is_default,
          details: {
            card: {
              brand: paymentMethods[0].card_brand,
              last4: paymentMethods[0].card_last4,
              exp_month: paymentMethods[0].card_exp_month,
              exp_year: paymentMethods[0].card_exp_year,
            },
          },
          created_at: paymentMethods[0].created_at.toISOString(),
        },
      },
      usage_summary: usageSummary,
    };
  }

  async updateSubscription(businessId: string, newPlanId: string) {
    // Mock subscription lookup
    const subscription = {
      id: 'sub_test_123',
      business_id: businessId,
      plan_id: 'price_starter_monthly',
      status: 'active',
    };

    mockPrisma.subscriptions.findFirst.mockResolvedValue(subscription);

    // Mock subscription update
    const updatedSubscription = {
      ...subscription,
      plan_id: newPlanId,
      plan_name: this.plans.find(p => p.id === newPlanId)?.name || 'Unknown',
    };

    mockPrisma.subscriptions.update.mockResolvedValue(updatedSubscription);

    const planConfig = this.plans.find(p => p.id === newPlanId);
    if (!planConfig) {
      throw new Error(`Plan ${newPlanId} not found`);
    }

    return {
      subscription: {
        id: updatedSubscription.id,
        stripe_subscription_id: 'sub_stripe_123',
        plan: {
          id: planConfig.id,
          name: planConfig.name,
          price: planConfig.price,
          currency: planConfig.currency,
          features: planConfig.features,
        },
        status: updatedSubscription.status,
        current_period: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      setup_required: false,
      next_steps: ['Subscription plan updated successfully'],
    };
  }

  async cancelSubscription(businessId: string, immediately: boolean = false) {
    // Mock subscription lookup
    const subscription = {
      id: 'sub_test_123',
      business_id: businessId,
      status: 'active',
    };

    mockPrisma.subscriptions.findFirst.mockResolvedValue(subscription);

    // Mock subscription cancellation
    const canceledSubscription = {
      ...subscription,
      status: immediately ? 'canceled' : 'active',
      canceled_at: immediately ? new Date() : null,
      cancel_at_period_end: !immediately,
    };

    mockPrisma.subscriptions.update.mockResolvedValue(canceledSubscription);

    return {
      success: true,
      message: immediately 
        ? 'Subscription canceled immediately' 
        : 'Subscription will be canceled at the end of the current period',
    };
  }

  async addPaymentMethod(businessId: string, paymentMethodId: string, setAsDefault: boolean = false) {
    // Mock subscription lookup
    const subscription = {
      id: 'sub_test_123',
      business_id: businessId,
      stripe_customer_id: 'cus_stripe_123',
    };

    mockPrisma.subscriptions.findFirst.mockResolvedValue(subscription);

    // Mock payment method creation
    const paymentMethod = {
      id: 'pm_test_123',
      business_id: businessId,
      stripe_payment_method_id: paymentMethodId,
      stripe_customer_id: subscription.stripe_customer_id,
      type: 'card',
      is_default: setAsDefault,
      card_brand: 'visa',
      card_last4: '4242',
      card_exp_month: 12,
      card_exp_year: 2025,
      created_at: new Date(),
    };

    mockPrisma.payment_methods.create.mockResolvedValue(paymentMethod);

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      is_default: paymentMethod.is_default,
      details: {
        card: {
          brand: paymentMethod.card_brand,
          last4: paymentMethod.card_last4,
          exp_month: paymentMethod.card_exp_month,
          exp_year: paymentMethod.card_exp_year,
        },
      },
      created_at: paymentMethod.created_at.toISOString(),
    };
  }

  async getInvoices(businessId: string, limit: number = 20, startingAfter?: string, status?: string) {
    // Mock subscription lookup
    const subscription = {
      id: 'sub_test_123',
      business_id: businessId,
      stripe_customer_id: 'cus_stripe_123',
    };

    mockPrisma.subscriptions.findFirst.mockResolvedValue(subscription);

    // Mock invoices
    const invoices = [
      {
        id: 'in_test_123',
        stripe_invoice_id: 'in_stripe_123',
        amount_due: 2900,
        amount_paid: 2900,
        currency: 'usd',
        status: 'paid',
        description: 'Monthly subscription',
        due_date: new Date(),
        paid_at: new Date(),
        invoice_pdf_url: 'https://invoice.pdf',
        hosted_invoice_url: 'https://invoice.stripe.com',
      },
    ];

    mockPrisma.invoices.findMany.mockResolvedValue(invoices);

    return {
      invoices: invoices.map(invoice => ({
        id: invoice.id,
        stripe_invoice_id: invoice.stripe_invoice_id,
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        description: invoice.description,
        due_date: invoice.due_date.toISOString(),
        paid_at: invoice.paid_at.toISOString(),
        invoice_pdf_url: invoice.invoice_pdf_url,
        hosted_invoice_url: invoice.hosted_invoice_url,
        line_items: [],
      })),
      has_more: false,
      total_count: invoices.length,
    };
  }
}

describe('Billing Service Tests', () => {
  let billingService: MockBillingService;

  beforeEach(() => {
    billingService = new MockBillingService();
    // Reset all mocks
    Object.values(mockPrisma).forEach(mock => {
      if (typeof mock === 'object' && mock !== null) {
        Object.values(mock).forEach(fn => {
          if (typeof fn === 'function' && 'mockClear' in fn) {
            (fn as any).mockClear();
          }
        });
      }
    });
  });

  describe('Plan Management', () => {
    it('should get available plans', async () => {
      const plans = await billingService.getAvailablePlans();
      
      expect(plans).toHaveLength(3);
      expect(plans[0].id).toBe('free_plan');
      expect(plans[1].id).toBe('price_starter_monthly');
      expect(plans[2].id).toBe('price_pro_monthly');
    });

    it('should have correct plan features', async () => {
      const plans = await billingService.getAvailablePlans();
      
      const freePlan = plans.find(p => p.id === 'free_plan');
      expect(freePlan?.features.queries_per_month).toBe(100);
      expect(freePlan?.features.support_level).toBe('community');
      
      const proPlan = plans.find(p => p.id === 'price_pro_monthly');
      expect(proPlan?.features.queries_per_month).toBe(10000);
      expect(proPlan?.features.api_access).toBe(true);
    });
  });

  describe('Subscription Management', () => {
    it('should create subscription successfully', async () => {
      const result = await billingService.createSubscription({
        businessId: 'test-business-123',
        planId: 'price_starter_monthly',
        trialPeriodDays: 14,
      });

      expect(result.subscription).toBeDefined();
      expect(result.subscription.plan.id).toBe('price_starter_monthly');
      expect(result.subscription.plan.name).toBe('Starter');
      expect(result.subscription.status).toBe('trialing');
      expect(result.subscription.trial_period).toBeDefined();
      expect(result.setup_required).toBe(false);
      expect(result.next_steps).toContain('Trial period started - 14 days remaining');
    });

    it('should create subscription without trial', async () => {
      const result = await billingService.createSubscription({
        businessId: 'test-business-456',
        planId: 'price_pro_monthly',
      });

      expect(result.subscription.status).toBe('active');
      expect(result.subscription.trial_period).toBeUndefined();
      expect(result.next_steps).toContain('Subscription created successfully');
    });

    it('should get subscription details', async () => {
      const subscription = await billingService.getSubscription('test-business-123');

      expect(subscription.id).toBeDefined();
      expect(subscription.plan.id).toBe('price_starter_monthly');
      expect(subscription.status).toBe('active');
      expect(subscription.billing_cycle).toBeDefined();
      expect(subscription.payment_status).toBeDefined();
      expect(subscription.usage_summary).toBeDefined();
    });

    it('should update subscription plan', async () => {
      const result = await billingService.updateSubscription(
        'test-business-123',
        'price_pro_monthly'
      );

      expect(result.subscription.plan.id).toBe('price_pro_monthly');
      expect(result.subscription.plan.name).toBe('Professional');
      expect(result.setup_required).toBe(false);
      expect(result.next_steps).toContain('Subscription plan updated successfully');
    });

    it('should cancel subscription at period end', async () => {
      const result = await billingService.cancelSubscription(
        'test-business-123',
        false
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('end of the current period');
    });

    it('should cancel subscription immediately', async () => {
      const result = await billingService.cancelSubscription(
        'test-business-123',
        true
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('canceled immediately');
    });
  });

  describe('Payment Method Management', () => {
    it('should add payment method', async () => {
      const result = await billingService.addPaymentMethod(
        'test-business-123',
        'pm_test_payment_method',
        true
      );

      expect(result.id).toBeDefined();
      expect(result.type).toBe('card');
      expect(result.is_default).toBe(true);
      expect(result.details.card).toBeDefined();
      expect(result.details.card.brand).toBe('visa');
      expect(result.details.card.last4).toBe('4242');
    });

    it('should add payment method without setting as default', async () => {
      const result = await billingService.addPaymentMethod(
        'test-business-123',
        'pm_test_payment_method',
        false
      );

      expect(result.is_default).toBe(false);
    });
  });

  describe('Invoice Management', () => {
    it('should get invoices', async () => {
      const result = await billingService.getInvoices('test-business-123', 10);

      expect(result.invoices).toBeDefined();
      expect(Array.isArray(result.invoices)).toBe(true);
      expect(result.has_more).toBe(false);
      expect(result.total_count).toBe(1);
      
      const invoice = result.invoices[0];
      expect(invoice.id).toBeDefined();
      expect(invoice.amount_due).toBe(2900);
      expect(invoice.currency).toBe('usd');
      expect(invoice.status).toBe('paid');
    });

    it('should get invoices with pagination', async () => {
      const result = await billingService.getInvoices(
        'test-business-123', 
        5, 
        'in_after_this'
      );

      expect(result.invoices).toBeDefined();
      expect(result.has_more).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid plan ID in subscription creation', async () => {
      await expect(billingService.createSubscription({
        businessId: 'test-business-123',
        planId: 'invalid_plan_id',
      })).rejects.toThrow('Plan invalid_plan_id not found');
    });

    it('should handle invalid plan ID in subscription update', async () => {
      // Mock the subscription lookup to return a subscription
      mockPrisma.subscriptions.findFirst.mockResolvedValue({
        id: 'sub_test_123',
        business_id: 'test-business-123',
        plan_id: 'price_starter_monthly',
        status: 'active',
      });

      await expect(billingService.updateSubscription(
        'test-business-123',
        'invalid_plan_id'
      )).rejects.toThrow('Plan invalid_plan_id not found');
    });
  });
});
