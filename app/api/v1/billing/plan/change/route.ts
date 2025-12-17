/**
 * Phase 4B: Plan Change API
 * POST /api/v1/billing/plan/change - Change Subscription Plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlanManagementService, PlanChangeRequest } from '@/lib/plan-management-service';
import { authenticateToken } from '@/lib/next-auth-middleware';
import { z } from 'zod';

const PlanChangeSchema = z.object({
  new_plan_id: z.string().min(1),
  change_timing: z.enum(['immediate', 'end_of_period']),
  confirm_charges: z.boolean(),
  reason: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate request and get business context
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const businessId = authResult.user.businessId;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = PlanChangeSchema.parse(body);

    const { new_plan_id, change_timing, confirm_charges, reason } = validatedData;

    // Get current subscription
    const planManagement = new PlanManagementService();
    const { current_plan } = await planManagement.getBusinessPlan(businessId);

    // Validate plan change
    const validationResult = await validatePlanChange(
      businessId,
      current_plan.id,
      new_plan_id,
      change_timing
    );

    if (!validationResult.valid) {
      return NextResponse.json(
        { 
          error: 'Plan change not allowed',
          details: validationResult.reason
        },
        { status: 400 }
      );
    }

    // Check if user confirmed charges for immediate changes
    if (change_timing === 'immediate' && !confirm_charges) {
      return NextResponse.json(
        { 
          error: 'Charge confirmation required for immediate plan changes',
          details: 'Please confirm the charges to proceed with immediate plan change'
        },
        { status: 400 }
      );
    }

    // Determine change type
    const changeType = determineChangeType(current_plan.id, new_plan_id);

    // Create plan change request
    const planChangeRequest: PlanChangeRequest = {
      business_id: businessId,
      from_plan_id: current_plan.id,
      to_plan_id: new_plan_id,
      change_type: changeType,
      change_timing,
      reason
    };

    // Process plan change
    const result = await planManagement.changePlan(planChangeRequest);

    // Log plan change event
    await logPlanChangeEvent(businessId, current_plan.id, new_plan_id, changeType);

    return NextResponse.json({
      success: true,
      data: {
        plan_change: {
          old_plan: {
            id: current_plan.id,
            name: current_plan.name,
            price_cents: current_plan.price_cents
          },
          new_plan: {
            id: new_plan_id,
            name: 'New Plan', // Would fetch actual plan name
            price_cents: 0 // Would fetch actual plan price
          },
          effective_date: result.effective_date.toISOString(),
          billing_impact: {
            proration_credit: result.proration_credit,
            proration_charge: result.proration_charge,
            net_charge_today: result.net_charge,
            new_monthly_amount: 0 // Would calculate new monthly amount
          }
        },
        immediate_changes: {
          new_limits: result.new_limits,
          new_features: result.new_features,
          removed_features: result.removed_features
        },
        next_steps: generateNextSteps(change_timing, result)
      }
    });

  } catch (error) {
    console.error('Plan change error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to process plan change',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions

async function validatePlanChange(
  businessId: string,
  currentPlanId: string,
  newPlanId: string,
  changeTiming: string
): Promise<{ valid: boolean; reason?: string }> {
  // Check if plan change is allowed
  if (currentPlanId === newPlanId) {
    return { valid: false, reason: 'Cannot change to the same plan' };
  }

  // Check if business has active subscription
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const subscription = await prisma.subscriptions.findFirst({
    where: { businessId, status: 'ACTIVE' }
  });

  if (!subscription) {
    return { valid: false, reason: 'No active subscription found' };
  }

  // Check for downgrade restrictions
  if (isDowngrade(currentPlanId, newPlanId)) {
    const usageQuotas = await prisma.usage_quotas.findMany({
      where: { business_id: businessId }
    });

    // Check if current usage exceeds target plan limits
    const targetPlan = await prisma.plan_definitions.findUnique({
      where: { id: newPlanId },
      include: { plan_features: true }
    });

    if (targetPlan) {
      for (const quota of usageQuotas) {
        const targetFeature = targetPlan.plan_features.find(
          f => f.feature_key === quota.quota_type && f.feature_type === 'limit'
        );

        if (targetFeature && targetFeature.limit_value !== -1 && 
            quota.quota_used > targetFeature.limit_value) {
          return { 
            valid: false, 
            reason: `Current usage (${quota.quota_used}) exceeds target plan limit (${targetFeature.limit_value}) for ${quota.quota_type}` 
          };
        }
      }
    }
  }

  return { valid: true };
}

function determineChangeType(currentPlanId: string, newPlanId: string): 'upgrade' | 'downgrade' | 'sidegrade' {
  const planOrder = ['free', 'starter', 'pro', 'business', 'enterprise'];
  const currentIndex = planOrder.indexOf(currentPlanId);
  const newIndex = planOrder.indexOf(newPlanId);

  if (newIndex > currentIndex) return 'upgrade';
  if (newIndex < currentIndex) return 'downgrade';
  return 'sidegrade';
}

function isDowngrade(currentPlanId: string, newPlanId: string): boolean {
  const planOrder = ['free', 'starter', 'pro', 'business', 'enterprise'];
  const currentIndex = planOrder.indexOf(currentPlanId);
  const newIndex = planOrder.indexOf(newPlanId);
  return newIndex < currentIndex;
}

async function logPlanChangeEvent(
  businessId: string,
  fromPlanId: string,
  toPlanId: string,
  changeType: string
): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  await prisma.plan_changes.create({
    data: {
      business_id: businessId,
      from_plan_id: fromPlanId,
      to_plan_id: toPlanId,
      change_type: changeType,
      change_timing: 'immediate',
      status: 'completed',
      reason: 'API request'
    }
  });
}

function generateNextSteps(changeTiming: string, result: any): string[] {
  const steps = [];

  if (changeTiming === 'immediate') {
    steps.push('Your plan has been changed immediately');
    steps.push('New limits and features are now active');
    steps.push('You will see the proration on your next invoice');
  } else {
    steps.push('Your plan change is scheduled for the end of your billing period');
    steps.push('Current plan features remain active until then');
    steps.push('You will receive a confirmation email');
  }

  if (result.new_features.length > 0) {
    steps.push(`New features available: ${result.new_features.join(', ')}`);
  }

  if (result.removed_features.length > 0) {
    steps.push(`Features that will be removed: ${result.removed_features.join(', ')}`);
  }

  return steps;
}
