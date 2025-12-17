import { describe, it, expect, beforeEach } from 'vitest';
import { StripeServiceTest } from '../lib/stripe-service-test';

describe('Stripe Service Tests', () => {
  let stripeService: StripeServiceTest;

  beforeEach(() => {
    stripeService = new StripeServiceTest();
  });

  describe('Configuration', () => {
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
  });

  describe('Customer Management', () => {
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
      const customer = await stripeService.getCustomer('cus_test_customer');
      
      expect(customer.id).toBe('cus_test_customer');
      expect(customer.email).toBe('test@example.com');
      expect(customer.name).toBe('Test Customer');
    });

    it('should update customer successfully', async () => {
      const updatedCustomer = await stripeService.updateCustomer('cus_test_customer', {
        name: 'Updated Business Name',
        email: 'updated@example.com'
      });

      expect(updatedCustomer.id).toBe('cus_test_customer');
      expect(updatedCustomer.name).toBe('Updated Business Name');
      expect(updatedCustomer.email).toBe('updated@example.com');
    });
  });

  describe('Subscription Management', () => {
    it('should create subscription successfully', async () => {
      const subscription = await stripeService.createSubscription(
        'cus_test_customer',
        'price_starter_monthly',
        14 // 14-day trial
      );

      expect(subscription.id).toBeDefined();
      expect(subscription.customer).toBe('cus_test_customer');
      expect(subscription.status).toBe('trialing');
      expect(subscription.plan.id).toBe('price_starter_monthly');
      expect(subscription.trial_start).toBeDefined();
      expect(subscription.trial_end).toBeDefined();
    });

    it('should create subscription without trial', async () => {
      const subscription = await stripeService.createSubscription(
        'cus_test_customer',
        'price_starter_monthly'
      );

      expect(subscription.id).toBeDefined();
      expect(subscription.customer).toBe('cus_test_customer');
      expect(subscription.status).toBe('active');
      expect(subscription.plan.id).toBe('price_starter_monthly');
      expect(subscription.trial_start).toBeUndefined();
      expect(subscription.trial_end).toBeUndefined();
    });

    it('should handle subscription updates', async () => {
      const updatedSubscription = await stripeService.updateSubscription(
        'sub_test_subscription',
        'price_pro_monthly'
      );

      expect(updatedSubscription.id).toBe('sub_test_subscription');
      expect(updatedSubscription.plan.id).toBe('price_pro_monthly');
    });

    it('should handle subscription cancellation at period end', async () => {
      const canceledSubscription = await stripeService.cancelSubscription(
        'sub_test_subscription',
        false // Cancel at period end
      );

      expect(canceledSubscription.id).toBe('sub_test_subscription');
      expect(canceledSubscription.cancel_at_period_end).toBe(true);
      expect(canceledSubscription.status).toBe('active');
    });

    it('should handle immediate subscription cancellation', async () => {
      const canceledSubscription = await stripeService.cancelSubscription(
        'sub_test_subscription',
        true // Cancel immediately
      );

      expect(canceledSubscription.id).toBe('sub_test_subscription');
      expect(canceledSubscription.status).toBe('canceled');
      expect(canceledSubscription.canceled_at).toBeDefined();
    });
  });

  describe('Payment Method Management', () => {
    it('should attach payment method successfully', async () => {
      const paymentMethod = await stripeService.attachPaymentMethod(
        'pm_test_payment_method',
        'cus_test_customer'
      );

      expect(paymentMethod.id).toBe('pm_test_payment_method');
      expect(paymentMethod.type).toBe('card');
      expect(paymentMethod.card).toBeDefined();
      expect(paymentMethod.card?.brand).toBe('visa');
      expect(paymentMethod.card?.last4).toBe('4242');
    });

    it('should set default payment method', async () => {
      await expect(stripeService.setDefaultPaymentMethod(
        'cus_test_customer',
        'pm_test_payment_method'
      )).resolves.toBeUndefined();
    });

    it('should get payment methods', async () => {
      const paymentMethods = await stripeService.getPaymentMethods('cus_test_customer');
      
      expect(Array.isArray(paymentMethods)).toBe(true);
      expect(paymentMethods.length).toBeGreaterThan(0);
      expect(paymentMethods[0].id).toBe('pm_test_payment_method');
    });
  });

  describe('Invoice Management', () => {
    it('should get invoice successfully', async () => {
      const invoice = await stripeService.getInvoice('in_test_invoice');

      expect(invoice.id).toBe('in_test_invoice');
      expect(invoice.amount_due).toBe(2900);
      expect(invoice.currency).toBe('usd');
      expect(invoice.status).toBe('paid');
    });

    it('should list invoices successfully', async () => {
      const invoices = await stripeService.listInvoices('cus_test_customer', 10);

      expect(invoices.data).toBeDefined();
      expect(Array.isArray(invoices.data)).toBe(true);
      expect(invoices.has_more).toBe(false);
      expect(invoices.data.length).toBeGreaterThan(0);
    });
  });

  describe('Webhook Processing', () => {
    it('should verify webhook signature', () => {
      const payload = JSON.stringify({
        id: 'evt_test_event',
        type: 'customer.created',
        data: { object: { id: 'cus_test' } }
      });
      const signature = 'test_signature';

      const event = stripeService.verifyWebhookSignature(payload, signature);

      expect(event.id).toBe('evt_test_event');
      expect(event.type).toBe('customer.created');
      expect(event.data).toBeDefined();
    });

    it('should handle malformed webhook payload', () => {
      const payload = 'invalid json';
      const signature = 'test_signature';

      expect(() => {
        stripeService.verifyWebhookSignature(payload, signature);
      }).toThrow();
    });
  });

  describe('Plan Configuration', () => {
    it('should have correct plan structure', () => {
      const plans = stripeService.getAllPlans();
      
      expect(plans).toHaveLength(4);
      
      const planIds = plans.map(p => p.id);
      expect(planIds).toContain('free_plan');
      expect(planIds).toContain('price_starter_monthly');
      expect(planIds).toContain('price_pro_monthly');
      expect(planIds).toContain('price_business_monthly');
    });

    it('should have correct pricing', () => {
      const freePlan = stripeService.getPlanConfig('free_plan');
      expect(freePlan?.price).toBe(0);

      const starterPlan = stripeService.getPlanConfig('price_starter_monthly');
      expect(starterPlan?.price).toBe(2900);

      const proPlan = stripeService.getPlanConfig('price_pro_monthly');
      expect(proPlan?.price).toBe(9900);

      const businessPlan = stripeService.getPlanConfig('price_business_monthly');
      expect(businessPlan?.price).toBe(29900);
    });

    it('should have correct features', () => {
      const freePlan = stripeService.getPlanConfig('free_plan');
      expect(freePlan?.features.queries_per_month).toBe(100);
      expect(freePlan?.features.support_level).toBe('community');

      const proPlan = stripeService.getPlanConfig('price_pro_monthly');
      expect(proPlan?.features.queries_per_month).toBe(10000);
      expect(proPlan?.features.support_level).toBe('email_phone');
      expect(proPlan?.features.api_access).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid plan ID in subscription creation', async () => {
      await expect(stripeService.createSubscription(
        'cus_test_customer',
        'invalid_plan_id'
      )).rejects.toThrow('Plan invalid_plan_id not found');
    });

    it('should handle invalid plan ID in subscription update', async () => {
      await expect(stripeService.updateSubscription(
        'sub_test_subscription',
        'invalid_plan_id'
      )).rejects.toThrow('Plan invalid_plan_id not found');
    });
  });
});
