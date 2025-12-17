import Stripe from 'stripe';
import { prisma } from './prisma';

// Stripe configuration interface
interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  environment: 'test' | 'live';
}

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

export class StripeService {
  private stripe: Stripe;
  private config: StripeConfig;
  private plans: Map<string, PlanConfig>;

  constructor() {
    this.config = this.loadStripeConfig();
    this.stripe = new Stripe(this.config.secretKey, {
      apiVersion: '2023-10-16',
    });
    this.plans = this.loadPlanConfigs();
  }

  private loadStripeConfig(): StripeConfig {
    const environment = process.env.STRIPE_ENVIRONMENT as 'test' | 'live';
    const isTest = environment === 'test';

    return {
      secretKey: isTest ? process.env.STRIPE_SECRET_KEY_TEST! : process.env.STRIPE_SECRET_KEY_LIVE!,
      publishableKey: isTest ? process.env.STRIPE_PUBLIC_KEY_TEST! : process.env.STRIPE_PUBLIC_KEY_LIVE!,
      webhookSecret: isTest ? process.env.STRIPE_WEBHOOK_SECRET_TEST! : process.env.STRIPE_WEBHOOK_SECRET_LIVE!,
      environment,
    };
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
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          business_id: businessId,
          ...metadata,
        },
      });

      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name!,
        metadata: customer.metadata,
      };
    } catch (error) {
      console.error('Stripe Customer Creation Error:', error);
      throw new Error('Failed to create Stripe customer');
    }
  }

  async getCustomer(customerId: string): Promise<StripeCustomer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
      
      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name!,
        metadata: customer.metadata,
      };
    } catch (error) {
      console.error('Stripe Customer Retrieval Error:', error);
      throw new Error('Failed to retrieve Stripe customer');
    }
  }

  async updateCustomer(customerId: string, updates: Partial<{ email: string; name: string; metadata: Record<string, string> }>): Promise<StripeCustomer> {
    try {
      const customer = await this.stripe.customers.update(customerId, updates) as Stripe.Customer;
      
      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name!,
        metadata: customer.metadata,
      };
    } catch (error) {
      console.error('Stripe Customer Update Error:', error);
      throw new Error('Failed to update Stripe customer');
    }
  }

  // Subscription Management
  async createSubscription(
    customerId: string,
    planId: string,
    trialPeriodDays?: number,
    couponId?: string
  ): Promise<StripeSubscription> {
    try {
      const plan = this.plans.get(planId);
      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: planId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      };

      if (trialPeriodDays && trialPeriodDays > 0) {
        subscriptionData.trial_period_days = trialPeriodDays;
      }

      if (couponId) {
        subscriptionData.coupon = couponId;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      return {
        id: subscription.id,
        customer: subscription.customer as string,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        trial_start: subscription.trial_start || undefined,
        trial_end: subscription.trial_end || undefined,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at || undefined,
        plan: {
          id: subscription.items.data[0].price.id,
          amount: subscription.items.data[0].price.unit_amount || 0,
          currency: subscription.items.data[0].price.currency,
          interval: subscription.items.data[0].price.recurring?.interval || 'month',
        },
      };
    } catch (error) {
      console.error('Stripe Subscription Creation Error:', error);
      throw new Error('Failed to create Stripe subscription');
    }
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      return {
        id: subscription.id,
        customer: subscription.customer as string,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        trial_start: subscription.trial_start || undefined,
        trial_end: subscription.trial_end || undefined,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at || undefined,
        plan: {
          id: subscription.items.data[0].price.id,
          amount: subscription.items.data[0].price.unit_amount || 0,
          currency: subscription.items.data[0].price.currency,
          interval: subscription.items.data[0].price.recurring?.interval || 'month',
        },
      };
    } catch (error) {
      console.error('Stripe Subscription Retrieval Error:', error);
      throw new Error('Failed to retrieve Stripe subscription');
    }
  }

  async updateSubscription(
    subscriptionId: string,
    planId: string,
    prorationBehavior: 'create_prorations' | 'none' | 'always_invoice' = 'create_prorations'
  ): Promise<StripeSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: planId,
        }],
        proration_behavior: prorationBehavior,
      });

      return {
        id: updatedSubscription.id,
        customer: updatedSubscription.customer as string,
        status: updatedSubscription.status,
        current_period_start: updatedSubscription.current_period_start,
        current_period_end: updatedSubscription.current_period_end,
        trial_start: updatedSubscription.trial_start || undefined,
        trial_end: updatedSubscription.trial_end || undefined,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        canceled_at: updatedSubscription.canceled_at || undefined,
        plan: {
          id: updatedSubscription.items.data[0].price.id,
          amount: updatedSubscription.items.data[0].price.unit_amount || 0,
          currency: updatedSubscription.items.data[0].price.currency,
          interval: updatedSubscription.items.data[0].price.recurring?.interval || 'month',
        },
      };
    } catch (error) {
      console.error('Stripe Subscription Update Error:', error);
      throw new Error('Failed to update Stripe subscription');
    }
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<StripeSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: !immediately,
        ...(immediately && { cancel_at: Math.floor(Date.now() / 1000) }),
      });

      return {
        id: subscription.id,
        customer: subscription.customer as string,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        trial_start: subscription.trial_start || undefined,
        trial_end: subscription.trial_end || undefined,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at || undefined,
        plan: {
          id: subscription.items.data[0].price.id,
          amount: subscription.items.data[0].price.unit_amount || 0,
          currency: subscription.items.data[0].price.currency,
          interval: subscription.items.data[0].price.recurring?.interval || 'month',
        },
      };
    } catch (error) {
      console.error('Stripe Subscription Cancellation Error:', error);
      throw new Error('Failed to cancel Stripe subscription');
    }
  }

  // Payment Method Management
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<StripePaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year,
        } : undefined,
        bank_account: paymentMethod.us_bank_account ? {
          bank_name: paymentMethod.us_bank_account.bank_name,
          last4: paymentMethod.us_bank_account.last4,
        } : undefined,
      };
    } catch (error) {
      console.error('Stripe Payment Method Attachment Error:', error);
      throw new Error('Failed to attach payment method');
    }
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      console.error('Stripe Default Payment Method Error:', error);
      throw new Error('Failed to set default payment method');
    }
  }

  async getPaymentMethods(customerId: string): Promise<StripePaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year,
        } : undefined,
        bank_account: pm.us_bank_account ? {
          bank_name: pm.us_bank_account.bank_name,
          last4: pm.us_bank_account.last4,
        } : undefined,
      }));
    } catch (error) {
      console.error('Stripe Payment Methods Retrieval Error:', error);
      throw new Error('Failed to retrieve payment methods');
    }
  }

  // Invoice Management
  async getInvoice(invoiceId: string): Promise<StripeInvoice> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);

      return {
        id: invoice.id,
        customer: invoice.customer as string,
        subscription: invoice.subscription as string,
        amount_due: invoice.amount_due,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status || 'draft',
        description: invoice.description || undefined,
        invoice_pdf: invoice.invoice_pdf || undefined,
        hosted_invoice_url: invoice.hosted_invoice_url || undefined,
        due_date: invoice.due_date || undefined,
        paid_at: invoice.status_transitions?.paid_at || undefined,
      };
    } catch (error) {
      console.error('Stripe Invoice Retrieval Error:', error);
      throw new Error('Failed to retrieve invoice');
    }
  }

  async listInvoices(customerId: string, limit: number = 20, startingAfter?: string): Promise<{ data: StripeInvoice[]; has_more: boolean }> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit,
        starting_after: startingAfter,
      });

      return {
        data: invoices.data.map(invoice => ({
          id: invoice.id,
          customer: invoice.customer as string,
          subscription: invoice.subscription as string,
          amount_due: invoice.amount_due,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status || 'draft',
          description: invoice.description || undefined,
          invoice_pdf: invoice.invoice_pdf || undefined,
          hosted_invoice_url: invoice.hosted_invoice_url || undefined,
          due_date: invoice.due_date || undefined,
          paid_at: invoice.status_transitions?.paid_at || undefined,
        })),
        has_more: invoices.has_more,
      };
    } catch (error) {
      console.error('Stripe Invoices List Error:', error);
      throw new Error('Failed to list invoices');
    }
  }

  // Webhook verification
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.config.webhookSecret);
    } catch (error) {
      console.error('Stripe Webhook Verification Error:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  // Utility methods
  getPublishableKey(): string {
    return this.config.publishableKey;
  }

  getPlanConfig(planId: string): PlanConfig | undefined {
    return this.plans.get(planId);
  }

  getAllPlans(): PlanConfig[] {
    return Array.from(this.plans.values());
  }

  isTestEnvironment(): boolean {
    return this.config.environment === 'test';
  }
}
