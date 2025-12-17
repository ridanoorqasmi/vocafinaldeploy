import { NextRequest, NextResponse } from 'next/server';
import { upgradeRecommendationService } from '@/lib/services/upgrade-recommendation-service';
import { z } from 'zod';

// Validation schemas
const AnalyzeUsageSchema = z.object({
  businessId: z.string().uuid()
});

const MarkShownSchema = z.object({
  recommendationId: z.string().uuid()
});

const DismissSchema = z.object({
  recommendationId: z.string().uuid()
});

const AcceptSchema = z.object({
  recommendationId: z.string().uuid()
});

/**
 * GET /api/v1/growth-retention/upgrades
 * Get upgrade recommendations for a business
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

    const recommendations = await upgradeRecommendationService.getRecommendations(businessId);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Error getting upgrade recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to get upgrade recommendations' },
      { status: 500 }
    );
  }
}

