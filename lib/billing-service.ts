import { StripeService } from './stripe-service';
import { prisma } from './prisma';

// Billing service interfaces
interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface CreateSubscriptionRequest {
  businessId: string;
  planId: string;
  paymentMethodId?: string;
  trialPeriodDays?: number;
  couponId?: string;
  customerDetails?: {
    taxId?: string;
    address?: BillingAddress;
  };
}

interface CreateSubscriptionResponse {
  subscription: {
    id: string;
    stripe_subscription_id: string;
    plan: {
      id: string;
      name: string;
      price: number;
      currency: string;
      features: any;
    };
    status: string;
    current_period: {
      start: string;
      end: string;
    };
    trial_period?: {
      start: string;
      end: string;
    };
  };
  setup_required: boolean;
  client_secret?: string;
  next_steps: string[];
}

interface SubscriptionDetails {
  id: string;
  plan: any;
  status: string;
  billing_cycle: {
    current_period_start: string;
    current_period_end: string;
    days_until_renewal: number;
  };
  payment_status: {
    last_payment: any | null;
    next_payment_date: string;
    default_payment_method: any | null;
  };
  usage_summary: {
    queries_used_this_period: number;
    queries_remaining: number;
    overage_charges: number;
  };
}

interface PaymentMethodDetails {
  id: string;
  type: string;
  is_default: boolean;
  details: {
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
  };
  created_at: string;
}

interface InvoiceDetails {
  id: string;
  stripe_invoice_id: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  description: string;
  due_date: string;
  paid_at?: string;
  invoice_pdf_url: string;
  hosted_invoice_url: string;
  line_items: any[];
}

