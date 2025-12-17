// Mock Stripe service for testing without actual Stripe API calls
import { StripeService } from './stripe-service';

// Mock Stripe types
interface MockStripeCustomer {
  id: string;
  email: string;
  name: string;
  metadata: Record<string, string>;
}

interface MockStripeSubscription {
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

export class MockStripeService extends StripeService {
  private mockCustomers: Map<string, MockStripeCustomer> = new Map();
  private mockSubscriptions: Map<string, MockStripeSubscription> = new Map();
  private mockPaymentMethods: any[] = [];

  constructor() {
    super();
  }

  async createCustomer(businessId: string, email: string, name: string, metadata: Record<string, string> = {}): Promise<any> {
    const customerId = `cus_mock_${Date.now()}`;
    const customer = {
      id: customerId,
      email,
      name,
      metadata: { business_id: businessId, ...metadata },
    };
    
    this.mockCustomers.set(customerId, customer);
    
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata,
    };
  }

  async getCustomer(customerId: string): Promise<any> {
    const customer = this.mockCustomers.get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata,
    };
  }

  async updateCustomer(customerId: string, updates: any): Promise<any> {
    const customer = this.mockCustomers.get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    const updatedCustomer = { ...customer, ...updates };
    this.mockCustomers.set(customerId, updatedCustomer);
    
    return {
      id: updatedCustomer.id,
      email: updatedCustomer.email,
      name: updatedCustomer.name,
      metadata: updatedCustomer.metadata,
    };
  }

  async createSubscription(customerId: string, planId: string, trialPeriodDays?: number, couponId?: string): Promise<any> {
    const subscriptionId = `sub_mock_${Date.now()}`;
    const now = Math.floor(Date.now() / 1000);
    const periodEnd = now + (30 * 24 * 60 * 60); // 30 days from now
    
    const subscription = {
      id: subscriptionId,
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
        amount: this.getPlanConfig(planId)?.price || 0,
        currency: 'usd',
        interval: 'month',
      },
    };
    
    this.mockSubscriptions.set(subscriptionId, subscription);
    
    return {
      id: subscription.id,
      customer: subscription.customer,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      trial_start: subscription.trial_start,
      trial_end: subscription.trial_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at,
      plan: subscription.plan,
    };
  }

  async getSubscription(subscriptionId: string): Promise<any> {
    const subscription = this.mockSubscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    
    return {
      id: subscription.id,
      customer: subscription.customer,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      trial_start: subscription.trial_start,
      trial_end: subscription.trial_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at,
      plan: subscription.plan,
    };
  }

  async updateSubscription(subscriptionId: string, planId: string, prorationBehavior: string = 'create_prorations'): Promise<any> {
    const subscription = this.mockSubscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    
    const updatedSubscription = {
      ...subscription,
      plan: {
        id: planId,
        amount: this.getPlanConfig(planId)?.price || 0,
        currency: 'usd',
        interval: 'month',
      },
    };
    
    this.mockSubscriptions.set(subscriptionId, updatedSubscription);
    
    return {
      id: updatedSubscription.id,
      customer: updatedSubscription.customer,
      status: updatedSubscription.status,
      current_period_start: updatedSubscription.current_period_start,
      current_period_end: updatedSubscription.current_period_end,
      trial_start: updatedSubscription.trial_start,
      trial_end: updatedSubscription.trial_end,
      cancel_at_period_end: updatedSubscription.cancel_at_period_end,
      canceled_at: updatedSubscription.canceled_at,
      plan: updatedSubscription.plan,
    };
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<any> {
    const subscription = this.mockSubscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    
    const updatedSubscription = {
      ...subscription,
      status: immediately ? 'canceled' : 'active',
      cancel_at_period_end: !immediately,
      canceled_at: immediately ? Math.floor(Date.now() / 1000) : undefined,
    };
    
    this.mockSubscriptions.set(subscriptionId, updatedSubscription);
    
    return {
      id: updatedSubscription.id,
      customer: updatedSubscription.customer,
      status: updatedSubscription.status,
      current_period_start: updatedSubscription.current_period_start,
      current_period_end: updatedSubscription.current_period_end,
      trial_start: updatedSubscription.trial_start,
      trial_end: updatedSubscription.trial_end,
      cancel_at_period_end: updatedSubscription.cancel_at_period_end,
      canceled_at: updatedSubscription.canceled_at,
      plan: updatedSubscription.plan,
    };
  }

  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<any> {
    const paymentMethod = {
      id: paymentMethodId,
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
      },
    };
    
    this.mockPaymentMethods.push(paymentMethod);
    
    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      card: paymentMethod.card,
    };
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // Mock implementation - just return success
    return Promise.resolve();
  }

  async getPaymentMethods(customerId: string): Promise<any[]> {
    return this.mockPaymentMethods.filter(pm => pm.customer === customerId);
  }

  async getInvoice(invoiceId: string): Promise<any> {
    return {
      id: invoiceId,
      customer: 'cus_mock_customer',
      subscription: 'sub_mock_subscription',
      amount_due: 2900,
      amount_paid: 2900,
      currency: 'usd',
      status: 'paid',
      description: 'Mock invoice',
      invoice_pdf: 'https://mock-invoice.pdf',
      hosted_invoice_url: 'https://mock-invoice.stripe.com',
      due_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      paid_at: Math.floor(Date.now() / 1000),
    };
  }

  async listInvoices(customerId: string, limit: number = 20, startingAfter?: string): Promise<{ data: any[]; has_more: boolean }> {
    return {
      data: [
        {
          id: 'in_mock_invoice',
          customer: customerId,
          subscription: 'sub_mock_subscription',
          amount_due: 2900,
          amount_paid: 2900,
          currency: 'usd',
          status: 'paid',
          description: 'Mock invoice',
          invoice_pdf: 'https://mock-invoice.pdf',
          hosted_invoice_url: 'https://mock-invoice.stripe.com',
          due_date: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          paid_at: Math.floor(Date.now() / 1000),
        }
      ],
      has_more: false,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): any {
    // Mock webhook verification - always return success
    const event = JSON.parse(payload);
    return {
      id: event.id || 'evt_mock_event',
      type: event.type || 'test.event',
      data: event.data || { object: {} },
      created: Math.floor(Date.now() / 1000),
    };
  }

  // Helper methods
  getPublishableKey(): string {
    return 'pk_test_mock_key';
  }

  isTestEnvironment(): boolean {
    return true;
  }

  getPlanConfig(planId: string): any {
    return super.getPlanConfig(planId);
  }

  getAllPlans(): any[] {
    return super.getAllPlans();
  }
}
