import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ==============================================
// REVENUE ANALYTICS ENGINE
// ==============================================

export interface MRRCalculation {
  total_mrr_cents: number;
  new_business_mrr_cents: number;
  expansion_mrr_cents: number;
  contraction_mrr_cents: number;
  churned_mrr_cents: number;
  net_new_mrr_cents: number;
  total_customers: number;
  paying_customers: number;
  average_revenue_per_user_cents: number;
}

export interface CustomerLTVMetrics {
  business_id: string;
  first_subscription_date: Date;
  last_active_date?: Date;
  total_revenue_cents: number;
  total_months_active: number;
  current_mrr_cents: number;
  predicted_ltv_cents: number;
  churn_probability: number;
  health_score: number;
  segment: 'champion' | 'loyal' | 'at_risk' | 'critical';
}

export interface RevenueCohortData {
  cohort_month: string;
  months_since_start: number;
  customers_remaining: number;
  total_revenue_cents: number;
  average_revenue_per_customer_cents: number;
  retention_rate: number;
}

export interface ChurnAnalysis {
  business_id: string;
  analysis_date: Date;
  churn_probability: number;
  churn_risk_factors: Record<string, any>;
  recommended_actions: Record<string, any>;
  last_login_date?: Date;
  usage_trend: 'increasing' | 'stable' | 'declining';
  support_tickets_count: number;
  payment_failures_count: number;
}

