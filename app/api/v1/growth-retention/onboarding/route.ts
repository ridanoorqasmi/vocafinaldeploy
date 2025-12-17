import { NextRequest, NextResponse } from 'next/server';
import { onboardingService } from '@/lib/services/onboarding-service';
import { z } from 'zod';

// Validation schemas
const InitializeOnboardingSchema = z.object({
  businessId: z.string().uuid()
});

const UpdateProgressSchema = z.object({
  businessId: z.string().uuid(),
  stepKey: z.string(),
  activationEvents: z.record(z.any()).optional()
});

const CreateNudgeSchema = z.object({
  businessId: z.string().uuid(),
  nudgeType: z.enum(['tooltip', 'banner', 'email', 'in_app']),
  nudgeContent: z.object({
    title: z.string(),
    message: z.string(),
    cta: z.string().optional()
  }),
  targetStep: z.string(),
  triggerCondition: z.record(z.any()).optional()
});

/**
 * GET /api/v1/growth-retention/onboarding
 * Get onboarding progress for a business
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

    const progress = await onboardingService.getOnboardingProgress(businessId);

    if (!progress) {
      return NextResponse.json(
        { error: 'Onboarding progress not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Error getting onboarding progress:', error);
    return NextResponse.json(
      { error: 'Failed to get onboarding progress' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/growth-retention/onboarding
 * Initialize onboarding for a new business
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId } = InitializeOnboardingSchema.parse(body);

    const result = await onboardingService.initializeOnboarding(businessId);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error initializing onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to initialize onboarding' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/growth-retention/onboarding
 * Update onboarding progress
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, stepKey, activationEvents } = UpdateProgressSchema.parse(body);

    const result = await onboardingService.updateOnboardingProgress(
      businessId,
      stepKey,
      activationEvents
    );

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error updating onboarding progress:', error);
    return NextResponse.json(
      { error: 'Failed to update onboarding progress' },
      { status: 500 }
    );
  }
}

