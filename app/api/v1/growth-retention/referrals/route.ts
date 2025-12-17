import { NextRequest, NextResponse } from 'next/server';
import { referralService } from '@/lib/services/referral-service';
import { z } from 'zod';

// Validation schemas
const CreateReferralLinkSchema = z.object({
  businessId: z.string().uuid()
});

const TrackReferralSchema = z.object({
  referralCode: z.string(),
  referredBusinessId: z.string().uuid()
});

const ProcessCreditSchema = z.object({
  referralId: z.string().uuid()
});

/**
 * GET /api/v1/growth-retention/referrals
 * Get referral statistics for a business
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

    const stats = await referralService.getReferralStats(businessId);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error getting referral stats:', error);
    return NextResponse.json(
      { error: 'Failed to get referral stats' },
      { status: 500 }
    );
  }
}

