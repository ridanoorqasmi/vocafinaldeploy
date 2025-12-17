/**
 * Phase 4B: Usage Enforcement Service
 * Real-time usage enforcement and feature flag system
 */

import { PrismaClient } from '@prisma/client';
import { PlanManagementService, UsageCheckResult } from './plan-management-service';

export interface EnforcementContext {
  businessId: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FeatureAccessResult {
  allowed: boolean;
  reason?: string;
  feature_key: string;
  access_level: 'full' | 'limited' | 'restricted';
  usage_limit?: number;
  current_usage?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_time: number;
  retry_after?: number;
}

export class UsageEnforcementService {
  private prisma: PrismaClient;
  private planManagement: PlanManagementService;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    this.planManagement = new PlanManagementService(prisma);
  }

  /**
   * Enforce usage limits before processing any billable operation
   */
  async enforceUsageLimit(
    context: EnforcementContext,
    operationType: 'query' | 'embedding' | 'api_call',
    estimatedTokens?: number,
    featureRequired?: string
  ): Promise<UsageCheckResult> {
    try {
      // Check usage limits
      const usageCheck = await this.planManagement.checkUsageLimit(
        context.businessId,
        operationType,
        estimatedTokens,
        featureRequired
      );

      // If not allowed, check for emergency options
      if (!usageCheck.allowed && usageCheck.emergency_options?.emergency_pool_available) {
        // Log emergency pool usage attempt
        await this.logEmergencyPoolAttempt(context, operationType);
      }

      return usageCheck;
    } catch (error) {
      console.error('Usage enforcement error:', error);
      // Fail open for system stability, but log the error
      return {
        allowed: true,
        current_usage: { used: 0, limit: 0, remaining: 0 },
        reason: 'System error - allowing request for stability'
      };
    }
  }

  /**
   * Check feature access for a specific feature
   */
  async checkFeatureAccess(
    context: EnforcementContext,
    featureKey: string
  ): Promise<FeatureAccessResult> {
    try {
      // Get business plan and feature flags
      const { current_plan, feature_flags } = await this.planManagement.getBusinessPlan(context.businessId);

      // Check if feature is enabled for this plan
      const featureFlag = await this.prisma.feature_flags.findFirst({
        where: {
          plan_id: current_plan.id,
          feature_key: featureKey
        }
      });

      if (!featureFlag || !featureFlag.is_enabled) {
        return {
          allowed: false,
          reason: `Feature '${featureKey}' not available on ${current_plan.name} plan`,
          feature_key: featureKey,
          access_level: 'restricted'
        };
      }

      // Check for business-specific overrides
      const override = await this.prisma.business_feature_overrides.findFirst({
        where: {
          business_id: context.businessId,
          feature_key: featureKey,
          OR: [
            { expires_at: null },
            { expires_at: { gt: new Date() } }
          ]
        }
      });

      if (override) {
        return {
          allowed: override.is_enabled,
          reason: override.is_enabled ? 'Feature enabled via override' : 'Feature disabled via override',
          feature_key: featureKey,
          access_level: override.is_enabled ? 'full' : 'restricted'
        };
      }

      // Check usage limits for the feature
      let currentUsage = 0;
      if (featureFlag.usage_limit) {
        const quota = await this.prisma.usage_quotas.findFirst({
          where: {
            business_id: context.businessId,
            quota_type: featureKey
          }
        });
        currentUsage = quota?.quota_used || 0;
      }

      return {
        allowed: true,
        feature_key: featureKey,
        access_level: featureFlag.access_level as 'full' | 'limited' | 'restricted',
        usage_limit: featureFlag.usage_limit,
        current_usage: currentUsage
      };
    } catch (error) {
      console.error('Feature access check error:', error);
      return {
        allowed: false,
        reason: 'System error checking feature access',
        feature_key: featureKey,
        access_level: 'restricted'
      };
    }
  }

