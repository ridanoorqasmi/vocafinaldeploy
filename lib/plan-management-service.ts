/**
 * Phase 4B: Advanced Plan Management & Usage Enforcement
 * Comprehensive plan management service with real-time usage tracking and enforcement
 */

import { PrismaClient } from '@prisma/client';
import { StripeService } from './stripe-service';
import { BillingService } from './billing-service';

export interface PlanDefinition {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  billing_interval: 'month' | 'year';
  trial_days: number;
  stripe_price_id?: string;
  is_active: boolean;
  display_order: number;
  features: PlanFeature[];
}

export interface PlanFeature {
  feature_key: string;
  feature_type: 'limit' | 'boolean' | 'enum';
  limit_value?: number;
  boolean_value?: boolean;
  enum_value?: string;
  metadata?: Record<string, any>;
}

export interface UsageQuota {
  business_id: string;
  plan_id: string;
  quota_type: string;
  quota_limit: number;
  quota_used: number;
  quota_overage: number;
  reset_date: Date;
  overage_rate_cents: number;
}

export interface UsageEvent {
  business_id: string;
  event_type: 'query' | 'embedding' | 'api_call' | 'storage';
  quantity: number;
  tokens_consumed?: number;
  cost_cents?: number;
  metadata?: Record<string, any>;
}

export interface PlanChangeRequest {
  business_id: string;
  from_plan_id?: string;
  to_plan_id: string;
  change_type: 'upgrade' | 'downgrade' | 'sidegrade';
  change_timing: 'immediate' | 'end_of_period';
  reason?: string;
}

export interface PlanChangeResult {
  success: boolean;
  effective_date: Date;
  proration_credit: number;
  proration_charge: number;
  net_charge: number;
  new_limits: Record<string, number>;
  new_features: string[];
  removed_features: string[];
}

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  current_usage: {
    used: number;
    limit: number;
    remaining: number;
  };
  recommendations?: {
    upgrade_plan?: string;
    estimated_cost?: number;
    contact_sales?: boolean;
  };
  emergency_options?: {
    emergency_pool_available: boolean;
    pool_remaining: number;
    pool_cost_per_use: number;
  };
}

export interface UsageDashboard {
  current_period: {
    start_date: string;
    end_date: string;
    days_remaining: number;
  };
  usage_summary: {
    queries: {
      used: number;
      limit: number;
      percentage_used: number;
      overage: number;
      projected_month_end: number;
    };
    tokens: {
      used: number;
      limit: number;
      cost_current_period: number;
    };
    api_calls: {
      used: number;
      daily_limit: number;
      remaining_today: number;
    };
  };
  alerts: Array<{
    type: 'approaching_limit' | 'limit_exceeded';
    quota_type: string;
    message: string;
    action_required: boolean;
    recommended_action: string;
  }>;
  cost_projection: {
    estimated_monthly_cost: number;
    potential_overage_cost: number;
    recommended_plan?: string;
  };
}

