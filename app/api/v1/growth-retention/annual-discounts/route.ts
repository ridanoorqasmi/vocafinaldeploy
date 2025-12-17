import { NextRequest, NextResponse } from 'next/server';
import { annualDiscountService } from '@/lib/services/annual-discount-service';
import { z } from 'zod';

// Validation schemas
const CreateCampaignSchema = z.object({
  campaignName: z.string(),
  discountPercentage: z.number().min(0).max(100),
  discountAmountCents: z.number().min(0).default(0),
  minimumPlanPriceCents: z.number().min(0).default(0),
  maximumDiscountCents: z.number().min(0).default(0),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  isActive: z.boolean().default(true),
  targetPlans: z.array(z.string()).default([])
});

const CheckEligibilitySchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid()
});

const CalculateSavingsSchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid()
});

const ProcessUpgradeSchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid(),
  stripeSubscriptionId: z.string().optional()
});

const CreateOfferSchema = z.object({
  businessId: z.string().uuid(),
  campaignId: z.string().uuid(),
  currentPlanId: z.string(),
  offerMessage: z.string(),
  discountPercentage: z.number().min(0).max(100),
  savingsAmountCents: z.number().min(0)
});

/**
 * GET /api/v1/growth-retention/annual-discounts
 * Get active annual discount campaigns
 */
export async function GET(request: NextRequest) {
  try {
    const campaigns = await annualDiscountService.getActiveCampaigns();

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Error getting active campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to get active campaigns' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/growth-retention/annual-discounts
 * Create a new annual discount campaign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignData = CreateCampaignSchema.parse(body);

    const campaign = await annualDiscountService.createCampaign(campaignData);

    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}