export class BillingService {
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
  }

  // Subscription Management
  async createSubscription(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
    const { businessId, planId, paymentMethodId, trialPeriodDays, couponId, customerDetails } = request;

    try {
      // Get business details
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new Error('Business not found');
      }

      // Get or create Stripe customer
      let stripeCustomerId: string;
      const existingCustomer = await prisma.subscriptions.findFirst({
        where: { business_id: businessId },
        select: { stripe_customer_id: true },
      });

      if (existingCustomer) {
        stripeCustomerId = existingCustomer.stripe_customer_id;
      } else {
        const stripeCustomer = await this.stripeService.createCustomer(
          businessId,
          business.email,
          business.business_name,
          {
            business_id: businessId,
            ...customerDetails,
          }
        );
        stripeCustomerId = stripeCustomer.id;
      }

      // Attach payment method if provided
      if (paymentMethodId) {
        await this.stripeService.attachPaymentMethod(paymentMethodId, stripeCustomerId);
        await this.stripeService.setDefaultPaymentMethod(stripeCustomerId, paymentMethodId);
      }

      // Create subscription
      const stripeSubscription = await this.stripeService.createSubscription(
        stripeCustomerId,
        planId,
        trialPeriodDays,
        couponId
      );

      // Get plan configuration
      const planConfig = this.stripeService.getPlanConfig(planId);
      if (!planConfig) {
        throw new Error(`Plan ${planId} not found`);
      }

      // Save subscription to database
      const subscription = await prisma.subscriptions.create({
        data: {
          business_id: businessId,
          stripe_subscription_id: stripeSubscription.id,
          stripe_customer_id: stripeCustomerId,
          plan_id: planId,
          plan_name: planConfig.name,
          status: stripeSubscription.status,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000),
          trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          metadata: {
            coupon_id: couponId,
            customer_details: customerDetails,
          },
        },
      });

      // Determine next steps
      const nextSteps: string[] = [];
      let setupRequired = false;
      let clientSecret: string | undefined;

      if (stripeSubscription.status === 'incomplete') {
        setupRequired = true;
        nextSteps.push('Complete payment method setup');
        // In a real implementation, you'd get the client_secret from the payment intent
      }

      if (stripeSubscription.trial_start) {
        nextSteps.push(`Trial period started - ${trialPeriodDays || 14} days remaining`);
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
        setup_required: setupRequired,
        client_secret: clientSecret,
        next_steps: nextSteps,
      };

    } catch (error) {
      console.error('Billing Service - Create Subscription Error:', error);
      throw new Error('Failed to create subscription');
    }
  }

  async getSubscription(businessId: string): Promise<SubscriptionDetails> {
    try {
      const subscription = await prisma.subscriptions.findFirst({
        where: { 
          business_id: businessId,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        orderBy: { created_at: 'desc' },
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Get plan configuration
      const planConfig = this.stripeService.getPlanConfig(subscription.plan_id);
      if (!planConfig) {
        throw new Error(`Plan ${subscription.plan_id} not found`);
      }

      // Get payment methods
      const paymentMethods = await prisma.payment_methods.findMany({
        where: { 
          business_id: businessId,
          stripe_customer_id: subscription.stripe_customer_id,
        },
        orderBy: { created_at: 'desc' },
      });

      const defaultPaymentMethod = paymentMethods.find(pm => pm.is_default);

      // Get last payment
      const lastPayment = await prisma.payment_history.findFirst({
        where: { 
          business_id: businessId,
          status: 'succeeded',
        },
        orderBy: { processed_at: 'desc' },
      });

      // Calculate usage (this would integrate with your existing analytics)
      const usageSummary = await this.calculateUsageSummary(businessId, subscription);

      // Calculate days until renewal
      const now = new Date();
      const daysUntilRenewal = Math.ceil(
        (subscription.current_period_end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

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
          days_until_renewal: Math.max(0, daysUntilRenewal),
        },
        payment_status: {
          last_payment: lastPayment ? {
            amount: lastPayment.amount,
            currency: lastPayment.currency,
            processed_at: lastPayment.processed_at.toISOString(),
          } : null,
          next_payment_date: subscription.current_period_end.toISOString(),
          default_payment_method: defaultPaymentMethod ? {
            id: defaultPaymentMethod.id,
            type: defaultPaymentMethod.type,
            is_default: defaultPaymentMethod.is_default,
            details: {
              card: defaultPaymentMethod.card_brand ? {
                brand: defaultPaymentMethod.card_brand,
                last4: defaultPaymentMethod.card_last4,
                exp_month: defaultPaymentMethod.card_exp_month,
                exp_year: defaultPaymentMethod.card_exp_year,
              } : undefined,
              bank_account: defaultPaymentMethod.bank_account_bank_name ? {
                bank_name: defaultPaymentMethod.bank_account_bank_name,
                last4: defaultPaymentMethod.bank_account_last4,
              } : undefined,
            },
            created_at: defaultPaymentMethod.created_at.toISOString(),
          } : null,
        },
        usage_summary: usageSummary,
      };

    } catch (error) {
      console.error('Billing Service - Get Subscription Error:', error);
      throw new Error('Failed to get subscription details');
    }
  }

  async updateSubscription(businessId: string, newPlanId: string): Promise<CreateSubscriptionResponse> {
    try {
      const subscription = await prisma.subscriptions.findFirst({
        where: { 
          business_id: businessId,
          status: { in: ['active', 'trialing'] }
        },
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Update subscription in Stripe
      const updatedStripeSubscription = await this.stripeService.updateSubscription(
        subscription.stripe_subscription_id,
        newPlanId
      );

      // Get new plan configuration
      const newPlanConfig = this.stripeService.getPlanConfig(newPlanId);
      if (!newPlanConfig) {
        throw new Error(`Plan ${newPlanId} not found`);
      }

      // Update subscription in database
      const updatedSubscription = await prisma.subscriptions.update({
        where: { id: subscription.id },
        data: {
          plan_id: newPlanId,
          plan_name: newPlanConfig.name,
          status: updatedStripeSubscription.status,
          current_period_start: new Date(updatedStripeSubscription.current_period_start * 1000),
          current_period_end: new Date(updatedStripeSubscription.current_period_end * 1000),
          updated_at: new Date(),
        },
      });

      return {
        subscription: {
          id: updatedSubscription.id,
          stripe_subscription_id: updatedSubscription.stripe_subscription_id,
          plan: {
            id: newPlanConfig.id,
            name: newPlanConfig.name,
            price: newPlanConfig.price,
            currency: newPlanConfig.currency,
            features: newPlanConfig.features,
          },
          status: updatedSubscription.status,
          current_period: {
            start: updatedSubscription.current_period_start.toISOString(),
            end: updatedSubscription.current_period_end.toISOString(),
          },
        },
        setup_required: false,
        next_steps: ['Subscription plan updated successfully'],
      };

    } catch (error) {
      console.error('Billing Service - Update Subscription Error:', error);
      throw new Error('Failed to update subscription');
    }
  }

  async cancelSubscription(businessId: string, immediately: boolean = false): Promise<{ success: boolean; message: string }> {
    try {
      const subscription = await prisma.subscriptions.findFirst({
        where: { 
          business_id: businessId,
          status: { in: ['active', 'trialing'] }
        },
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Cancel subscription in Stripe
      await this.stripeService.cancelSubscription(subscription.stripe_subscription_id, immediately);

      // Update subscription in database
      await prisma.subscriptions.update({
        where: { id: subscription.id },
        data: {
          status: immediately ? 'canceled' : 'active',
          canceled_at: immediately ? new Date() : null,
          cancel_at_period_end: !immediately,
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        message: immediately 
          ? 'Subscription canceled immediately' 
          : 'Subscription will be canceled at the end of the current period',
      };

    } catch (error) {
      console.error('Billing Service - Cancel Subscription Error:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Payment Method Management
  async addPaymentMethod(businessId: string, paymentMethodId: string, setAsDefault: boolean = false): Promise<PaymentMethodDetails> {
    try {
      const subscription = await prisma.subscriptions.findFirst({
        where: { business_id: businessId },
      });

      if (!subscription) {
        throw new Error('No subscription found for this business');
      }

      // Attach payment method in Stripe
      const stripePaymentMethod = await this.stripeService.attachPaymentMethod(
        paymentMethodId,
        subscription.stripe_customer_id
      );

      // Set as default if requested
      if (setAsDefault) {
        await this.stripeService.setDefaultPaymentMethod(
          subscription.stripe_customer_id,
          paymentMethodId
        );
      }

      // Save payment method to database
      const paymentMethod = await prisma.payment_methods.create({
        data: {
          business_id: businessId,
          stripe_payment_method_id: paymentMethodId,
          stripe_customer_id: subscription.stripe_customer_id,
          type: stripePaymentMethod.type,
          is_default: setAsDefault,
          card_brand: stripePaymentMethod.card?.brand,
          card_last4: stripePaymentMethod.card?.last4,
          card_exp_month: stripePaymentMethod.card?.exp_month,
          card_exp_year: stripePaymentMethod.card?.exp_year,
          bank_account_last4: stripePaymentMethod.bank_account?.last4,
          bank_account_bank_name: stripePaymentMethod.bank_account?.bank_name,
        },
      });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        is_default: paymentMethod.is_default,
        details: {
          card: paymentMethod.card_brand ? {
            brand: paymentMethod.card_brand,
            last4: paymentMethod.card_last4!,
            exp_month: paymentMethod.card_exp_month!,
            exp_year: paymentMethod.card_exp_year!,
          } : undefined,
          bank_account: paymentMethod.bank_account_bank_name ? {
            bank_name: paymentMethod.bank_account_bank_name,
            last4: paymentMethod.bank_account_last4!,
          } : undefined,
        },
        created_at: paymentMethod.created_at.toISOString(),
      };

    } catch (error) {
      console.error('Billing Service - Add Payment Method Error:', error);
      throw new Error('Failed to add payment method');
    }
  }

  // Invoice Management
  async getInvoices(businessId: string, limit: number = 20, startingAfter?: string, status?: string): Promise<{
    invoices: InvoiceDetails[];
    has_more: boolean;
    total_count: number;
  }> {
    try {
      const subscription = await prisma.subscriptions.findFirst({
        where: { business_id: businessId },
      });

      if (!subscription) {
        throw new Error('No subscription found for this business');
      }

      // Get invoices from Stripe
      const stripeInvoices = await this.stripeService.listInvoices(
        subscription.stripe_customer_id,
        limit,
        startingAfter
      );

      // Get invoices from database for additional details
      const dbInvoices = await prisma.invoices.findMany({
        where: { 
          business_id: businessId,
          ...(status && { status }),
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      });

      const invoices: InvoiceDetails[] = [];

      for (const stripeInvoice of stripeInvoices.data) {
        const dbInvoice = dbInvoices.find(db => db.stripe_invoice_id === stripeInvoice.id);
        
        invoices.push({
          id: dbInvoice?.id || stripeInvoice.id,
          stripe_invoice_id: stripeInvoice.id,
          amount_due: stripeInvoice.amount_due,
          amount_paid: stripeInvoice.amount_paid,
          currency: stripeInvoice.currency,
          status: stripeInvoice.status,
          description: stripeInvoice.description || 'Subscription invoice',
          due_date: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000).toISOString() : new Date().toISOString(),
          paid_at: stripeInvoice.paid_at ? new Date(stripeInvoice.paid_at * 1000).toISOString() : undefined,
          invoice_pdf_url: stripeInvoice.invoice_pdf || '',
          hosted_invoice_url: stripeInvoice.hosted_invoice_url || '',
          line_items: [], // Would be populated from Stripe invoice line items
        });
      }

      return {
        invoices,
        has_more: stripeInvoices.has_more,
        total_count: invoices.length,
      };

    } catch (error) {
      console.error('Billing Service - Get Invoices Error:', error);
      throw new Error('Failed to get invoices');
    }
  }

  // Utility methods
  private async calculateUsageSummary(businessId: string, subscription: any): Promise<{
    queries_used_this_period: number;
    queries_remaining: number;
    overage_charges: number;
  }> {
    // This would integrate with your existing analytics system
    // For now, return mock data
    const planConfig = this.stripeService.getPlanConfig(subscription.plan_id);
    const queriesAllowed = planConfig?.features.queries_per_month || 0;
    
    // Mock usage calculation - replace with real analytics integration
    const queriesUsed = Math.floor(Math.random() * queriesAllowed * 0.8); // 80% usage
    const queriesRemaining = Math.max(0, queriesAllowed - queriesUsed);
    const overageCharges = 0; // Would calculate based on overage pricing

    return {
      queries_used_this_period: queriesUsed,
      queries_remaining: queriesRemaining,
      overage_charges: overageCharges,
    };
  }

  async getAvailablePlans(): Promise<any[]> {
    return this.stripeService.getAllPlans();
  }

  async getBillingPortalUrl(businessId: string): Promise<string> {
    try {
      const subscription = await prisma.subscriptions.findFirst({
        where: { business_id: businessId },
      });

      if (!subscription) {
        throw new Error('No subscription found for this business');
      }

      // Create Stripe billing portal session
      const session = await this.stripeService['stripe'].billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      });

      return session.url;

    } catch (error) {
      console.error('Billing Service - Get Billing Portal URL Error:', error);
      throw new Error('Failed to get billing portal URL');
    }
  }
}
