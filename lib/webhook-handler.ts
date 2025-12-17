import { StripeService } from './stripe-service';
import { prisma } from './prisma';

// Webhook event interfaces
interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

interface ProcessedEvent {
  id: string;
  business_id: string;
  event_type: string;
  stripe_event_id: string;
  event_data: any;
  processed_at: Date;
  status: 'processed' | 'failed' | 'retry';
}

export class WebhookHandler {
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
  }

  // Main webhook processing method
  async processWebhook(payload: string, signature: string): Promise<{ success: boolean; message: string }> {
    try {
      // Verify webhook signature
      const event = this.stripeService.verifyWebhookSignature(payload, signature);

      // Check if event was already processed
      const existingEvent = await prisma.billing_events.findUnique({
        where: { stripe_event_id: event.id },
      });

      if (existingEvent) {
        console.log(`Event ${event.id} already processed`);
        return { success: true, message: 'Event already processed' };
      }

      // Log the event
      await this.logEvent(event);

      // Process the event based on type
      const result = await this.processEventByType(event);

      // Update event status
      await prisma.billing_events.update({
        where: { stripe_event_id: event.id },
        data: { 
          status: result.success ? 'processed' : 'failed',
          processed_at: new Date(),
        },
      });

      return result;

    } catch (error) {
      console.error('Webhook Processing Error:', error);
      
      // Log failed event
      try {
        const event = JSON.parse(payload);
        await this.logEvent(event, 'failed');
      } catch (logError) {
        console.error('Failed to log error event:', logError);
      }

      return { success: false, message: 'Webhook processing failed' };
    }
  }

  // Log webhook event
  private async logEvent(event: any, status: 'processed' | 'failed' = 'processed'): Promise<void> {
    try {
      // Extract business_id from event data
      const businessId = this.extractBusinessId(event);
      
      await prisma.billing_events.create({
        data: {
          business_id: businessId,
          event_type: event.type,
          stripe_event_id: event.id,
          event_data: event.data,
          status,
        },
      });
    } catch (error) {
      console.error('Failed to log webhook event:', error);
    }
  }

  // Extract business ID from event data
  private extractBusinessId(event: any): string {
    // Try to extract business_id from various event types
    const data = event.data.object;
    
    // From customer metadata
    if (data.metadata?.business_id) {
      return data.metadata.business_id;
    }
    
    // From subscription
    if (data.subscription) {
      // This would require a database lookup in a real implementation
      return 'unknown';
    }
    
    // From customer ID (would require lookup)
    if (data.customer) {
      return 'unknown';
    }
    
    return 'unknown';
  }

  // Process events by type
  private async processEventByType(event: WebhookEvent): Promise<{ success: boolean; message: string }> {
    const eventType = event.type;
    const data = event.data.object;

    try {
      switch (eventType) {
        // Customer events
        case 'customer.created':
          return await this.handleCustomerCreated(data);
        
        case 'customer.updated':
          return await this.handleCustomerUpdated(data);
        
        case 'customer.deleted':
          return await this.handleCustomerDeleted(data);

        // Subscription events
        case 'customer.subscription.created':
          return await this.handleSubscriptionCreated(data);
        
        case 'customer.subscription.updated':
          return await this.handleSubscriptionUpdated(data);
        
        case 'customer.subscription.deleted':
          return await this.handleSubscriptionDeleted(data);
        
        case 'customer.subscription.trial_will_end':
          return await this.handleTrialWillEnd(data);

        // Payment events
        case 'invoice.payment_succeeded':
          return await this.handlePaymentSucceeded(data);
        
        case 'invoice.payment_failed':
          return await this.handlePaymentFailed(data);
        
        case 'payment_method.attached':
          return await this.handlePaymentMethodAttached(data);
        
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(data);

        // Billing events
        case 'invoice.created':
          return await this.handleInvoiceCreated(data);
        
        case 'invoice.finalized':
          return await this.handleInvoiceFinalized(data);
        
        case 'invoice.paid':
          return await this.handleInvoicePaid(data);
        
        case 'invoice.payment_action_required':
          return await this.handlePaymentActionRequired(data);

        default:
          console.log(`Unhandled event type: ${eventType}`);
          return { success: true, message: 'Event type not handled' };
      }
    } catch (error) {
      console.error(`Error processing ${eventType}:`, error);
      return { success: false, message: `Failed to process ${eventType}` };
    }
  }

  // Customer event handlers
  private async handleCustomerCreated(customer: any): Promise<{ success: boolean; message: string }> {
    console.log('Customer created:', customer.id);
    // Customer creation is handled in subscription creation
    return { success: true, message: 'Customer created event processed' };
  }

  private async handleCustomerUpdated(customer: any): Promise<{ success: boolean; message: string }> {
    console.log('Customer updated:', customer.id);
    // Update customer information if needed
    return { success: true, message: 'Customer updated event processed' };
  }

  private async handleCustomerDeleted(customer: any): Promise<{ success: boolean; message: string }> {
    console.log('Customer deleted:', customer.id);
    // Handle customer deletion cleanup
    return { success: true, message: 'Customer deleted event processed' };
  }

  // Subscription event handlers
  private async handleSubscriptionCreated(subscription: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Subscription created:', subscription.id);
      
      // Update subscription status in database
      await prisma.subscriptions.updateMany({
        where: { stripe_subscription_id: subscription.id },
        data: {
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
          trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          updated_at: new Date(),
        },
      });

      return { success: true, message: 'Subscription created event processed' };
    } catch (error) {
      console.error('Error handling subscription created:', error);
      return { success: false, message: 'Failed to process subscription created' };
    }
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Subscription updated:', subscription.id);
      
      // Update subscription in database
      await prisma.subscriptions.updateMany({
        where: { stripe_subscription_id: subscription.id },
        data: {
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
          trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date(),
        },
      });

      return { success: true, message: 'Subscription updated event processed' };
    } catch (error) {
      console.error('Error handling subscription updated:', error);
      return { success: false, message: 'Failed to process subscription updated' };
    }
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Subscription deleted:', subscription.id);
      
      // Update subscription status to canceled
      await prisma.subscriptions.updateMany({
        where: { stripe_subscription_id: subscription.id },
        data: {
          status: 'canceled',
          canceled_at: new Date(),
          updated_at: new Date(),
        },
      });

      return { success: true, message: 'Subscription deleted event processed' };
    } catch (error) {
      console.error('Error handling subscription deleted:', error);
      return { success: false, message: 'Failed to process subscription deleted' };
    }
  }

  private async handleTrialWillEnd(subscription: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Trial will end:', subscription.id);
      
      // Send notification to business about trial ending
      // This would integrate with your notification system
      
      return { success: true, message: 'Trial will end event processed' };
    } catch (error) {
      console.error('Error handling trial will end:', error);
      return { success: false, message: 'Failed to process trial will end' };
    }
  }

  // Payment event handlers
  private async handlePaymentSucceeded(invoice: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Payment succeeded for invoice:', invoice.id);
      
      // Update invoice status
      await prisma.invoices.updateMany({
        where: { stripe_invoice_id: invoice.id },
        data: {
          status: 'paid',
          amount_paid: invoice.amount_paid,
          paid_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Create payment history record
      await prisma.payment_history.create({
        data: {
          business_id: this.extractBusinessId({ data: { object: invoice } }),
          stripe_payment_intent_id: invoice.payment_intent,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: 'succeeded',
          processed_at: new Date(),
        },
      });

      return { success: true, message: 'Payment succeeded event processed' };
    } catch (error) {
      console.error('Error handling payment succeeded:', error);
      return { success: false, message: 'Failed to process payment succeeded' };
    }
  }

  private async handlePaymentFailed(invoice: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Payment failed for invoice:', invoice.id);
      
      // Update invoice status
      await prisma.invoices.updateMany({
        where: { stripe_invoice_id: invoice.id },
        data: {
          status: 'past_due',
          updated_at: new Date(),
        },
      });

      // Create payment history record
      await prisma.payment_history.create({
        data: {
          business_id: this.extractBusinessId({ data: { object: invoice } }),
          stripe_payment_intent_id: invoice.payment_intent,
          amount: invoice.amount_due,
          currency: invoice.currency,
          status: 'failed',
          failure_reason: 'Payment failed',
          processed_at: new Date(),
        },
      });

      // Send notification about failed payment
      // This would integrate with your notification system

      return { success: true, message: 'Payment failed event processed' };
    } catch (error) {
      console.error('Error handling payment failed:', error);
      return { success: false, message: 'Failed to process payment failed' };
    }
  }

  private async handlePaymentMethodAttached(paymentMethod: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Payment method attached:', paymentMethod.id);
      
      // Update or create payment method record
      await prisma.payment_methods.upsert({
        where: { stripe_payment_method_id: paymentMethod.id },
        update: {
          stripe_customer_id: paymentMethod.customer,
          type: paymentMethod.type,
          card_brand: paymentMethod.card?.brand,
          card_last4: paymentMethod.card?.last4,
          card_exp_month: paymentMethod.card?.exp_month,
          card_exp_year: paymentMethod.card?.exp_year,
          updated_at: new Date(),
        },
        create: {
          business_id: this.extractBusinessId({ data: { object: paymentMethod } }),
          stripe_payment_method_id: paymentMethod.id,
          stripe_customer_id: paymentMethod.customer,
          type: paymentMethod.type,
          card_brand: paymentMethod.card?.brand,
          card_last4: paymentMethod.card?.last4,
          card_exp_month: paymentMethod.card?.exp_month,
          card_exp_year: paymentMethod.card?.exp_year,
        },
      });

      return { success: true, message: 'Payment method attached event processed' };
    } catch (error) {
      console.error('Error handling payment method attached:', error);
      return { success: false, message: 'Failed to process payment method attached' };
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Payment intent succeeded:', paymentIntent.id);
      
      // Create payment history record
      await prisma.payment_history.create({
        data: {
          business_id: this.extractBusinessId({ data: { object: paymentIntent } }),
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'succeeded',
          processed_at: new Date(),
        },
      });

      return { success: true, message: 'Payment intent succeeded event processed' };
    } catch (error) {
      console.error('Error handling payment intent succeeded:', error);
      return { success: false, message: 'Failed to process payment intent succeeded' };
    }
  }

  // Billing event handlers
  private async handleInvoiceCreated(invoice: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Invoice created:', invoice.id);
      
      // Create invoice record
      await prisma.invoices.create({
        data: {
          business_id: this.extractBusinessId({ data: { object: invoice } }),
          stripe_invoice_id: invoice.id,
          stripe_customer_id: invoice.customer,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          status: invoice.status,
          description: invoice.description,
          due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        },
      });

      return { success: true, message: 'Invoice created event processed' };
    } catch (error) {
      console.error('Error handling invoice created:', error);
      return { success: false, message: 'Failed to process invoice created' };
    }
  }

  private async handleInvoiceFinalized(invoice: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Invoice finalized:', invoice.id);
      
      // Update invoice status
      await prisma.invoices.updateMany({
        where: { stripe_invoice_id: invoice.id },
        data: {
          status: invoice.status,
          invoice_pdf_url: invoice.invoice_pdf,
          hosted_invoice_url: invoice.hosted_invoice_url,
          updated_at: new Date(),
        },
      });

      return { success: true, message: 'Invoice finalized event processed' };
    } catch (error) {
      console.error('Error handling invoice finalized:', error);
      return { success: false, message: 'Failed to process invoice finalized' };
    }
  }

  private async handleInvoicePaid(invoice: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Invoice paid:', invoice.id);
      
      // Update invoice status
      await prisma.invoices.updateMany({
        where: { stripe_invoice_id: invoice.id },
        data: {
          status: 'paid',
          amount_paid: invoice.amount_paid,
          paid_at: new Date(),
          updated_at: new Date(),
        },
      });

      return { success: true, message: 'Invoice paid event processed' };
    } catch (error) {
      console.error('Error handling invoice paid:', error);
      return { success: false, message: 'Failed to process invoice paid' };
    }
  }

  private async handlePaymentActionRequired(invoice: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Payment action required for invoice:', invoice.id);
      
      // Update invoice status
      await prisma.invoices.updateMany({
        where: { stripe_invoice_id: invoice.id },
        data: {
          status: 'open',
          updated_at: new Date(),
        },
      });

      // Send notification about payment action required
      // This would integrate with your notification system

      return { success: true, message: 'Payment action required event processed' };
    } catch (error) {
      console.error('Error handling payment action required:', error);
      return { success: false, message: 'Failed to process payment action required' };
    }
  }
}