export class PlanManagementService {
  private prisma: PrismaClient;
  private stripeService: StripeService;
  private billingService: BillingService;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    this.stripeService = new StripeService();
    this.billingService = new BillingService();
  }

  /**
   * Get all available plans with their features
   */
  async getAvailablePlans(): Promise<PlanDefinition[]> {
    const plans = await this.prisma.plan_definitions.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      include: {
        plan_features: true
      }
    });

    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price_cents: plan.price_cents,
      currency: plan.currency,
      billing_interval: plan.billing_interval as 'month' | 'year',
      trial_days: plan.trial_days,
      stripe_price_id: plan.stripe_price_id,
      is_active: plan.is_active,
      display_order: plan.display_order,
      features: plan.plan_features.map(feature => ({
        feature_key: feature.feature_key,
        feature_type: feature.feature_type as 'limit' | 'boolean' | 'enum',
        limit_value: feature.limit_value,
        boolean_value: feature.boolean_value,
        enum_value: feature.enum_value,
        metadata: feature.metadata as Record<string, any>
      }))
    }));
  }

  /**
   * Get current business plan and usage
   */
  async getBusinessPlan(businessId: string): Promise<{
    current_plan: PlanDefinition;
    usage_quotas: UsageQuota[];
    feature_flags: Record<string, boolean>;
  }> {
    // Get current subscription
    const subscription = await this.prisma.subscriptions.findFirst({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Get plan definition
    const plan = await this.prisma.plan_definitions.findUnique({
      where: { id: subscription.planId },
      include: { plan_features: true }
    });

    if (!plan) {
      throw new Error('Plan definition not found');
    }

    // Get usage quotas
    const usageQuotas = await this.prisma.usage_quotas.findMany({
      where: { business_id: businessId }
    });

    // Get feature flags
    const featureFlags = await this.prisma.feature_flags.findMany({
      where: { plan_id: plan.id }
    });

    const featureFlagsMap = featureFlags.reduce((acc, flag) => {
      acc[flag.feature_key] = flag.is_enabled;
      return acc;
    }, {} as Record<string, boolean>);

    return {
      current_plan: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price_cents: plan.price_cents,
        currency: plan.currency,
        billing_interval: plan.billing_interval as 'month' | 'year',
        trial_days: plan.trial_days,
        stripe_price_id: plan.stripe_price_id,
        is_active: plan.is_active,
        display_order: plan.display_order,
        features: plan.plan_features.map(feature => ({
          feature_key: feature.feature_key,
          feature_type: feature.feature_type as 'limit' | 'boolean' | 'enum',
          limit_value: feature.limit_value,
          boolean_value: feature.boolean_value,
          enum_value: feature.enum_value,
          metadata: feature.metadata as Record<string, any>
        }))
      },
      usage_quotas: usageQuotas.map(quota => ({
        business_id: quota.business_id,
        plan_id: quota.plan_id,
        quota_type: quota.quota_type,
        quota_limit: quota.quota_limit,
        quota_used: quota.quota_used,
        quota_overage: quota.quota_overage,
        reset_date: quota.reset_date,
        overage_rate_cents: quota.overage_rate_cents
      })),
      feature_flags: featureFlagsMap
    };
  }

  /**
   * Check if a business can perform a specific operation
   */
  async checkUsageLimit(
    businessId: string,
    operationType: 'query' | 'embedding' | 'api_call',
    estimatedTokens?: number,
    featureRequired?: string
  ): Promise<UsageCheckResult> {
    // Get current plan and quotas
    const { current_plan, usage_quotas, feature_flags } = await this.getBusinessPlan(businessId);

    // Check feature access if required
    if (featureRequired && !feature_flags[featureRequired]) {
      return {
        allowed: false,
        reason: `Feature '${featureRequired}' not available on ${current_plan.name} plan`,
        current_usage: { used: 0, limit: 0, remaining: 0 },
        recommendations: {
          upgrade_plan: this.getRecommendedUpgradePlan(current_plan.id),
          contact_sales: current_plan.id === 'enterprise'
        }
      };
    }

    // Find relevant quota
    const quotaType = this.getQuotaTypeForOperation(operationType);
    const quota = usage_quotas.find(q => q.quota_type === quotaType);

    if (!quota) {
      return {
        allowed: false,
        reason: `No quota found for operation type: ${operationType}`,
        current_usage: { used: 0, limit: 0, remaining: 0 }
      };
    }

    // Check if within limits
    const remaining = quota.quota_limit - quota.quota_used;
    const allowed = remaining > 0;

    // Check for emergency pool if at limit
    let emergencyOptions;
    if (!allowed) {
      const emergencyPool = await this.prisma.emergency_usage_pools.findFirst({
        where: {
          business_id: businessId,
          pool_type: quotaType,
          expires_at: { gt: new Date() }
        }
      });

      if (emergencyPool) {
        emergencyOptions = {
          emergency_pool_available: true,
          pool_remaining: emergencyPool.total_allocated - emergencyPool.used_amount,
          pool_cost_per_use: emergencyPool.cost_per_unit
        };
      }
    }

    return {
      allowed,
      reason: allowed ? undefined : `Usage limit exceeded for ${quotaType}`,
      current_usage: {
        used: quota.quota_used,
        limit: quota.quota_limit,
        remaining: Math.max(0, remaining)
      },
      recommendations: !allowed ? {
        upgrade_plan: this.getRecommendedUpgradePlan(current_plan.id),
        estimated_cost: this.calculateUpgradeCost(current_plan.id, this.getRecommendedUpgradePlan(current_plan.id)),
        contact_sales: current_plan.id === 'enterprise'
      } : undefined,
      emergency_options: emergencyOptions
    };
  }

  /**
   * Record usage event
   */
  async recordUsageEvent(event: UsageEvent): Promise<void> {
    // Record the event
    await this.prisma.usage_events.create({
      data: {
        business_id: event.business_id,
        event_type: event.event_type,
        quantity: event.quantity,
        tokens_consumed: event.tokens_consumed,
        cost_cents: event.cost_cents,
        metadata: event.metadata
      }
    });

    // Update usage quotas
    await this.updateUsageQuotas(event.business_id, event.event_type, event.quantity);

    // Check for alerts
    await this.checkUsageAlerts(event.business_id);
  }

  /**
   * Get usage dashboard for a business
   */
  async getUsageDashboard(businessId: string): Promise<UsageDashboard> {
    const { current_plan, usage_quotas } = await this.getBusinessPlan(businessId);
    
    // Get current period dates
    const subscription = await this.prisma.subscriptions.findFirst({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      throw new Error('No active subscription found');
    }

    const now = new Date();
    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;
    const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get usage data
    const queriesQuota = usage_quotas.find(q => q.quota_type === 'queries');
    const tokensQuota = usage_quotas.find(q => q.quota_type === 'tokens');
    const apiCallsQuota = usage_quotas.find(q => q.quota_type === 'api_calls');

    // Calculate projections
    const queriesProjection = queriesQuota ? this.calculateProjectedUsage(queriesQuota.quota_used, daysRemaining) : 0;
    const potentialOverageCost = queriesQuota ? this.calculateOverageCost(queriesQuota) : 0;

    // Get active alerts
    const alerts = await this.prisma.usage_alerts.findMany({
      where: {
        business_id: businessId,
        resolved_at: null
      },
      orderBy: { triggered_at: 'desc' }
    });

    return {
      current_period: {
        start_date: periodStart.toISOString(),
        end_date: periodEnd.toISOString(),
        days_remaining: daysRemaining
      },
      usage_summary: {
        queries: {
          used: queriesQuota?.quota_used || 0,
          limit: queriesQuota?.quota_limit || 0,
          percentage_used: queriesQuota ? Math.round((queriesQuota.quota_used / queriesQuota.quota_limit) * 100) : 0,
          overage: queriesQuota?.quota_overage || 0,
          projected_month_end: queriesProjection
        },
        tokens: {
          used: tokensQuota?.quota_used || 0,
          limit: tokensQuota?.quota_limit || 0,
          cost_current_period: tokensQuota?.quota_overage * (tokensQuota?.overage_rate_cents || 0) || 0
        },
        api_calls: {
          used: apiCallsQuota?.quota_used || 0,
          daily_limit: Math.floor((apiCallsQuota?.quota_limit || 0) / 30),
          remaining_today: Math.max(0, Math.floor((apiCallsQuota?.quota_limit || 0) / 30) - (apiCallsQuota?.quota_used || 0))
        }
      },
      alerts: alerts.map(alert => ({
        type: alert.alert_type as 'approaching_limit' | 'limit_exceeded',
        quota_type: alert.quota_type,
        message: this.generateAlertMessage(alert),
        action_required: alert.alert_type === 'limit_exceeded',
        recommended_action: this.getRecommendedAction(alert)
      })),
      cost_projection: {
        estimated_monthly_cost: current_plan.price_cents,
        potential_overage_cost: potentialOverageCost,
        recommended_plan: this.getRecommendedUpgradePlan(current_plan.id)
      }
    };
  }

  /**
   * Change business plan
   */
  async changePlan(request: PlanChangeRequest): Promise<PlanChangeResult> {
    const { business_id, from_plan_id, to_plan_id, change_type, change_timing, reason } = request;

    // Get current and target plans
    const currentPlan = from_plan_id ? await this.prisma.plan_definitions.findUnique({
      where: { id: from_plan_id }
    }) : null;

    const targetPlan = await this.prisma.plan_definitions.findUnique({
      where: { id: to_plan_id }
    });

    if (!targetPlan) {
      throw new Error('Target plan not found');
    }

    // Calculate proration
    const proration = await this.calculateProration(
      business_id,
      currentPlan?.id,
      targetPlan.id,
      change_timing
    );

    // Create plan change record
    const planChange = await this.prisma.plan_changes.create({
      data: {
        business_id,
        from_plan_id,
        to_plan_id,
        change_type,
        change_timing,
        status: 'pending',
        proration_credit: proration.credit,
        proration_charge: proration.charge,
        net_charge: proration.netCharge,
        effective_date: change_timing === 'immediate' ? new Date() : proration.effectiveDate,
        reason
      }
    });

    // Process immediate changes
    if (change_timing === 'immediate') {
      await this.processImmediatePlanChange(business_id, targetPlan.id);
    }

    // Get feature differences
    const featureChanges = await this.calculateFeatureChanges(from_plan_id, to_plan_id);

    return {
      success: true,
      effective_date: planChange.effective_date,
      proration_credit: proration.credit,
      proration_charge: proration.charge,
      net_charge: proration.netCharge,
      new_limits: featureChanges.new_limits,
      new_features: featureChanges.new_features,
      removed_features: featureChanges.removed_features
    };
  }

  /**
   * Request emergency usage pool
   */
  async requestEmergencyPool(
    businessId: string,
    poolType: string,
    requestedAmount: number,
    justification: string
  ): Promise<{
    approved: boolean;
    emergency_quota_granted: number;
    cost_per_unit: number;
    total_emergency_cost: number;
    expires_at: string;
  }> {
    // Check if business has emergency pool access
    const hasAccess = await this.checkEmergencyPoolAccess(businessId);
    
    if (!hasAccess) {
      return {
        approved: false,
        emergency_quota_granted: 0,
        cost_per_unit: 0,
        total_emergency_cost: 0,
        expires_at: ''
      };
    }

    // Calculate emergency pool cost (2x normal rate)
    const normalRate = await this.getOverageRate(businessId, poolType);
    const emergencyRate = normalRate * 2;

    // Create emergency pool
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiration

    const emergencyPool = await this.prisma.emergency_usage_pools.create({
      data: {
        business_id: businessId,
        pool_type: poolType,
        total_allocated: requestedAmount,
        used_amount: 0,
        cost_per_unit: emergencyRate,
        expires_at: expiresAt,
        justification
      }
    });

    return {
      approved: true,
      emergency_quota_granted: requestedAmount,
      cost_per_unit: emergencyRate,
      total_emergency_cost: requestedAmount * emergencyRate,
      expires_at: expiresAt.toISOString()
    };
  }

  // Private helper methods

  private getQuotaTypeForOperation(operationType: string): string {
    const mapping = {
      'query': 'queries',
      'embedding': 'embeddings',
      'api_call': 'api_calls',
      'storage': 'storage'
    };
    return mapping[operationType] || 'queries';
  }

  private async updateUsageQuotas(businessId: string, eventType: string, quantity: number): Promise<void> {
    const quotaType = this.getQuotaTypeForOperation(eventType);
    
    await this.prisma.usage_quotas.upsert({
      where: {
        business_id_quota_type: {
          business_id: businessId,
          quota_type: quotaType
        }
      },
      update: {
        quota_used: { increment: quantity }
      },
      create: {
        business_id: businessId,
        plan_id: 'free', // Default to free plan
        quota_type: quotaType,
        quota_limit: 100, // Default limit
        quota_used: quantity,
        reset_date: this.getNextResetDate()
      }
    });
  }

  private async checkUsageAlerts(businessId: string): Promise<void> {
    const quotas = await this.prisma.usage_quotas.findMany({
      where: { business_id: businessId }
    });

    for (const quota of quotas) {
      const percentage = (quota.quota_used / quota.quota_limit) * 100;
      
      // Check for alert thresholds
      if (percentage >= 75 && percentage < 90) {
        await this.createAlert(businessId, 'approaching_limit', quota.quota_type, 75);
      } else if (percentage >= 90 && percentage < 100) {
        await this.createAlert(businessId, 'approaching_limit', quota.quota_type, 90);
      } else if (percentage >= 100) {
        await this.createAlert(businessId, 'limit_exceeded', quota.quota_type, 100);
      }
    }
  }

  private async createAlert(
    businessId: string,
    alertType: string,
    quotaType: string,
    threshold: number
  ): Promise<void> {
    // Check if alert already exists
    const existingAlert = await this.prisma.usage_alerts.findFirst({
      where: {
        business_id: businessId,
        alert_type: alertType,
        quota_type: quotaType,
        threshold_percentage: threshold,
        resolved_at: null
      }
    });

    if (!existingAlert) {
      await this.prisma.usage_alerts.create({
        data: {
          business_id: businessId,
          alert_type: alertType,
          quota_type: quotaType,
          threshold_percentage: threshold
        }
      });
    }
  }

  private getNextResetDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  private calculateProjectedUsage(currentUsage: number, daysRemaining: number): number {
    const daysInMonth = 30;
    const dailyUsage = currentUsage / (daysInMonth - daysRemaining);
    return Math.round(currentUsage + (dailyUsage * daysRemaining));
  }

  private calculateOverageCost(quota: any): number {
    return quota.quota_overage * quota.overage_rate_cents;
  }

  private generateAlertMessage(alert: any): string {
    const messages = {
      'approaching_limit': `You're approaching your ${alert.quota_type} limit (${alert.threshold_percentage}% used)`,
      'limit_exceeded': `You've exceeded your ${alert.quota_type} limit`
    };
    return messages[alert.alert_type] || 'Usage alert';
  }

  private getRecommendedAction(alert: any): string {
    const actions = {
      'approaching_limit': 'Consider upgrading your plan to avoid overage charges',
      'limit_exceeded': 'Upgrade your plan immediately or request emergency usage'
    };
    return actions[alert.alert_type] || 'Contact support';
  }

  private getRecommendedUpgradePlan(currentPlanId: string): string {
    const upgradePath = {
      'free': 'starter',
      'starter': 'pro',
      'pro': 'business',
      'business': 'enterprise'
    };
    return upgradePath[currentPlanId] || 'enterprise';
  }

  private calculateUpgradeCost(currentPlanId: string, targetPlanId: string): number {
    // This would integrate with Stripe pricing
    // For now, return a placeholder
    return 0;
  }

  private async calculateProration(
    businessId: string,
    currentPlanId: string | null,
    targetPlanId: string,
    changeTiming: string
  ): Promise<{
    credit: number;
    charge: number;
    netCharge: number;
    effectiveDate: Date;
  }> {
    // This would integrate with Stripe for actual proration calculations
    // For now, return placeholder values
    return {
      credit: 0,
      charge: 0,
      netCharge: 0,
      effectiveDate: new Date()
    };
  }

  private async processImmediatePlanChange(businessId: string, targetPlanId: string): Promise<void> {
    // Update subscription in Stripe
    // Update local database
    // Update usage quotas
    // This would integrate with the existing billing service
  }

  private async calculateFeatureChanges(
    fromPlanId: string | null,
    toPlanId: string
  ): Promise<{
    new_limits: Record<string, number>;
    new_features: string[];
    removed_features: string[];
  }> {
    // This would compare plan features and return differences
    return {
      new_limits: {},
      new_features: [],
      removed_features: []
    };
  }

  private async checkEmergencyPoolAccess(businessId: string): Promise<boolean> {
    // Check if business is eligible for emergency pools
    // This could be based on plan, payment history, etc.
    return true;
  }

  private async getOverageRate(businessId: string, quotaType: string): Promise<number> {
    const quota = await this.prisma.usage_quotas.findFirst({
      where: { business_id: businessId, quota_type: quotaType }
    });
    return quota?.overage_rate_cents || 0;
  }
}
