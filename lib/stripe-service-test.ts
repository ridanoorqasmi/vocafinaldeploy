// Test version of Stripe service that doesn't require the actual Stripe package
// This is used for testing without installing Stripe dependencies

// Plan configuration interface
interface PlanConfig {
  id: string;
  name: string;
  price: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  features: {
    queries_per_month: number;
    analytics_basic: boolean;
    analytics_advanced: boolean;
    support_level: 'community' | 'email' | 'email_phone';
    locations: number;
    templates: boolean;
    custom_rules: boolean;
    api_access: boolean;
  };
}

// Stripe service response interfaces
interface StripeCustomer {
  id: string;
  email: string;
  name: string;
  metadata: Record<string, string>;
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  trial_start?: number;
  trial_end?: number;
  cancel_at_period_end: boolean;
  canceled_at?: number;
  plan: {
    id: string;
    amount: number;
    currency: string;
    interval: string;
  };
}

interface StripePaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  bank_account?: {
    bank_name: string;
    last4: string;
  };
}

interface StripeInvoice {
  id: string;
  customer: string;
  subscription?: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  description?: string;
  invoice_pdf?: string;
  hosted_invoice_url?: string;
  due_date?: number;
  paid_at?: number;
}

export class StripeServiceTest {
  private plans: Map<string, PlanConfig>;

  constructor() {
    this.plans = this.loadPlanConfigs();
  }

  private loadPlanConfigs(): Map<string, PlanConfig> {
    const plans = new Map<string, PlanConfig>();
    
    // Free plan
    plans.set('free_plan', {
      id: 'free_plan',
      name: 'Free',
      price: 0,
      currency: 'usd',
      interval: 'month',
      features: {
        queries_per_month: 100,
        analytics_basic: true,
        analytics_advanced: false,
        support_level: 'community',
        locations: 1,
        templates: false,
        custom_rules: false,
        api_access: false,
      },
    });

    // Starter plan
    plans.set('price_starter_monthly', {
      id: 'price_starter_monthly',
      name: 'Starter',
      price: 2900, // $29.00
      currency: 'usd',
      interval: 'month',
      features: {
        queries_per_month: 2000,
        analytics_basic: true,
        analytics_advanced: false,
        support_level: 'email',
        locations: 1,
        templates: true,
        custom_rules: false,
        api_access: false,
      },
    });

    // Professional plan
    plans.set('price_pro_monthly', {
      id: 'price_pro_monthly',
      name: 'Professional',
      price: 9900, // $99.00
      currency: 'usd',
      interval: 'month',
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
    });

    // Business plan
    plans.set('price_business_monthly', {
      id: 'price_business_monthly',
      name: 'Business',
      price: 29900, // $299.00
      currency: 'usd',
      interval: 'month',
      features: {
        queries_per_month: 50000,
        analytics_basic: true,
        analytics_advanced: true,
        support_level: 'email_phone',
        locations: 20,
        templates: true,
        custom_rules: true,
        api_access: true,
      },
    });

    return plans;
  }

