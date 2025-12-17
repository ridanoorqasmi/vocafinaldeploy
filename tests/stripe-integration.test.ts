import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StripeService } from '../lib/stripe-service';
import { BillingService } from '../lib/billing-service';
import { WebhookHandler } from '../lib/webhook-handler';

describe('Stripe Integration Tests', () => {
  let stripeService: StripeService;
  let billingService: BillingService;
  let webhookHandler: WebhookHandler;

  beforeEach(() => {
    stripeService = new StripeService();
    billingService = new BillingService();
    webhookHandler = new WebhookHandler();
  });

  describe('StripeService', () => {
    it('should initialize with test configuration', () => {
      expect(stripeService.isTestEnvironment()).toBe(true);
      expect(stripeService.getPublishableKey()).toBeDefined();
    });

    it('should load plan configurations correctly', () => {
      const plans = stripeService.getAllPlans();
      expect(plans).toHaveLength(4);
      
      const freePlan = stripeService.getPlanConfig('free_plan');
      expect(freePlan).toBeDefined();
      expect(freePlan?.price).toBe(0);
      expect(freePlan?.features.queries_per_month).toBe(100);

      const proPlan = stripeService.getPlanConfig('price_pro_monthly');
      expect(proPlan).toBeDefined();
      expect(proPlan?.price).toBe(9900);
      expect(proPlan?.features.queries_per_month).toBe(10000);
    });

    it('should create customer successfully', async () => {
      const customer = await stripeService.createCustomer(
        'test-business-123',
        'test@example.com',
        'Test Business',
        { test: 'true' }
      );

      expect(customer.id).toBeDefined();
      expect(customer.email).toBe('test@example.com');
      expect(customer.name).toBe('Test Business');
      expect(customer.metadata.business_id).toBe('test-business-123');
    });

    it('should retrieve customer successfully', async () => {
      // First create a customer
      const createdCustomer = await stripeService.createCustomer(
        'test-business-456',
        'retrieve@example.com',
        'Retrieve Test Business'
      );

      // Then retrieve it
      const retrievedCustomer = await stripeService.getCustomer(createdCustomer.id);
      
      expect(retrievedCustomer.id).toBe(createdCustomer.id);
      expect(retrievedCustomer.email).toBe('retrieve@example.com');
    });

    it('should create subscription successfully', async () => {
      // Create customer first
      const customer = await stripeService.createCustomer(
        'test-business-789',
        'subscription@example.com',
        'Subscription Test Business'
      );

      // Create subscription
      const subscription = await stripeService.createSubscription(
        customer.id,
        'price_starter_monthly',
        14 // 14-day trial
      );

      expect(subscription.id).toBeDefined();
      expect(subscription.customer).toBe(customer.id);
      expect(subscription.status).toBeDefined();
      expect(subscription.plan.id).toBe('price_starter_monthly');
    });

    it('should handle subscription updates', async () => {
      // Create customer and subscription
      const customer = await stripeService.createCustomer(
        'test-business-update',
        'update@example.com',
        'Update Test Business'
      );

      const subscription = await stripeService.createSubscription(
        customer.id,
        'price_starter_monthly'
      );

      // Update subscription
      const updatedSubscription = await stripeService.updateSubscription(
        subscription.id,
        'price_pro_monthly'
      );

      expect(updatedSubscription.id).toBe(subscription.id);
      expect(updatedSubscription.plan.id).toBe('price_pro_monthly');
    });

    it('should handle subscription cancellation', async () => {
      // Create customer and subscription
      const customer = await stripeService.createCustomer(
        'test-business-cancel',
        'cancel@example.com',
        'Cancel Test Business'
      );

      const subscription = await stripeService.createSubscription(
        customer.id,
        'price_starter_monthly'
      );

      // Cancel subscription
      const canceledSubscription = await stripeService.cancelSubscription(
        subscription.id,
        false // Cancel at period end
      );

      expect(canceledSubscription.id).toBe(subscription.id);
      expect(canceledSubscription.cancel_at_period_end).toBe(true);
    });
  });

  describe('BillingService', () => {
    it('should get available plans', async () => {
      const plans = await billingService.getAvailablePlans();
      expect(plans).toHaveLength(4);
      
      const planNames = plans.map(p => p.name);
      expect(planNames).toContain('Free');
      expect(planNames).toContain('Starter');
      expect(planNames).toContain('Professional');
      expect(planNames).toContain('Business');
    });

    it('should create subscription with business logic', async () => {
      const result = await billingService.createSubscription({
        businessId: 'test-business-billing',
        planId: 'price_starter_monthly',
        trialPeriodDays: 14,
      });

      expect(result.subscription).toBeDefined();
      expect(result.subscription.plan.id).toBe('price_starter_monthly');
      expect(result.subscription.plan.name).toBe('Starter');
      expect(result.subscription.status).toBeDefined();
      expect(result.next_steps).toBeDefined();
    });

    it('should handle subscription updates', async () => {
      // First create a subscription
      await billingService.createSubscription({
        businessId: 'test-business-update-billing',
        planId: 'price_starter_monthly',
      });

      // Then update it
      const result = await billingService.updateSubscription(
        'test-business-update-billing',
        'price_pro_monthly'
      );

      expect(result.subscription.plan.id).toBe('price_pro_monthly');
      expect(result.subscription.plan.name).toBe('Professional');
    });

    it('should handle subscription cancellation', async () => {
      // First create a subscription
      await billingService.createSubscription({
        businessId: 'test-business-cancel-billing',
        planId: 'price_starter_monthly',
      });

      // Then cancel it
      const result = await billingService.cancelSubscription(
        'test-business-cancel-billing',
        false // Cancel at period end
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('canceled');
    });

    it('should add payment method', async () => {
      // Create subscription first
      await billingService.createSubscription({
        businessId: 'test-business-payment',
        planId: 'price_starter_monthly',
      });

      // Add payment method (using test payment method ID)
      const result = await billingService.addPaymentMethod(
        'test-business-payment',
        'pm_test_payment_method',
        true // Set as default
      );

      expect(result.id).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.is_default).toBe(true);
    });

    it('should get invoices', async () => {
      // Create subscription first
      await billingService.createSubscription({
        businessId: 'test-business-invoices',
        planId: 'price_starter_monthly',
      });

      // Get invoices
      const result = await billingService.getInvoices('test-business-invoices', 10);

      expect(result.invoices).toBeDefined();
      expect(Array.isArray(result.invoices)).toBe(true);
      expect(result.has_more).toBeDefined();
      expect(result.total_count).toBeDefined();
    });
  });

  describe('WebhookHandler', () => {
    it('should process customer created event', async () => {
      const mockEvent = {
        id: 'evt_test_customer_created',
        type: 'customer.created',
        data: {
          object: {
            id: 'cus_test_customer',
            email: 'webhook@example.com',
            name: 'Webhook Test Customer',
            metadata: { business_id: 'test-business-webhook' }
          }
        },
        created: Math.floor(Date.now() / 1000)
      };

      const result = await webhookHandler.processWebhook(
        JSON.stringify(mockEvent),
        'test_signature'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('processed');
    });

    it('should process subscription created event', async () => {
      const mockEvent = {
        id: 'evt_test_subscription_created',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test_subscription',
            customer: 'cus_test_customer',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
            items: {
              data: [{
                price: {
                  id: 'price_starter_monthly',
                  unit_amount: 2900,
                  currency: 'usd',
                  recurring: { interval: 'month' }
                }
              }]
            }
          }
        },
        created: Math.floor(Date.now() / 1000)
      };

      const result = await webhookHandler.processWebhook(
        JSON.stringify(mockEvent),
        'test_signature'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('processed');
    });

    it('should process payment succeeded event', async () => {
      const mockEvent = {
        id: 'evt_test_payment_succeeded',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_test_invoice',
            customer: 'cus_test_customer',
            amount_paid: 2900,
            currency: 'usd',
            payment_intent: 'pi_test_payment_intent'
          }
        },
        created: Math.floor(Date.now() / 1000)
      };

      const result = await webhookHandler.processWebhook(
        JSON.stringify(mockEvent),
        'test_signature'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('processed');
    });

    it('should process payment failed event', async () => {
      const mockEvent = {
        id: 'evt_test_payment_failed',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test_invoice_failed',
            customer: 'cus_test_customer',
            amount_due: 2900,
            currency: 'usd',
            payment_intent: 'pi_test_payment_intent_failed'
          }
        },
        created: Math.floor(Date.now() / 1000)
      };

      const result = await webhookHandler.processWebhook(
        JSON.stringify(mockEvent),
        'test_signature'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('processed');
    });

    it('should handle unknown event types gracefully', async () => {
      const mockEvent = {
        id: 'evt_test_unknown',
        type: 'unknown.event.type',
        data: {
          object: {
            id: 'obj_test_unknown'
          }
        },
        created: Math.floor(Date.now() / 1000)
      };

      const result = await webhookHandler.processWebhook(
        JSON.stringify(mockEvent),
        'test_signature'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('not handled');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete subscription lifecycle', async () => {
      // 1. Create subscription
      const createResult = await billingService.createSubscription({
        businessId: 'test-business-lifecycle',
        planId: 'price_starter_monthly',
        trialPeriodDays: 14,
      });

      expect(createResult.subscription).toBeDefined();
      expect(createResult.subscription.plan.id).toBe('price_starter_monthly');

      // 2. Get subscription details
      const subscriptionDetails = await billingService.getSubscription('test-business-lifecycle');
      expect(subscriptionDetails.id).toBeDefined();
      expect(subscriptionDetails.plan.id).toBe('price_starter_monthly');

      // 3. Update subscription
      const updateResult = await billingService.updateSubscription(
        'test-business-lifecycle',
        'price_pro_monthly'
      );
      expect(updateResult.subscription.plan.id).toBe('price_pro_monthly');

      // 4. Cancel subscription
      const cancelResult = await billingService.cancelSubscription(
        'test-business-lifecycle',
        false
      );
      expect(cancelResult.success).toBe(true);
    });

    it('should handle payment method lifecycle', async () => {
      // 1. Create subscription
      await billingService.createSubscription({
        businessId: 'test-business-payment-lifecycle',
        planId: 'price_starter_monthly',
      });

      // 2. Add payment method
      const addPaymentResult = await billingService.addPaymentMethod(
        'test-business-payment-lifecycle',
        'pm_test_payment_method',
        true
      );

      expect(addPaymentResult.id).toBeDefined();
      expect(addPaymentResult.is_default).toBe(true);

      // 3. Get invoices (should show payment method was attached)
      const invoicesResult = await billingService.getInvoices('test-business-payment-lifecycle');
      expect(invoicesResult.invoices).toBeDefined();
    });

    it('should handle webhook event processing', async () => {
      // Test various webhook events
      const events = [
        {
          type: 'customer.created',
          data: { object: { id: 'cus_test', metadata: { business_id: 'test-business-webhook' } } }
        },
        {
          type: 'customer.subscription.created',
          data: { 
            object: { 
              id: 'sub_test', 
              customer: 'cus_test',
              status: 'active',
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
              items: { data: [{ price: { id: 'price_starter_monthly', unit_amount: 2900, currency: 'usd', recurring: { interval: 'month' } } }] }
            } 
          }
        },
        {
          type: 'invoice.payment_succeeded',
          data: { 
            object: { 
              id: 'in_test', 
              customer: 'cus_test',
              amount_paid: 2900,
              currency: 'usd',
              payment_intent: 'pi_test'
            } 
          }
        }
      ];

      for (const event of events) {
        const mockEvent = {
          id: `evt_test_${event.type}`,
          type: event.type,
          data: event.data,
          created: Math.floor(Date.now() / 1000)
        };

        const result = await webhookHandler.processWebhook(
          JSON.stringify(mockEvent),
          'test_signature'
        );

        expect(result.success).toBe(true);
      }
    });
  });

  afterEach(async () => {
    // Clean up test data if needed
    // In a real implementation, you'd clean up test customers, subscriptions, etc.
  });
});