export class RevenueAnalyticsEngine {
  /**
   * Calculate Monthly Recurring Revenue for a specific date
   */
  async calculateMRRForDate(targetDate: Date): Promise<MRRCalculation> {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get active subscriptions on target date
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodStart: { lte: endOfDay },
        currentPeriodEnd: { gt: startOfDay }
      },
      include: {
        business: true
      }
    });

    // Get previous period subscriptions for comparison
    const previousPeriodStart = new Date(targetDate);
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
    const previousPeriodEnd = new Date(previousPeriodStart);
    previousPeriodEnd.setMonth(previousPeriodEnd.getMonth() + 1);

    const previousSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodStart: { lte: previousPeriodEnd },
        currentPeriodEnd: { gt: previousPeriodStart }
      },
      include: {
        business: true
      }
    });

    // Calculate MRR components
    const totalMRR = activeSubscriptions.reduce((sum, sub) => {
      // Get plan price from plan_definitions table
      return sum + this.getPlanPriceCents(sub.planId);
    }, 0);

    const newBusinessMRR = activeSubscriptions
      .filter(sub => sub.createdAt >= previousPeriodStart)
      .reduce((sum, sub) => sum + this.getPlanPriceCents(sub.planId), 0);

    // Calculate expansion/contraction by comparing current vs previous
    const currentBusinessIds = new Set(activeSubscriptions.map(s => s.businessId));
    const previousBusinessIds = new Set(previousSubscriptions.map(s => s.businessId));

    let expansionMRR = 0;
    let contractionMRR = 0;

    for (const currentSub of activeSubscriptions) {
      const previousSub = previousSubscriptions.find(p => p.businessId === currentSub.businessId);
      if (previousSub) {
        const currentPrice = this.getPlanPriceCents(currentSub.planId);
        const previousPrice = this.getPlanPriceCents(previousSub.planId);
        
        if (currentPrice > previousPrice) {
          expansionMRR += currentPrice - previousPrice;
        } else if (currentPrice < previousPrice) {
          contractionMRR += previousPrice - currentPrice;
        }
      }
    }

    // Calculate churned MRR
    const churnedBusinessIds = Array.from(previousBusinessIds).filter(id => !currentBusinessIds.has(id));
    const churnedMRR = churnedBusinessIds.reduce((sum, businessId) => {
      const previousSub = previousSubscriptions.find(s => s.businessId === businessId);
      return sum + (previousSub ? this.getPlanPriceCents(previousSub.planId) : 0);
    }, 0);

    const netNewMRR = totalMRR - (totalMRR - newBusinessMRR - expansionMRR + contractionMRR + churnedMRR);
    const payingCustomers = activeSubscriptions.length;
    const totalCustomers = await prisma.business.count();
    const averageRevenuePerUser = payingCustomers > 0 ? Math.round(totalMRR / payingCustomers) : 0;

    return {
      total_mrr_cents: totalMRR,
      new_business_mrr_cents: newBusinessMRR,
      expansion_mrr_cents: expansionMRR,
      contraction_mrr_cents: contractionMRR,
      churned_mrr_cents: churnedMRR,
      net_new_mrr_cents: netNewMRR,
      total_customers: totalCustomers,
      paying_customers: payingCustomers,
      average_revenue_per_user_cents: averageRevenuePerUser
    };
  }

  /**
   * Calculate Customer Lifetime Value metrics
   */
  async calculateCustomerLTV(businessId: string): Promise<CustomerLTVMetrics> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!business || business.subscriptions.length === 0) {
      throw new Error('Business not found or no active subscriptions');
    }

    const firstSubscription = business.subscriptions[0];
    const currentSubscription = business.subscriptions[business.subscriptions.length - 1];
    
    // Calculate total revenue
    const totalRevenue = await this.calculateTotalRevenue(businessId);
    
    // Calculate months active
    const monthsActive = this.calculateMonthsActive(firstSubscription.createdAt);
    
    // Get current MRR
    const currentMRR = this.getPlanPriceCents(currentSubscription.planId);
    
    // Calculate predicted LTV using simple model
    const predictedLTV = this.calculatePredictedLTV(currentMRR, monthsActive);
    
    // Calculate churn probability
    const churnProbability = await this.calculateChurnProbability(businessId);
    
    // Calculate health score
    const healthScore = await this.calculateHealthScore(businessId);
    
    // Determine segment
    const segment = this.determineCustomerSegment(healthScore, churnProbability);
    
    // Get last active date
    const lastActiveDate = await this.getLastActiveDate(businessId);

    return {
      business_id: businessId,
      first_subscription_date: firstSubscription.createdAt,
      last_active_date: lastActiveDate,
      total_revenue_cents: totalRevenue,
      total_months_active: monthsActive,
      current_mrr_cents: currentMRR,
      predicted_ltv_cents: predictedLTV,
      churn_probability: churnProbability,
      health_score: healthScore,
      segment
    };
  }

  /**
   * Perform cohort analysis for revenue and retention
   */
  async performCohortAnalysis(cohortType: 'revenue' | 'retention' = 'revenue'): Promise<RevenueCohortData[]> {
    const cohorts: RevenueCohortData[] = [];
    
    // Get all subscription start dates grouped by month
    const subscriptionMonths = await prisma.subscription.findMany({
      select: {
        createdAt: true,
        businessId: true,
        planId: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by cohort month
    const cohortGroups = new Map<string, typeof subscriptionMonths>();
    
    for (const subscription of subscriptionMonths) {
      const cohortMonth = subscription.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!cohortGroups.has(cohortMonth)) {
        cohortGroups.set(cohortMonth, []);
      }
      cohortGroups.get(cohortMonth)!.push(subscription);
    }

    // Calculate metrics for each cohort
    for (const [cohortMonth, subscriptions] of Array.from(cohortGroups.entries())) {
      const cohortDate = new Date(cohortMonth + '-01');
      const monthsSinceStart = Math.floor(
        (Date.now() - cohortDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      // Calculate customers remaining (simplified - check if still active)
      const customersRemaining = await this.calculateCustomersRemaining(
        subscriptions.map(s => s.businessId),
        cohortDate
      );

      // Calculate total revenue for this cohort
      const totalRevenue = subscriptions.reduce((sum, sub) => {
        return sum + this.getPlanPriceCents(sub.planId);
      }, 0);

      const averageRevenuePerCustomer = subscriptions.length > 0 
        ? Math.round(totalRevenue / subscriptions.length) 
        : 0;

      const retentionRate = subscriptions.length > 0 
        ? customersRemaining / subscriptions.length 
        : 0;

      cohorts.push({
        cohort_month: cohortMonth,
        months_since_start: monthsSinceStart,
        customers_remaining: customersRemaining,
        total_revenue_cents: totalRevenue,
        average_revenue_per_customer_cents: averageRevenuePerCustomer,
        retention_rate: retentionRate
      });
    }

    return cohorts.sort((a, b) => a.cohort_month.localeCompare(b.cohort_month));
  }

  /**
   * Analyze churn risk for a business
   */
  async analyzeChurnRisk(businessId: string): Promise<ChurnAnalysis> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscriptions: { where: { status: 'ACTIVE' } },
        queryLogs: {
          where: { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!business) {
      throw new Error('Business not found');
    }

    // Calculate churn probability using multiple factors
    const churnProbability = await this.calculateChurnProbability(businessId);
    
    // Analyze risk factors
    const riskFactors = await this.analyzeRiskFactors(businessId);
    
    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(riskFactors, churnProbability);
    
    // Get usage trend
    const usageTrend = await this.analyzeUsageTrend(businessId);
    
    // Count support tickets and payment failures
    const supportTicketsCount = await this.countSupportTickets(businessId);
    const paymentFailuresCount = await this.countPaymentFailures(businessId);
    
    // Get last login date
    const lastLoginDate = business.queryLogs.length > 0 
      ? business.queryLogs[0].createdAt 
      : undefined;

    return {
      business_id: businessId,
      analysis_date: new Date(),
      churn_probability: churnProbability,
      churn_risk_factors: riskFactors,
      recommended_actions: recommendedActions,
      last_login_date: lastLoginDate,
      usage_trend: usageTrend,
      support_tickets_count: supportTicketsCount,
      payment_failures_count: paymentFailuresCount
    };
  }

  /**
   * Store MRR snapshot in database
   */
  async storeMRRSnapshot(mrrData: MRRCalculation, snapshotDate: Date): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO mrr_snapshots (
        snapshot_date,
        total_mrr_cents,
        new_business_mrr_cents,
        expansion_mrr_cents,
        contraction_mrr_cents,
        churned_mrr_cents,
        net_new_mrr_cents,
        total_customers,
        paying_customers,
        average_revenue_per_user_cents
      ) VALUES (
        ${snapshotDate.toISOString().split('T')[0]}::DATE,
        ${mrrData.total_mrr_cents},
        ${mrrData.new_business_mrr_cents},
        ${mrrData.expansion_mrr_cents},
        ${mrrData.contraction_mrr_cents},
        ${mrrData.churned_mrr_cents},
        ${mrrData.net_new_mrr_cents},
        ${mrrData.total_customers},
        ${mrrData.paying_customers},
        ${mrrData.average_revenue_per_user_cents}
      )
      ON CONFLICT (snapshot_date) DO UPDATE SET
        total_mrr_cents = EXCLUDED.total_mrr_cents,
        new_business_mrr_cents = EXCLUDED.new_business_mrr_cents,
        expansion_mrr_cents = EXCLUDED.expansion_mrr_cents,
        contraction_mrr_cents = EXCLUDED.contraction_mrr_cents,
        churned_mrr_cents = EXCLUDED.churned_mrr_cents,
        net_new_mrr_cents = EXCLUDED.net_new_mrr_cents,
        total_customers = EXCLUDED.total_customers,
        paying_customers = EXCLUDED.paying_customers,
        average_revenue_per_user_cents = EXCLUDED.average_revenue_per_user_cents
    `;
  }

  /**
   * Store customer LTV metrics in database
   */
  async storeCustomerLTV(ltvData: CustomerLTVMetrics): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO customer_ltv_metrics (
        business_id,
        first_subscription_date,
        last_active_date,
        total_revenue_cents,
        total_months_active,
        current_mrr_cents,
        predicted_ltv_cents,
        churn_probability,
        health_score,
        segment
      ) VALUES (
        ${ltvData.business_id}::UUID,
        ${ltvData.first_subscription_date}::DATE,
        ${ltvData.last_active_date?.toISOString().split('T')[0]}::DATE,
        ${ltvData.total_revenue_cents},
        ${ltvData.total_months_active},
        ${ltvData.current_mrr_cents},
        ${ltvData.predicted_ltv_cents},
        ${ltvData.churn_probability},
        ${ltvData.health_score},
        ${ltvData.segment}
      )
      ON CONFLICT (business_id) DO UPDATE SET
        last_active_date = EXCLUDED.last_active_date,
        total_revenue_cents = EXCLUDED.total_revenue_cents,
        total_months_active = EXCLUDED.total_months_active,
        current_mrr_cents = EXCLUDED.current_mrr_cents,
        predicted_ltv_cents = EXCLUDED.predicted_ltv_cents,
        churn_probability = EXCLUDED.churn_probability,
        health_score = EXCLUDED.health_score,
        segment = EXCLUDED.segment,
        last_calculated_at = NOW()
    `;
  }

  // ==============================================
  // HELPER METHODS
  // ==============================================

  private getPlanPriceCents(planId: string): number {
    // Map plan IDs to prices in cents
    const planPrices: Record<string, number> = {
      'free': 0,
      'starter': 2900,    // $29/month
      'pro': 9900,        // $99/month
      'business': 29900,  // $299/month
      'enterprise': 0     // Custom pricing
    };
    
    return planPrices[planId] || 0;
  }

  private async calculateTotalRevenue(businessId: string): Promise<number> {
    const payments = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payment_history
      WHERE business_id = ${businessId}::UUID
        AND status = 'succeeded'
    `;
    
    return payments[0]?.total || 0;
  }

  private calculateMonthsActive(startDate: Date): number {
    const now = new Date();
    const diffTime = now.getTime() - startDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
  }

  private calculatePredictedLTV(currentMRR: number, monthsActive: number): number {
    // Simple LTV calculation: current MRR * 12 months
    // In a real implementation, this would use more sophisticated modeling
    return currentMRR * 12;
  }

  private async calculateChurnProbability(businessId: string): Promise<number> {
    // Simplified churn probability calculation
    // In a real implementation, this would use machine learning models
    
    const healthScore = await this.calculateHealthScore(businessId);
    const usageTrend = await this.analyzeUsageTrend(businessId);
    const supportTickets = await this.countSupportTickets(businessId);
    const paymentFailures = await this.countPaymentFailures(businessId);

    let probability = 0.1; // Base churn rate

    // Adjust based on health score
    if (healthScore < 40) probability += 0.4;
    else if (healthScore < 60) probability += 0.2;
    else if (healthScore < 80) probability += 0.1;

    // Adjust based on usage trend
    if (usageTrend === 'declining') probability += 0.2;
    else if (usageTrend === 'stable') probability += 0.05;

    // Adjust based on support tickets
    if (supportTickets > 5) probability += 0.15;
    else if (supportTickets > 2) probability += 0.1;

    // Adjust based on payment failures
    if (paymentFailures > 2) probability += 0.2;
    else if (paymentFailures > 0) probability += 0.1;

    return Math.min(0.95, Math.max(0.01, probability));
  }

  private async calculateHealthScore(businessId: string): Promise<number> {
    // Calculate health score based on multiple factors
    let score = 100;

    // Usage trend factor
    const usageTrend = await this.analyzeUsageTrend(businessId);
    if (usageTrend === 'declining') score -= 30;
    else if (usageTrend === 'stable') score -= 10;

    // Payment reliability factor
    const paymentFailures = await this.countPaymentFailures(businessId);
    if (paymentFailures > 2) score -= 25;
    else if (paymentFailures > 0) score -= 10;

    // Support tickets factor
    const supportTickets = await this.countSupportTickets(businessId);
    if (supportTickets > 5) score -= 20;
    else if (supportTickets > 2) score -= 10;

    // Engagement factor (based on recent activity)
    const recentActivity = await this.getRecentActivityScore(businessId);
    score -= (100 - recentActivity) * 0.3;

    return Math.max(0, Math.min(100, score));
  }

  private determineCustomerSegment(healthScore: number, churnProbability: number): 'champion' | 'loyal' | 'at_risk' | 'critical' {
    if (healthScore >= 80 && churnProbability < 0.2) return 'champion';
    if (healthScore >= 60 && churnProbability < 0.4) return 'loyal';
    if (healthScore >= 40 && churnProbability < 0.7) return 'at_risk';
    return 'critical';
  }

  private async getLastActiveDate(businessId: string): Promise<Date | undefined> {
    const lastQuery = await prisma.queryLog.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    return lastQuery?.createdAt;
  }

  private async calculateCustomersRemaining(businessIds: string[], cohortDate: Date): Promise<number> {
    const activeBusinesses = await prisma.business.findMany({
      where: {
        id: { in: businessIds },
        subscriptions: {
          some: { status: 'ACTIVE' }
        }
      },
      select: { id: true }
    });

    return activeBusinesses.length;
  }

  private async analyzeRiskFactors(businessId: string): Promise<Record<string, any>> {
    const usageTrend = await this.analyzeUsageTrend(businessId);
    const supportTickets = await this.countSupportTickets(businessId);
    const paymentFailures = await this.countPaymentFailures(businessId);
    const healthScore = await this.calculateHealthScore(businessId);

    return {
      usage_trend: usageTrend,
      support_tickets_count: supportTickets,
      payment_failures_count: paymentFailures,
      health_score: healthScore,
      last_login_days_ago: await this.getDaysSinceLastLogin(businessId)
    };
  }

  private generateRecommendedActions(riskFactors: Record<string, any>, churnProbability: number): Record<string, any> {
    const actions: string[] = [];

    if (churnProbability > 0.7) {
      actions.push('Immediate intervention required - assign customer success manager');
      actions.push('Schedule retention call within 24 hours');
    } else if (churnProbability > 0.5) {
      actions.push('Schedule proactive check-in call');
      actions.push('Review usage patterns and provide optimization tips');
    }

    if (riskFactors.usage_trend === 'declining') {
      actions.push('Analyze usage decline and provide training/resources');
    }

    if (riskFactors.support_tickets_count > 3) {
      actions.push('Review support tickets and address root causes');
    }

    if (riskFactors.payment_failures_count > 1) {
      actions.push('Contact customer about payment method update');
    }

    return {
      immediate_actions: actions.filter(a => a.includes('Immediate') || a.includes('24 hours')),
      recommended_actions: actions.filter(a => !a.includes('Immediate') && !a.includes('24 hours')),
      priority: churnProbability > 0.7 ? 'high' : churnProbability > 0.5 ? 'medium' : 'low'
    };
  }

  private async analyzeUsageTrend(businessId: string): Promise<'increasing' | 'stable' | 'declining'> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentUsage = await prisma.queryLog.count({
      where: {
        businessId,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    const previousUsage = await prisma.queryLog.count({
      where: {
        businessId,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
      }
    });

    if (recentUsage > previousUsage * 1.1) return 'increasing';
    if (recentUsage < previousUsage * 0.9) return 'declining';
    return 'stable';
  }

  private async countSupportTickets(businessId: string): Promise<number> {
    return await prisma.queryLog.count({
      where: {
        businessId,
        status: 'ERROR',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });
  }

  private async countPaymentFailures(businessId: string): Promise<number> {
    return await prisma.$queryRaw<number>`
      SELECT COUNT(*)
      FROM payment_history
      WHERE business_id = ${businessId}::UUID
        AND status = 'failed'
        AND processed_at >= NOW() - INTERVAL '90 days'
    `;
  }

  private async getRecentActivityScore(businessId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentActivity = await prisma.queryLog.count({
      where: {
        businessId,
        createdAt: { gte: sevenDaysAgo }
      }
    });

    const previousActivity = await prisma.queryLog.count({
      where: {
        businessId,
        createdAt: { gte: thirtyDaysAgo, lt: sevenDaysAgo }
      }
    });

    if (previousActivity === 0) return recentActivity > 0 ? 100 : 0;
    
    return Math.min(100, (recentActivity / (previousActivity / 3)) * 100);
  }

  private async getDaysSinceLastLogin(businessId: string): Promise<number> {
    const lastQuery = await prisma.queryLog.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (!lastQuery) return 999; // Never logged in

    const diffTime = Date.now() - lastQuery.createdAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }
}

export const revenueAnalyticsEngine = new RevenueAnalyticsEngine();
