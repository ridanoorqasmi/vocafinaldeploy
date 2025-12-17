/**
 * Phase 4B: Plan Management API
 * GET /api/v1/billing/plans - Available Plans Comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlanManagementService } from '@/lib/plan-management-service';
import { authenticateToken } from '@/lib/next-auth-middleware';

export async function GET(request: NextRequest) {
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

    const planManagement = new PlanManagementService();

    // Get available plans
    const availablePlans = await planManagement.getAvailablePlans();

    // Get current business plan
    const { current_plan, usage_quotas, feature_flags } = await planManagement.getBusinessPlan(businessId);

    // Calculate usage vs limits for current plan
    const usageVsLimits = usage_quotas.map(quota => ({
      quota_type: quota.quota_type,
      used: quota.quota_used,
      limit: quota.quota_limit,
      percentage: Math.round((quota.quota_used / quota.quota_limit) * 100),
      overage: quota.quota_overage
    }));

    // Generate plan recommendations
    const recommendations = await generatePlanRecommendations(businessId, current_plan.id, usage_quotas);

    // Format available plans with comparison data
    const availablePlansWithComparison = availablePlans.map(plan => {
      const isCurrentPlan = plan.id === current_plan.id;
      const isUpgrade = isUpgradePath(current_plan.id, plan.id);
      const isDowngrade = isDowngradePath(current_plan.id, plan.id);

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price_cents: plan.price_cents,
        currency: plan.currency,
        billing_interval: plan.billing_interval,
        trial_days: plan.trial_days,
        features: plan.features,
        is_current_plan: isCurrentPlan,
        is_upgrade: isUpgrade,
        is_downgrade: isDowngrade,
        recommended: recommendations.some(r => r.recommended_plan_id === plan.id),
        savings_potential: isUpgrade ? calculateSavingsPotential(current_plan, plan, usage_quotas) : 0,
        upgrade_cost: isUpgrade ? calculateUpgradeCost(current_plan, plan) : 0,
        comparison_vs_current: generateFeatureComparison(current_plan, plan)
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        current_plan: {
          id: current_plan.id,
          name: current_plan.name,
          price_cents: current_plan.price_cents,
          features: current_plan.features,
          usage_vs_limits: usageVsLimits
        },
        available_plans: availablePlansWithComparison,
        recommendations: recommendations,
        custom_enterprise: {
          available: true,
          contact_required: true,
          estimated_pricing_range: 'Contact sales for custom pricing'
        }
      }
    });

  } catch (error) {
    console.error('Plans comparison error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch plans comparison',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions

async function generatePlanRecommendations(
  businessId: string,
  currentPlanId: string,
  usageQuotas: any[]
): Promise<Array<{
  recommended_plan_id: string;
  confidence_score: number;
  savings_potential: number;
  upgrade_cost: number;
  reasoning: string[];
}>> {
  const recommendations = [];

  // Check if business is approaching limits
  const approachingLimits = usageQuotas.some(quota => 
    (quota.quota_used / quota.quota_limit) > 0.8
  );

  // Check if business has high overage costs
  const totalOverageCost = usageQuotas.reduce((sum, quota) => 
    sum + (quota.quota_overage * quota.overage_rate_cents), 0
  );

  if (approachingLimits || totalOverageCost > 0) {
    const upgradePath = getUpgradePath(currentPlanId);
    if (upgradePath) {
      recommendations.push({
        recommended_plan_id: upgradePath,
        confidence_score: 0.85,
        savings_potential: totalOverageCost,
        upgrade_cost: 0, // Would calculate actual upgrade cost
        reasoning: [
          'You\'re approaching your usage limits',
          'Upgrading could reduce overage charges',
          'Better value for your usage patterns'
        ]
      });
    }
  }

  return recommendations;
}

function isUpgradePath(currentPlanId: string, targetPlanId: string): boolean {
  const upgradeOrder = ['free', 'starter', 'pro', 'business', 'enterprise'];
  const currentIndex = upgradeOrder.indexOf(currentPlanId);
  const targetIndex = upgradeOrder.indexOf(targetPlanId);
  return targetIndex > currentIndex;
}

function isDowngradePath(currentPlanId: string, targetPlanId: string): boolean {
  const upgradeOrder = ['free', 'starter', 'pro', 'business', 'enterprise'];
  const currentIndex = upgradeOrder.indexOf(currentPlanId);
  const targetIndex = upgradeOrder.indexOf(targetPlanId);
  return targetIndex < currentIndex;
}

function calculateSavingsPotential(
  currentPlan: any,
  targetPlan: any,
  usageQuotas: any[]
): number {
  // Calculate potential savings from reduced overage charges
  const currentOverageCost = usageQuotas.reduce((sum, quota) => 
    sum + (quota.quota_overage * quota.overage_rate_cents), 0
  );
  
  // Estimate savings based on higher limits in target plan
  const estimatedSavings = currentOverageCost * 0.7; // Assume 70% reduction in overages
  
  return Math.max(0, estimatedSavings);
}

function calculateUpgradeCost(currentPlan: any, targetPlan: any): number {
  // Calculate proration cost for immediate upgrade
  const priceDifference = targetPlan.price_cents - currentPlan.price_cents;
  return Math.max(0, priceDifference);
}

function generateFeatureComparison(currentPlan: any, targetPlan: any): Array<{
  feature: string;
  current_value: any;
  target_value: any;
  improvement: string;
}> {
  const comparisons = [];

  // Compare features
  for (const targetFeature of targetPlan.features) {
    const currentFeature = currentPlan.features.find(
      (f: any) => f.feature_key === targetFeature.feature_key
    );

    if (currentFeature) {
      let improvement = 'same';
      if (targetFeature.limit_value && currentFeature.limit_value) {
        if (targetFeature.limit_value > currentFeature.limit_value) {
          improvement = 'increased';
        } else if (targetFeature.limit_value < currentFeature.limit_value) {
          improvement = 'decreased';
        }
      } else if (targetFeature.boolean_value !== currentFeature.boolean_value) {
        improvement = targetFeature.boolean_value ? 'enabled' : 'disabled';
      }

      comparisons.push({
        feature: targetFeature.feature_key,
        current_value: currentFeature.limit_value || currentFeature.boolean_value,
        target_value: targetFeature.limit_value || targetFeature.boolean_value,
        improvement
      });
    } else {
      comparisons.push({
        feature: targetFeature.feature_key,
        current_value: null,
        target_value: targetFeature.limit_value || targetFeature.boolean_value,
        improvement: 'new'
      });
    }
  }

  return comparisons;
}

function getUpgradePath(currentPlanId: string): string | null {
  const upgradePaths = {
    'free': 'starter',
    'starter': 'pro',
    'pro': 'business',
    'business': 'enterprise'
  };
  return upgradePaths[currentPlanId] || null;
}