  // Customer Management
  async createCustomer(businessId: string, email: string, name: string, metadata: Record<string, string> = {}): Promise<StripeCustomer> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: `cus_test_${Date.now()}`,
      email,
      name,
      metadata: {
        business_id: businessId,
        ...metadata,
      },
    };
  }

  async getCustomer(customerId: string): Promise<StripeCustomer> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: customerId,
      email: 'test@example.com',
      name: 'Test Customer',
      metadata: { business_id: 'test-business' },
    };
  }

  async updateCustomer(customerId: string, updates: Partial<{ email: string; name: string; metadata: Record<string, string> }>): Promise<StripeCustomer> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: customerId,
      email: updates.email || 'test@example.com',
      name: updates.name || 'Test Customer',
      metadata: updates.metadata || { business_id: 'test-business' },
    };
  }

  // Subscription Management
  async createSubscription(
    customerId: string,
    planId: string,
    trialPeriodDays?: number,
    couponId?: string
  ): Promise<StripeSubscription> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const now = Math.floor(Date.now() / 1000);
    const periodEnd = now + (30 * 24 * 60 * 60); // 30 days from now
    
    return {
      id: `sub_test_${Date.now()}`,
      customer: customerId,
      status: trialPeriodDays ? 'trialing' : 'active',
      current_period_start: now,
      current_period_end: periodEnd,
      trial_start: trialPeriodDays ? now : undefined,
      trial_end: trialPeriodDays ? now + (trialPeriodDays * 24 * 60 * 60) : undefined,
      cancel_at_period_end: false,
      canceled_at: undefined,
      plan: {
        id: planId,
        amount: plan.price,
        currency: plan.currency,
        interval: plan.interval,
      },
    };
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: subscriptionId,
      customer: 'cus_test_customer',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      cancel_at_period_end: false,
      plan: {
        id: 'price_starter_monthly',
        amount: 2900,
        currency: 'usd',
        interval: 'month',
      },
    };
  }

  async updateSubscription(
    subscriptionId: string,
    planId: string,
    prorationBehavior: 'create_prorations' | 'none' | 'always_invoice' = 'create_prorations'
  ): Promise<StripeSubscription> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }
    
    return {
      id: subscriptionId,
      customer: 'cus_test_customer',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      cancel_at_period_end: false,
      plan: {
        id: planId,
        amount: plan.price,
        currency: plan.currency,
        interval: plan.interval,
      },
    };
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<StripeSubscription> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 150));
    
    return {
      id: subscriptionId,
      customer: 'cus_test_customer',
      status: immediately ? 'canceled' : 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      cancel_at_period_end: !immediately,
      canceled_at: immediately ? Math.floor(Date.now() / 1000) : undefined,
      plan: {
        id: 'price_starter_monthly',
        amount: 2900,
        currency: 'usd',
        interval: 'month',
      },
    };
  }

  // Payment Method Management
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<StripePaymentMethod> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: paymentMethodId,
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
      },
    };
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async getPaymentMethods(customerId: string): Promise<StripePaymentMethod[]> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return [
      {
        id: 'pm_test_payment_method',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025,
        },
      }
    ];
  }

  // Invoice Management
  async getInvoice(invoiceId: string): Promise<StripeInvoice> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: invoiceId,
      customer: 'cus_test_customer',
      subscription: 'sub_test_subscription',
      amount_due: 2900,
      amount_paid: 2900,
      currency: 'usd',
      status: 'paid',
      description: 'Test invoice',
      invoice_pdf: 'https://test-invoice.pdf',
      hosted_invoice_url: 'https://test-invoice.stripe.com',
      due_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      paid_at: Math.floor(Date.now() / 1000),
    };
  }

  async listInvoices(customerId: string, limit: number = 20, startingAfter?: string): Promise<{ data: StripeInvoice[]; has_more: boolean }> {
    // Mock implementation - simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      data: [
        {
          id: 'in_test_invoice',
          customer: customerId,
          subscription: 'sub_test_subscription',
          amount_due: 2900,
          amount_paid: 2900,
          currency: 'usd',
          status: 'paid',
          description: 'Test invoice',
          invoice_pdf: 'https://test-invoice.pdf',
          hosted_invoice_url: 'https://test-invoice.stripe.com',
          due_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          paid_at: Math.floor(Date.now() / 1000),
        }
      ],
      has_more: false,
    };
  }

  // Webhook verification
  verifyWebhookSignature(payload: string, signature: string): any {
    // Mock implementation - always return success
    const event = JSON.parse(payload);
    return {
      id: event.id || 'evt_test_event',
      type: event.type || 'test.event',
      data: event.data || { object: {} },
      created: Math.floor(Date.now() / 1000),
    };
  }

  // Utility methods
  getPublishableKey(): string {
    return 'pk_test_mock_key';
  }

  getPlanConfig(planId: string): PlanConfig | undefined {
    return this.plans.get(planId);
  }

  getAllPlans(): PlanConfig[] {
    return Array.from(this.plans.values());
  }

  isTestEnvironment(): boolean {
    return true;
  }
}