  /**
   * Apply rate limiting based on subscription tier
   */
  async applyRateLimit(
    context: EnforcementContext,
    operationType: string
  ): Promise<RateLimitResult> {
    try {
      // Get business plan
      const { current_plan } = await this.planManagement.getBusinessPlan(context.businessId);

      // Define rate limits by plan
      const rateLimits = {
        'free': { requests_per_minute: 10, requests_per_hour: 100 },
        'starter': { requests_per_minute: 30, requests_per_hour: 500 },
        'pro': { requests_per_minute: 60, requests_per_hour: 1000 },
        'business': { requests_per_minute: 120, requests_per_hour: 2000 },
        'enterprise': { requests_per_minute: 300, requests_per_hour: 5000 }
      };

      const limits = rateLimits[current_plan.id] || rateLimits['free'];

      // Check current usage in Redis or database
      const currentUsage = await this.getCurrentRateLimitUsage(context.businessId, operationType);

      if (currentUsage.minute >= limits.requests_per_minute) {
        return {
          allowed: false,
          remaining: 0,
          reset_time: Date.now() + 60000, // 1 minute
          retry_after: 60
        };
      }

      if (currentUsage.hour >= limits.requests_per_hour) {
        return {
          allowed: false,
          remaining: 0,
          reset_time: Date.now() + 3600000, // 1 hour
          retry_after: 3600
        };
      }

      // Record the request
      await this.recordRateLimitUsage(context.businessId, operationType);

      return {
        allowed: true,
        remaining: Math.min(
          limits.requests_per_minute - currentUsage.minute,
          limits.requests_per_hour - currentUsage.hour
        ),
        reset_time: Date.now() + 60000
      };
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open for system stability
      return {
        allowed: true,
        remaining: 1000,
        reset_time: Date.now() + 60000
      };
    }
  }

