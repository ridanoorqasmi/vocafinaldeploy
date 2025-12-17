import { NextRequest, NextResponse } from 'next/server';
import { growthRetentionService } from '@/lib/services/growth-retention-service';
import { z } from 'zod';

// Validation schemas
const InitializeBusinessSchema = z.object({
  businessId: z.string().uuid()
});

const TrackActivationEventSchema = z.object({
  businessId: z.string().uuid(),
  eventType: z.string(),
  eventData: z.record(z.any()).optional()
});

const UpdateCampaignSettingSchema = z.object({
  key: z.string(),
  value: z.any()
});

/**
 * GET /api/v1/growth-retention/dashboard
 * Get comprehensive growth and retention dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    const dashboardData = await growthRetentionService.getDashboardData(businessId);

    return NextResponse.json({ dashboardData });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to get dashboard data' },
      { status: 500 }
    );
  }
}

