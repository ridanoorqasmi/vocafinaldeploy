import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

// Validation schemas
const InvoiceSchema = z.object({
  businessId: z.string().uuid(),
  stripeInvoiceId: z.string().optional(),
  invoiceNumber: z.string(),
  status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']),
  amountCents: z.number().min(0),
  amountPaidCents: z.number().min(0).default(0),
  taxCents: z.number().min(0).default(0),
  discountCents: z.number().min(0).default(0),
  currency: z.string().default('usd'),
  dueDate: z.string().transform(str => new Date(str)).optional()
});

const InvoiceLineItemSchema = z.object({
  invoiceId: z.string().uuid(),
  description: z.string(),
  quantity: z.number().min(0).default(1),
  unitPriceCents: z.number().min(0),
  totalCents: z.number().min(0),
  lineType: z.enum(['subscription', 'usage', 'addon', 'discount', 'tax']).default('subscription'),
  metadata: z.record(z.any()).default({})
});

const BusinessBillingInfoSchema = z.object({
  businessId: z.string().uuid(),
  companyName: z.string().optional(),
  taxId: z.string().optional(),
  billingAddress: z.record(z.any()).default({}),
  shippingAddress: z.record(z.any()).default({}),
  poNumber: z.string().optional(),
  notes: z.string().optional()
});

export class InvoiceService {
  /**
   * Create an invoice
   */
  async createInvoice(invoiceData: z.infer<typeof InvoiceSchema>): Promise<any> {
    try {
      const invoice = await prisma.invoice.create({
        data: {
          businessId: invoiceData.businessId,
          stripeInvoiceId: invoiceData.stripeInvoiceId,
          invoiceNumber: invoiceData.invoiceNumber,
          status: invoiceData.status,
          amountCents: invoiceData.amountCents,
          amountPaidCents: invoiceData.amountPaidCents,
          taxCents: invoiceData.taxCents,
          discountCents: invoiceData.discountCents,
          currency: invoiceData.currency,
          dueDate: invoiceData.dueDate
        }
      });

      return invoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw new Error('Failed to create invoice');
    }
  }