  /**
   * Record usage event with enforcement
   */
  async recordUsageWithEnforcement(
    context: EnforcementContext,
    eventType: 'query' | 'embedding' | 'api_call',
    quantity: number = 1,
    tokensConsumed?: number,
    costCents?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Record the usage event
      await this.planManagement.recordUsageEvent({
        business_id: context.businessId,
        event_type: eventType,
        quantity,
        tokens_consumed: tokensConsumed,
        cost_cents: costCents,
        metadata: {
          ...metadata,
          user_id: context.userId,
          session_id: context.sessionId,
          ip_address: context.ipAddress,
          user_agent: context.userAgent
        }
      });

      // Update real-time usage counters
      await this.updateRealtimeCounters(context.businessId, eventType, quantity);

      // Check for usage alerts
      await this.checkAndTriggerAlerts(context.businessId, eventType);

    } catch (error) {
      console.error('Usage recording error:', error);
      // Don't throw - usage recording should not break the main operation
    }
  }

  /**
   * Get current usage status for a business
   */
  async getCurrentUsageStatus(businessId: string): Promise<{
    quotas: Array<{
      type: string;
      used: number;
      limit: number;
      percentage: number;
      overage: number;
    }>;
    alerts: Array<{
      type: string;
      message: string;
      action_required: boolean;
    }>;
    emergency_pools: Array<{
      type: string;
      remaining: number;
      expires_at: string;
    }>;
  }> {
    try {
      // Get usage quotas
      const quotas = await this.prisma.usage_quotas.findMany({
        where: { business_id: businessId }
      });

      // Get active alerts
      const alerts = await this.prisma.usage_alerts.findMany({
        where: {
          business_id: businessId,
          resolved_at: null
        },
        orderBy: { triggered_at: 'desc' }
      });

      // Get emergency pools
      const emergencyPools = await this.prisma.emergency_usage_pools.findMany({
        where: {
          business_id: businessId,
          expires_at: { gt: new Date() }
        }
      });

      return {
        quotas: quotas.map(quota => ({
          type: quota.quota_type,
          used: quota.quota_used,
          limit: quota.quota_limit,
          percentage: Math.round((quota.quota_used / quota.quota_limit) * 100),
          overage: quota.quota_overage
        })),
        alerts: alerts.map(alert => ({
          type: alert.alert_type,
          message: this.generateAlertMessage(alert),
          action_required: alert.alert_type === 'limit_exceeded'
        })),
        emergency_pools: emergencyPools.map(pool => ({
          type: pool.pool_type,
          remaining: pool.total_allocated - pool.used_amount,
          expires_at: pool.expires_at.toISOString()
        }))
      };
    } catch (error) {
      console.error('Usage status error:', error);
      return {
        quotas: [],
        alerts: [],
        emergency_pools: []
      };
    }
  }

  /**
   * Emergency usage pool access
   */
  async accessEmergencyPool(
    businessId: string,
    poolType: string,
    requestedAmount: number,
    justification: string
  ): Promise<{
    approved: boolean;
    granted_amount: number;
    cost_per_unit: number;
    total_cost: number;
    expires_at: string;
  }> {
    try {
      // Check if business has emergency pool access
      const hasAccess = await this.checkEmergencyPoolEligibility(businessId);
      
      if (!hasAccess) {
        return {
          approved: false,
          granted_amount: 0,
          cost_per_unit: 0,
          total_cost: 0,
          expires_at: ''
        };
      }

      // Request emergency pool from plan management
      const result = await this.planManagement.requestEmergencyPool(
        businessId,
        poolType,
        requestedAmount,
        justification
      );

      return {
        approved: result.approved,
        granted_amount: result.emergency_quota_granted,
        cost_per_unit: result.cost_per_unit,
        total_cost: result.total_emergency_cost,
        expires_at: result.expires_at
      };
    } catch (error) {
      console.error('Emergency pool access error:', error);
      return {
        approved: false,
        granted_amount: 0,
        cost_per_unit: 0,
        total_cost: 0,
        expires_at: ''
      };
    }
  }

  // Private helper methods

  private async logEmergencyPoolAttempt(
    context: EnforcementContext,
    operationType: string
  ): Promise<void> {
    // Log emergency pool usage attempt for analytics
    await this.prisma.usage_events.create({
      data: {
        business_id: context.businessId,
        event_type: 'emergency_pool_attempt',
        quantity: 1,
        metadata: {
          operation_type: operationType,
          user_id: context.userId,
          session_id: context.sessionId
        }
      }
    });
  }

  private async getCurrentRateLimitUsage(
    businessId: string,
    operationType: string
  ): Promise<{ minute: number; hour: number }> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // Get usage counts from the last minute and hour
    const [minuteUsage, hourUsage] = await Promise.all([
      this.prisma.usage_events.count({
        where: {
          business_id: businessId,
          event_type: operationType,
          created_at: { gte: oneMinuteAgo }
        }
      }),
      this.prisma.usage_events.count({
        where: {
          business_id: businessId,
          event_type: operationType,
          created_at: { gte: oneHourAgo }
        }
      })
    ]);

    return { minute: minuteUsage, hour: hourUsage };
  }

  private async recordRateLimitUsage(
    businessId: string,
    operationType: string
  ): Promise<void> {
    // Record rate limit usage
    await this.prisma.usage_events.create({
      data: {
        business_id: businessId,
        event_type: operationType,
        quantity: 1,
        metadata: { rate_limit: true }
      }
    });
  }

  private async updateRealtimeCounters(
    businessId: string,
    eventType: string,
    quantity: number
  ): Promise<void> {
    // Update real-time usage counters
    // This could use Redis for better performance
    const quotaType = this.getQuotaTypeForEvent(eventType);
    
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
        plan_id: 'free',
        quota_type: quotaType,
        quota_limit: 100,
        quota_used: quantity,
        reset_date: this.getNextResetDate()
      }
    });
  }

  private async checkAndTriggerAlerts(
    businessId: string,
    eventType: string
  ): Promise<void> {
    // Check if usage has crossed alert thresholds
    const quotaType = this.getQuotaTypeForEvent(eventType);
    const quota = await this.prisma.usage_quotas.findFirst({
      where: {
        business_id: businessId,
        quota_type: quotaType
      }
    });

    if (quota) {
      const percentage = (quota.quota_used / quota.quota_limit) * 100;
      
      if (percentage >= 75 && percentage < 90) {
        await this.createUsageAlert(businessId, 'approaching_limit', quotaType, 75);
      } else if (percentage >= 90 && percentage < 100) {
        await this.createUsageAlert(businessId, 'approaching_limit', quotaType, 90);
      } else if (percentage >= 100) {
        await this.createUsageAlert(businessId, 'limit_exceeded', quotaType, 100);
      }
    }
  }

  private async createUsageAlert(
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

  private async checkEmergencyPoolEligibility(businessId: string): Promise<boolean> {
    // Check if business is eligible for emergency pools
    // This could be based on plan, payment history, etc.
    const subscription = await this.prisma.subscriptions.findFirst({
      where: { businessId, status: 'ACTIVE' }
    });

    if (!subscription) return false;

    // Check if business has good payment history
    const recentPayments = await this.prisma.payment_history.count({
      where: {
        business_id: businessId,
        status: 'succeeded',
        processed_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }
    });

    return recentPayments > 0;
  }

  private getQuotaTypeForEvent(eventType: string): string {
    const mapping = {
      'query': 'queries',
      'embedding': 'embeddings',
      'api_call': 'api_calls',
      'storage': 'storage'
    };
    return mapping[eventType] || 'queries';
  }

  private getNextResetDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }

  private generateAlertMessage(alert: any): string {
    const messages = {
      'approaching_limit': `You're approaching your ${alert.quota_type} limit (${alert.threshold_percentage}% used)`,
      'limit_exceeded': `You've exceeded your ${alert.quota_type} limit`
    };
    return messages[alert.alert_type] || 'Usage alert';
  }
}
