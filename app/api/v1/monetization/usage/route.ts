import { NextRequest, NextResponse } from 'next/server';
import { usageBillingService } from '@/lib/services/usage-billing-service';
import { z } from 'zod';

// Validation schemas
const RecordUsageEventSchema = z.object({
  businessId: z.string().uuid(),
  eventType: z.enum(['api_call', 'voice_minute', 'storage_mb', 'ai_query']),
  quantity: z.number().min(0),
  unitPriceCents: z.number().min(0),
  metadata: z.record(z.any()).default({})
});

const GetUsageEventsSchema = z.object({
  businessId: z.string().uuid(),
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  eventType: z.string().optional(),
  limit: z.string().transform(str => parseInt(str)).default('100')
});

const GetUsageAnalyticsSchema = z.object({
  businessId: z.string().uuid(),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str))
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = RecordUsageEventSchema.parse(body);

    const usageEvent = await usageBillingService.recordUsageEvent(validatedData);

    return NextResponse.json({
      success: true,
      data: usageEvent
    });
  } catch (error) {
    console.error('Error recording usage event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record usage event' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = searchParams.get('eventType');
    const limit = searchParams.get('limit') || '100';

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'Business ID is required' },
        { status: 400 }
      );
    }

    const validatedData = GetUsageEventsSchema.parse({
      businessId,
      startDate,
      endDate,
      eventType,
      limit
    });

    const usageEvents = await usageBillingService.getUsageEvents(
      validatedData.businessId,
      validatedData.startDate,
      validatedData.endDate,
      validatedData.eventType,
      validatedData.limit
    );

    return NextResponse.json({
      success: true,
      data: usageEvents
    });
  } catch (error) {
    console.error('Error getting usage events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get usage events' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'process_pending') {
      await usageBillingService.processPendingUsageEvents();
      return NextResponse.json({
        success: true,
        message: 'Pending usage events processed'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing usage events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process usage events' },
      { status: 500 }
    );
  }
}
