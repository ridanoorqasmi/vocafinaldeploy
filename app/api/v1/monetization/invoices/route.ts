import { NextRequest, NextResponse } from 'next/server';
import { invoiceService } from '@/lib/services/invoice-service';
import { z } from 'zod';

// Validation schemas
const CreateInvoiceSchema = z.object({
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

const GenerateInvoiceSchema = z.object({
  businessId: z.string().uuid(),
  periodStart: z.string().transform(str => new Date(str)),
  periodEnd: z.string().transform(str => new Date(str))
});

const UpdateBillingInfoSchema = z.object({
  businessId: z.string().uuid(),
  companyName: z.string().optional(),
  taxId: z.string().optional(),
  billingAddress: z.record(z.any()).default({}),
  shippingAddress: z.record(z.any()).default({}),
  poNumber: z.string().optional(),
  notes: z.string().optional()
});

const CreateBillingAlertSchema = z.object({
  businessId: z.string().uuid(),
  alertType: z.string(),
  alertData: z.record(z.any()),
  severity: z.string().default('medium')
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const invoiceId = searchParams.get('invoiceId');
    const type = searchParams.get('type');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    if (type === 'business' && businessId) {
      const invoices = await invoiceService.getBusinessInvoices(
        businessId,
        parseInt(limit),
        parseInt(offset)
      );
      return NextResponse.json({
        success: true,
        data: invoices
      });
    }

    if (type === 'single' && invoiceId) {
      const invoice = await invoiceService.getInvoiceById(invoiceId);
      return NextResponse.json({
        success: true,
        data: invoice
      });
    }

    if (type === 'download_url' && invoiceId) {
      const downloadUrl = await invoiceService.getInvoiceDownloadUrl(invoiceId);
      return NextResponse.json({
        success: true,
        data: { downloadUrl }
      });
    }

    if (type === 'billing_info' && businessId) {
      const billingInfo = await invoiceService.getBusinessBillingInfo(businessId);
      return NextResponse.json({
        success: true,
        data: billingInfo
      });
    }

    if (type === 'insights' && businessId) {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const monthsBack = parseInt(searchParams.get('monthsBack') || '12');

      if (startDate && endDate) {
        const insights = await invoiceService.getBillingInsights(
          businessId,
          new Date(startDate),
          new Date(endDate)
        );
        return NextResponse.json({
          success: true,
          data: insights
        });
      } else {
        const insights = await invoiceService.getBillingInsights(businessId, monthsBack);
        return NextResponse.json({
          success: true,
          data: insights
        });
      }
    }

    if (type === 'alerts' && businessId) {
      const unreadOnly = searchParams.get('unreadOnly') === 'true';
      const alerts = await invoiceService.getBillingAlerts(businessId, unreadOnly);
      return NextResponse.json({
        success: true,
        data: alerts
      });
    }

    if (type === 'analytics') {
      const analytics = await invoiceService.getInvoiceAnalytics();
      return NextResponse.json({
        success: true,
        data: analytics
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error getting invoices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const validatedData = CreateInvoiceSchema.parse(body);
      const invoice = await invoiceService.createInvoice(validatedData);
      
      return NextResponse.json({
        success: true,
        data: invoice
      });
    }

    if (action === 'generate_from_stripe') {
      const validatedData = GenerateInvoiceSchema.parse(body);
      const invoice = await invoiceService.generateInvoiceFromStripe(
        validatedData.businessId,
        validatedData.periodStart,
        validatedData.periodEnd
      );
      
      return NextResponse.json({
        success: true,
        data: invoice
      });
    }

    if (action === 'update_billing_info') {
      const validatedData = UpdateBillingInfoSchema.parse(body);
      const billingInfo = await invoiceService.updateBusinessBillingInfo(
        validatedData.businessId,
        validatedData
      );
      
      return NextResponse.json({
        success: true,
        data: billingInfo
      });
    }

    if (action === 'create_alert') {
      const validatedData = CreateBillingAlertSchema.parse(body);
      const alert = await invoiceService.createBillingAlert(
        validatedData.businessId,
        validatedData.alertType,
        validatedData.alertData,
        validatedData.severity
      );
      
      return NextResponse.json({
        success: true,
        data: alert
      });
    }

    if (action === 'create_snapshot') {
      const { businessId, snapshotDate, totalSpendCents, breakdown } = body;
      const snapshot = await invoiceService.createBillingSnapshot(
        businessId,
        new Date(snapshotDate),
        totalSpendCents,
        breakdown
      );
      
      return NextResponse.json({
        success: true,
        data: snapshot
      });
    }

    if (action === 'process_monthly_snapshots') {
      await invoiceService.processMonthlyBillingSnapshots();
      return NextResponse.json({
        success: true,
        message: 'Monthly billing snapshots processed'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing invoice request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process invoice request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId } = body;

    if (action === 'mark_alert_read' && alertId) {
      const alert = await invoiceService.markBillingAlertAsRead(alertId);
      
      return NextResponse.json({
        success: true,
        data: alert
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}