  /**
   * Generate invoice from Stripe
   */
  async generateInvoiceFromStripe(businessId: string, periodStart: Date, periodEnd: Date): Promise<any> {
    try {
      // Get business subscription
      const subscription = await prisma.subscription.findFirst({
        where: {
          businessId,
          status: 'active'
        }
      });

      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new Error('No active subscription found');
      }

      // Get Stripe invoice
      const stripeInvoices = await stripe.invoices.list({
        subscription: subscription.stripeSubscriptionId,
        created: {
          gte: Math.floor(periodStart.getTime() / 1000),
          lte: Math.floor(periodEnd.getTime() / 1000)
        },
        limit: 1
      });

      if (stripeInvoices.data.length === 0) {
        throw new Error('No Stripe invoice found for period');
      }

      const stripeInvoice = stripeInvoices.data[0];

      // Create invoice record
      const invoice = await this.createInvoice({
        businessId,
        stripeInvoiceId: stripeInvoice.id,
        invoiceNumber: stripeInvoice.number || `INV-${Date.now()}`,
        status: stripeInvoice.status as any,
        amountCents: stripeInvoice.amount_due,
        amountPaidCents: stripeInvoice.amount_paid,
        taxCents: stripeInvoice.tax || 0,
        discountCents: stripeInvoice.discount?.amount_off || 0,
        currency: stripeInvoice.currency,
        dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : undefined
      });

      // Create line items
      await this.createInvoiceLineItems(invoice.id, stripeInvoice.lines.data);

      return invoice;
    } catch (error) {
      console.error('Error generating invoice from Stripe:', error);
      throw new Error('Failed to generate invoice from Stripe');
    }
  }

  /**
   * Create invoice line items
   */
  async createInvoiceLineItems(invoiceId: string, stripeLineItems: any[]): Promise<any[]> {
    try {
      const lineItems = stripeLineItems.map(item => ({
        invoiceId,
        description: item.description || 'Subscription',
        quantity: item.quantity || 1,
        unitPriceCents: item.price?.unit_amount || 0,
        totalCents: item.amount,
        lineType: this.getLineTypeFromStripeItem(item),
        metadata: {
          stripe_line_item_id: item.id,
          stripe_price_id: item.price?.id
        }
      }));

      const createdLineItems = await prisma.invoiceLineItem.createMany({
        data: lineItems
      });

      return createdLineItems;
    } catch (error) {
      console.error('Error creating invoice line items:', error);
      throw new Error('Failed to create invoice line items');
    }
  }

  /**
   * Get invoices for a business
   */
  async getBusinessInvoices(
    businessId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const invoices = await prisma.invoice.findMany({
        where: { businessId },
        include: {
          invoiceLineItems: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      return invoices;
    } catch (error) {
      console.error('Error getting business invoices:', error);
      throw new Error('Failed to get business invoices');
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<any> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          invoiceLineItems: true,
          business: {
            select: {
              id: true,
              name: true,
              businessBillingInfo: true
            }
          }
        }
      });

      return invoice;
    } catch (error) {
      console.error('Error getting invoice by ID:', error);
      throw new Error('Failed to get invoice by ID');
    }
  }

  /**
   * Get invoice download URL from Stripe
   */
  async getInvoiceDownloadUrl(invoiceId: string): Promise<string> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice || !invoice.stripeInvoiceId) {
        throw new Error('Invoice not found or no Stripe invoice ID');
      }

      const stripeInvoice = await stripe.invoices.retrieve(invoice.stripeInvoiceId);
      
      if (!stripeInvoice.invoice_pdf) {
        throw new Error('PDF not available for this invoice');
      }

      return stripeInvoice.invoice_pdf;
    } catch (error) {
      console.error('Error getting invoice download URL:', error);
      throw new Error('Failed to get invoice download URL');
    }
  }

  /**
   * Update business billing information
   */
  async updateBusinessBillingInfo(
    businessId: string,
    billingInfo: z.infer<typeof BusinessBillingInfoSchema>
  ): Promise<any> {
    try {
      const billingInfoRecord = await prisma.businessBillingInfo.upsert({
        where: { businessId },
        update: {
          companyName: billingInfo.companyName,
          taxId: billingInfo.taxId,
          billingAddress: billingInfo.billingAddress,
          shippingAddress: billingInfo.shippingAddress,
          poNumber: billingInfo.poNumber,
          notes: billingInfo.notes,
          updatedAt: new Date()
        },
        create: {
          businessId: billingInfo.businessId,
          companyName: billingInfo.companyName,
          taxId: billingInfo.taxId,
          billingAddress: billingInfo.billingAddress,
          shippingAddress: billingInfo.shippingAddress,
          poNumber: billingInfo.poNumber,
          notes: billingInfo.notes
        }
      });

      return billingInfoRecord;
    } catch (error) {
      console.error('Error updating business billing info:', error);
      throw new Error('Failed to update business billing info');
    }
  }

  /**
   * Get business billing information
   */
  async getBusinessBillingInfo(businessId: string): Promise<any> {
    try {
      const billingInfo = await prisma.businessBillingInfo.findUnique({
        where: { businessId }
      });

      return billingInfo;
    } catch (error) {
      console.error('Error getting business billing info:', error);
      throw new Error('Failed to get business billing info');
    }
  }

  /**
   * Create billing snapshot
   */
  async createBillingSnapshot(
    businessId: string,
    snapshotDate: Date,
    totalSpendCents: number,
    breakdown: {
      subscriptionCostCents?: number;
      usageCostCents?: number;
      addonCostCents?: number;
      taxCents?: number;
      discountCents?: number;
      referralCreditsCents?: number;
      annualSavingsCents?: number;
    }
  ): Promise<any> {
    try {
      const snapshot = await prisma.billingSnapshot.upsert({
        where: {
          business_id_snapshot_date: {
            businessId,
            snapshotDate
          }
        },
        update: {
          totalSpendCents,
          subscriptionCostCents: breakdown.subscriptionCostCents || 0,
          usageCostCents: breakdown.usageCostCents || 0,
          addonCostCents: breakdown.addonCostCents || 0,
          taxCents: breakdown.taxCents || 0,
          discountCents: breakdown.discountCents || 0,
          referralCreditsCents: breakdown.referralCreditsCents || 0,
          annualSavingsCents: breakdown.annualSavingsCents || 0
        },
        create: {
          businessId,
          snapshotDate,
          totalSpendCents,
          subscriptionCostCents: breakdown.subscriptionCostCents || 0,
          usageCostCents: breakdown.usageCostCents || 0,
          addonCostCents: breakdown.addonCostCents || 0,
          taxCents: breakdown.taxCents || 0,
          discountCents: breakdown.discountCents || 0,
          referralCreditsCents: breakdown.referralCreditsCents || 0,
          annualSavingsCents: breakdown.annualSavingsCents || 0
        }
      });

      return snapshot;
    } catch (error) {
      console.error('Error creating billing snapshot:', error);
      throw new Error('Failed to create billing snapshot');
    }
  }

  /**
   * Get billing insights for a business
   */
  async getBillingInsights(businessId: string, monthsBack: number = 12): Promise<any[]> {
    try {
      const insights = await prisma.$queryRaw`
        SELECT 
          bs.snapshot_date as month_date,
          bs.total_spend_cents,
          bs.subscription_cost_cents,
          bs.usage_cost_cents,
          bs.addon_cost_cents,
          bs.tax_cents,
          bs.discount_cents,
          bs.referral_credits_cents,
          bs.annual_savings_cents
        FROM billing_snapshots bs
        WHERE bs.business_id = $1
          AND bs.snapshot_date >= CURRENT_DATE - INTERVAL '1 month' * $2
        ORDER BY bs.snapshot_date DESC
      `;

      return insights;
    } catch (error) {
      console.error('Error getting billing insights:', error);
      throw new Error('Failed to get billing insights');
    }
  }

  /**
   * Create billing alert
   */
  async createBillingAlert(
    businessId: string,
    alertType: string,
    alertData: Record<string, any>,
    severity: string = 'medium'
  ): Promise<any> {
    try {
      const alert = await prisma.billingAlert.create({
        data: {
          businessId,
          alertType,
          alertData,
          severity
        }
      });

      return alert;
    } catch (error) {
      console.error('Error creating billing alert:', error);
      throw new Error('Failed to create billing alert');
    }
  }

  /**
   * Get billing alerts for a business
   */
  async getBillingAlerts(businessId: string, unreadOnly: boolean = false): Promise<any[]> {
    try {
      const whereClause: any = { businessId };
      
      if (unreadOnly) {
        whereClause.isRead = false;
      }

      const alerts = await prisma.billingAlert.findMany({
        where: whereClause,
        orderBy: { triggeredAt: 'desc' }
      });

      return alerts;
    } catch (error) {
      console.error('Error getting billing alerts:', error);
      throw new Error('Failed to get billing alerts');
    }
  }

  /**
   * Mark billing alert as read
   */
  async markBillingAlertAsRead(alertId: string): Promise<any> {
    try {
      const alert = await prisma.billingAlert.update({
        where: { id: alertId },
        data: { isRead: true }
      });

      return alert;
    } catch (error) {
      console.error('Error marking billing alert as read:', error);
      throw new Error('Failed to mark billing alert as read');
    }
  }

  /**
   * Get invoice analytics
   */
  async getInvoiceAnalytics(): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_invoices,
          COUNT(CASE WHEN status = 'void' THEN 1 END) as void_invoices,
          COALESCE(SUM(amount_cents), 0) as total_amount_cents,
          COALESCE(SUM(amount_paid_cents), 0) as total_paid_cents,
          COALESCE(AVG(amount_cents), 0) as average_invoice_amount_cents,
          ROUND(
            COUNT(CASE WHEN status = 'paid' THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as payment_rate_percentage
        FROM invoices
        WHERE created_at >= NOW() - INTERVAL '12 months'
      `;

      return analytics[0];
    } catch (error) {
      console.error('Error getting invoice analytics:', error);
      throw new Error('Failed to get invoice analytics');
    }
  }

  /**
   * Get line type from Stripe line item
   */
  private getLineTypeFromStripeItem(item: any): string {
    if (item.price?.metadata?.add_on_id) {
      return 'addon';
    }
    
    if (item.price?.metadata?.usage_type) {
      return 'usage';
    }
    
    if (item.discount) {
      return 'discount';
    }
    
    if (item.tax_amounts && item.tax_amounts.length > 0) {
      return 'tax';
    }
    
    return 'subscription';
  }

  /**
   * Process monthly billing snapshots
   */
  async processMonthlyBillingSnapshots(): Promise<void> {
    try {
      const activeBusinesses = await prisma.business.findMany({
        where: {
          subscriptions: {
            some: { status: 'active' }
          }
        }
      });

      for (const business of activeBusinesses) {
        try {
          await this.generateMonthlyBillingSnapshot(business.id);
        } catch (error) {
          console.error(`Error processing billing snapshot for business ${business.id}:`, error);
          // Continue with other businesses
        }
      }
    } catch (error) {
      console.error('Error processing monthly billing snapshots:', error);
      throw new Error('Failed to process monthly billing snapshots');
    }
  }

  /**
   * Generate monthly billing snapshot for a business
   */
  private async generateMonthlyBillingSnapshot(businessId: string): Promise<void> {
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const snapshotDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1);

      // Get subscription costs
      const subscription = await prisma.subscription.findFirst({
        where: { businessId, status: 'active' },
        include: { planDefinition: true }
      });

      const subscriptionCostCents = subscription?.planDefinition.priceCents || 0;

      // Get usage costs
      const usageCosts = await prisma.usageEvent.aggregate({
        where: {
          businessId,
          createdAt: {
            gte: new Date(snapshotDate.getFullYear(), snapshotDate.getMonth() - 1, 1),
            lt: snapshotDate
          }
        },
        _sum: { totalCostCents: true }
      });

      const usageCostCents = usageCosts._sum.totalCostCents || 0;

      // Get add-on costs
      const addOnCosts = await prisma.businessAddOn.aggregate({
        where: {
          businessId,
          status: 'active',
          startedAt: {
            gte: new Date(snapshotDate.getFullYear(), snapshotDate.getMonth() - 1, 1),
            lt: snapshotDate
          }
        },
        _sum: { priceCents: true }
      });

      const addonCostCents = addOnCosts._sum.priceCents || 0;

      // Calculate total spend
      const totalSpendCents = subscriptionCostCents + usageCostCents + addonCostCents;

      // Create billing snapshot
      await this.createBillingSnapshot(businessId, snapshotDate, totalSpendCents, {
        subscriptionCostCents,
        usageCostCents,
        addonCostCents
      });
    } catch (error) {
      console.error('Error generating monthly billing snapshot:', error);
      throw new Error('Failed to generate monthly billing snapshot');
    }
  }
}

export const invoiceService = new InvoiceService();
