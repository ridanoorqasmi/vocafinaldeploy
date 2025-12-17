import { NextRequest, NextResponse } from 'next/server';
import { customPlanService } from '@/lib/services/custom-plan-service';
import { z } from 'zod';

// Validation schemas
const CreateCustomPlanSchema = z.object({
  businessId: z.string().uuid(),
  planName: z.string().min(1).max(100),
  basePriceCents: z.number().min(0),
  billingPeriod: z.enum(['monthly', 'yearly']),
  limits: z.record(z.any()),
  discounts: z.record(z.any()).default({}),
  features: z.record(z.any()).default({}),
  status: z.enum(['active', 'inactive', 'expired']).default('active'),
  createdBy: z.string().uuid()
});

const UpdateCustomPlanSchema = z.object({
  planName: z.string().min(1).max(100).optional(),
  basePriceCents: z.number().min(0).optional(),
  billingPeriod: z.enum(['monthly', 'yearly']).optional(),
  limits: z.record(z.any()).optional(),
  discounts: z.record(z.any()).optional(),
  features: z.record(z.any()).optional(),
  status: z.enum(['active', 'inactive', 'expired']).optional()
});

const UpdateUsageSchema = z.object({
  customPlanId: z.string().uuid(),
  eventType: z.string(),
  additionalUsage: z.number().min(0)
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const customPlanId = searchParams.get('customPlanId');
    const type = searchParams.get('type');

    if (type === 'business' && businessId) {
      const customPlan = await customPlanService.getCustomPlan(businessId);
      return NextResponse.json({
        success: true,
        data: customPlan
      });
    }

    if (type === 'all') {
      const customPlans = await customPlanService.getAllCustomPlans();
      return NextResponse.json({
        success: true,
        data: customPlans
      });
    }

    if (type === 'billing_info' && businessId) {
      const billingInfo = await customPlanService.getCustomPlanBillingInfo(businessId);
      return NextResponse.json({
        success: true,
        data: billingInfo
      });
    }

    if (type === 'usage_analytics' && customPlanId) {
      const analytics = await customPlanService.getCustomPlanUsageAnalytics(customPlanId);
      return NextResponse.json({
        success: true,
        data: analytics
      });
    }

    if (type === 'should_use' && businessId) {
      const shouldUse = await customPlanService.shouldUseCustomPlan(businessId);
      return NextResponse.json({
        success: true,
        data: { shouldUse }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error getting custom plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get custom plans' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const validatedData = CreateCustomPlanSchema.parse(body);
      const customPlan = await customPlanService.createCustomPlan(validatedData);
      
      return NextResponse.json({
        success: true,
        data: customPlan
      });
    }

    if (action === 'update_usage') {
      const validatedData = UpdateUsageSchema.parse(body);
      const result = await customPlanService.updateCustomPlanUsage(
        validatedData.customPlanId,
        validatedData.eventType,
        validatedData.additionalUsage
      );
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    if (action === 'reset_usage') {
      const { customPlanId } = body;
      await customPlanService.resetCustomPlanUsage(customPlanId);
      
      return NextResponse.json({
        success: true,
        message: 'Custom plan usage reset successfully'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing custom plan request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process custom plan request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, customPlanId } = body;

    if (action === 'update' && customPlanId) {
      const validatedData = UpdateCustomPlanSchema.parse(body);
      const result = await customPlanService.updateCustomPlan(customPlanId, validatedData);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    if (action === 'deactivate' && customPlanId) {
      const result = await customPlanService.deactivateCustomPlan(customPlanId);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating custom plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update custom plan' },
      { status: 500 }
    );
  }
}
