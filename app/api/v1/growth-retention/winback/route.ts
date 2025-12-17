import { NextRequest, NextResponse } from 'next/server';
import { winbackService } from '@/lib/services/winback-service';
import { z } from 'zod';

// Validation schemas
const CreateCampaignSchema = z.object({
  campaignName: z.string(),
  campaignType: z.enum(['email', 'dashboard', 'in_app']),
  triggerConditions: z.record(z.any()),
  incentiveType: z.enum(['discount', 'credit', 'free_months']),
  incentiveValue: z.record(z.any()),
  messageTemplate: z.string(),
  ctaText: z.string(),
  isActive: z.boolean().default(true)
});

const DetectChurnSchema = z.object({
  businessId: z.string().uuid(),
  churnReason: z.enum(['cancelled', 'payment_failed', 'inactive']).optional()
});

const ExecuteCampaignSchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid()
});

const RecordInteractionSchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid(),
  interactionType: z.enum(['email_sent', 'dashboard_shown', 'cta_clicked', 'offer_accepted', 'offer_declined']),
  interactionData: z.record(z.any()).optional(),
  incentiveOffered: z.record(z.any()),
  userResponse: z.enum(['accepted', 'dismissed', 'ignored']).optional()
});

const ProcessSuccessSchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid()
});

/**
 * GET /api/v1/growth-retention/winback
 * Get win-back campaigns
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (businessId) {
      // Get win-back interactions for a specific business
      const interactions = await winbackService.getBusinessWinbackInteractions(businessId);
      return NextResponse.json({ interactions });
    } else {
      // Get all active campaigns
      const campaigns = await winbackService.getActiveCampaigns();
      return NextResponse.json({ campaigns });
    }
  } catch (error) {
    console.error('Error getting win-back data:', error);
    return NextResponse.json(
      { error: 'Failed to get win-back data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/growth-retention/winback
 * Create a new win-back campaign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignData = CreateCampaignSchema.parse(body);

    const campaign = await winbackService.createCampaign(campaignData);

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Error creating win-back campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create win-back campaign' },
      { status: 500 }
    );
  }
}

