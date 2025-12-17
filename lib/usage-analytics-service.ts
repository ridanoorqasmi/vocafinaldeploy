/**
 * Phase 4B: Usage Analytics & Recommendation Engine
 * Intelligent usage analysis and plan recommendations
 */

import { PrismaClient } from '@prisma/client';
import { UsageTrackingService } from './usage-tracking-service';

export interface UsageAnalytics {
  business_id: string;
  period_start: Date;
  period_end: Date;
  total_usage: Record<string, number>;
  usage_trends: Record<string, {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentage_change: number;
    velocity: number; // usage per day
  }>;
  peak_usage_patterns: Record<string, {
    peak_hour: number;
    peak_day: string;
    peak_week: number;
  }>;
  cost_analysis: {
    current_plan_cost: number;
    overage_costs: number;
    potential_savings: number;
    optimal_plan_suggestion: string;
  };
  feature_utilization: Record<string, {
    usage_percentage: number;
    underutilized: boolean;
    overutilized: boolean;
  }>;
}

export interface PlanRecommendation {
  business_id: string;
  current_plan_id: string;
  recommended_plan_id: string;
  confidence_score: number;
  reasoning: string[];
  savings_potential: number;
  upgrade_cost: number;
  feature_gains: string[];
  feature_losses: string[];
  risk_assessment: {
    downgrade_risk: 'low' | 'medium' | 'high';
    overage_risk: 'low' | 'medium' | 'high';
    feature_risk: 'low' | 'medium' | 'high';
  };
}

export interface UsageForecast {
  business_id: string;
  forecast_period: {
    start: Date;
    end: Date;
  };
  predictions: Record<string, {
    predicted_usage: number;
    confidence_score: number;
    factors: Record<string, number>;
  }>;
  recommendations: {
    plan_suggestion: string;
    risk_level: 'low' | 'medium' | 'high';
    action_required: boolean;
    timeline: string;
  };
}

export interface BusinessIntelligence {
  business_id: string;
  insights: Array<{
    type: 'usage_pattern' | 'cost_optimization' | 'feature_gap' | 'growth_opportunity';
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    actionable: boolean;
    recommendations: string[];
  }>;
  kpis: {
    usage_efficiency: number;
    cost_effectiveness: number;
    feature_adoption: number;
    growth_velocity: number;
  };
  benchmarks: {
    industry_average: Record<string, number>;
    peer_comparison: Record<string, number>;
    performance_rating: 'below_average' | 'average' | 'above_average' | 'excellent';
  };
}

export class UsageAnalyticsService {
  private prisma: PrismaClient;
  private usageTracking: UsageTrackingService;

  constructor() {
    this.prisma = new PrismaClient();
    this.usageTracking = new UsageTrackingService();
  }

  /**
   * Generate comprehensive usage analytics for a business
   */
  async generateUsageAnalytics(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<UsageAnalytics> {
    try {
      // Get usage data from tracking service
      const usageData = await this.usageTracking.getUsageAnalytics(
        businessId,
        periodStart,
        periodEnd
      );

      // Get current plan information
      const subscription = await this.prisma.subscriptions.findFirst({
        where: { businessId, status: 'ACTIVE' }
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Calculate usage trends
      const usageTrends = await this.calculateUsageTrends(businessId, periodStart, periodEnd);

      // Analyze peak usage patterns
      const peakPatterns = await this.analyzePeakUsagePatterns(businessId, periodStart, periodEnd);

      // Calculate cost analysis
      const costAnalysis = await this.calculateCostAnalysis(businessId, subscription.planId);

      // Analyze feature utilization
      const featureUtilization = await this.analyzeFeatureUtilization(businessId, subscription.planId);

      return {
        business_id: businessId,
        period_start: periodStart,
        period_end: periodEnd,
        total_usage: usageData.total_usage,
        usage_trends: usageTrends,
        peak_usage_patterns: peakPatterns,
        cost_analysis: costAnalysis,
        feature_utilization: featureUtilization
      };

    } catch (error) {
      console.error('Generate usage analytics error:', error);
      throw error;
    }
  }

  /**
   * Generate intelligent plan recommendations
   */
  async generatePlanRecommendations(businessId: string): Promise<PlanRecommendation[]> {
    try {
      // Get current plan and usage data
      const subscription = await this.prisma.subscriptions.findFirst({
        where: { businessId, status: 'ACTIVE' }
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const currentPlan = await this.prisma.plan_definitions.findUnique({
        where: { id: subscription.planId }
      });

      if (!currentPlan) {
        throw new Error('Current plan not found');
      }

      // Get usage analytics
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 30); // Last 30 days
      const analytics = await this.generateUsageAnalytics(businessId, periodStart, new Date());

      // Get all available plans
      const availablePlans = await this.prisma.plan_definitions.findMany({
        where: { is_active: true },
        include: { plan_features: true }
      });

      const recommendations: PlanRecommendation[] = [];

      for (const plan of availablePlans) {
        if (plan.id === currentPlan.id) continue;

        const recommendation = await this.analyzePlanFit(
          businessId,
          currentPlan,
          plan,
          analytics
        );

        if (recommendation) {
          recommendations.push(recommendation);
        }
      }

      // Sort by confidence score and savings potential
      return recommendations.sort((a, b) => {
        const scoreA = a.confidence_score * (a.savings_potential > 0 ? 1.2 : 0.8);
        const scoreB = b.confidence_score * (b.savings_potential > 0 ? 1.2 : 0.8);
        return scoreB - scoreA;
      });

    } catch (error) {
      console.error('Generate plan recommendations error:', error);
      throw error;
    }
  }

  /**
   * Generate usage forecast and predictions
   */
  async generateUsageForecast(
    businessId: string,
    forecastDays: number = 30
  ): Promise<UsageForecast> {
    try {
      const forecastStart = new Date();
      const forecastEnd = new Date();
      forecastEnd.setDate(forecastEnd.getDate() + forecastDays);

      // Get historical usage data
      const historicalData = await this.getHistoricalUsageData(businessId, 90); // Last 90 days

      // Generate predictions for each quota type
      const predictions: Record<string, any> = {};

      for (const quotaType of ['queries', 'embeddings', 'api_calls', 'storage']) {
        const forecast = await this.usageTracking.generateUsageForecast(
          businessId,
          quotaType,
          forecastEnd
        );

        predictions[quotaType] = {
          predicted_usage: forecast.predicted_usage,
          confidence_score: forecast.confidence_score,
          factors: forecast.factors
        };
      }

      // Generate recommendations based on forecast
      const recommendations = await this.generateForecastRecommendations(
        businessId,
        predictions,
        forecastEnd
      );

      return {
        business_id: businessId,
        forecast_period: {
          start: forecastStart,
          end: forecastEnd
        },
        predictions,
        recommendations
      };

    } catch (error) {
      console.error('Generate usage forecast error:', error);
      throw error;
    }
  }

  /**
   * Generate business intelligence insights
   */
  async generateBusinessIntelligence(businessId: string): Promise<BusinessIntelligence> {
    try {
      // Get comprehensive analytics
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 30);
      const analytics = await this.generateUsageAnalytics(businessId, periodStart, new Date());

      // Generate insights
      const insights = await this.generateInsights(businessId, analytics);

      // Calculate KPIs
      const kpis = await this.calculateKPIs(businessId, analytics);

      // Get benchmarks
      const benchmarks = await this.getBenchmarks(businessId, analytics);

      return {
        business_id: businessId,
        insights,
        kpis,
        benchmarks
      };

    } catch (error) {
      console.error('Generate business intelligence error:', error);
      throw error;
    }
  }

  // Private helper methods

  private async calculateUsageTrends(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Record<string, any>> {
    // Get usage data for trend analysis
    const events = await this.prisma.usage_events.findMany({
      where: {
        business_id: businessId,
        created_at: {
          gte: periodStart,
          lte: periodEnd
        }
      },
      orderBy: { created_at: 'asc' }
    });

    const trends: Record<string, any> = {};

    // Group by quota type
    const quotaTypes = ['queries', 'embeddings', 'api_calls', 'storage'];
    
    for (const quotaType of quotaTypes) {
      const quotaEvents = events.filter(event => 
        this.getQuotaTypeForEvent(event.event_type) === quotaType
      );

      if (quotaEvents.length === 0) continue;

      // Calculate trend direction and velocity
      const dailyUsage = this.calculateDailyUsage(quotaEvents);
      const trend = this.calculateTrend(dailyUsage);
      
      trends[quotaType] = {
        direction: trend.direction,
        percentage_change: trend.percentageChange,
        velocity: trend.velocity
      };
    }

    return trends;
  }

  private async analyzePeakUsagePatterns(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Record<string, any>> {
    const events = await this.prisma.usage_events.findMany({
      where: {
        business_id: businessId,
        created_at: {
          gte: periodStart,
          lte: periodEnd
        }
      }
    });

    const patterns: Record<string, any> = {};

    // Analyze hourly patterns
    const hourlyUsage: Record<string, Record<number, number>> = {};
    const dailyUsage: Record<string, Record<string, number>> = {};
    const weeklyUsage: Record<string, Record<number, number>> = {};

    for (const event of events) {
      const quotaType = this.getQuotaTypeForEvent(event.event_type);
      const date = new Date(event.created_at);
      const hour = date.getHours();
      const day = date.toISOString().slice(0, 10);
      const week = this.getWeekNumber(date);

      if (!hourlyUsage[quotaType]) hourlyUsage[quotaType] = {};
      if (!dailyUsage[quotaType]) dailyUsage[quotaType] = {};
      if (!weeklyUsage[quotaType]) weeklyUsage[quotaType] = {};

      hourlyUsage[quotaType][hour] = (hourlyUsage[quotaType][hour] || 0) + event.quantity;
      dailyUsage[quotaType][day] = (dailyUsage[quotaType][day] || 0) + event.quantity;
      weeklyUsage[quotaType][week] = (weeklyUsage[quotaType][week] || 0) + event.quantity;
    }

    // Find peak patterns
    for (const quotaType in hourlyUsage) {
      const peakHour = Object.entries(hourlyUsage[quotaType])
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 0;
      
      const peakDay = Object.entries(dailyUsage[quotaType])
        .sort(([,a], [,b]) => b - a)[0]?.[0] || '';

      const peakWeek = Object.entries(weeklyUsage[quotaType])
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 0;

      patterns[quotaType] = {
        peak_hour: parseInt(peakHour),
        peak_day: peakDay,
        peak_week: parseInt(peakWeek)
      };
    }

    return patterns;
  }

  private async calculateCostAnalysis(
    businessId: string,
    currentPlanId: string
  ): Promise<any> {
    // Get current plan cost
    const currentPlan = await this.prisma.plan_definitions.findUnique({
      where: { id: currentPlanId }
    });

    const currentPlanCost = currentPlan?.price_cents || 0;

    // Get overage costs
    const overageCharges = await this.prisma.overage_charges.findMany({
      where: {
        business_id: businessId,
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    const overageCosts = overageCharges.reduce((sum, charge) => sum + charge.total_charge_cents, 0);

    // Calculate potential savings
    const recommendations = await this.generatePlanRecommendations(businessId);
    const bestRecommendation = recommendations.find(r => r.savings_potential > 0);
    const potentialSavings = bestRecommendation?.savings_potential || 0;

    return {
      current_plan_cost: currentPlanCost,
      overage_costs: overageCosts,
      potential_savings: potentialSavings,
      optimal_plan_suggestion: bestRecommendation?.recommended_plan_id || currentPlanId
    };
  }

  private async analyzeFeatureUtilization(
    businessId: string,
    currentPlanId: string
  ): Promise<Record<string, any>> {
    // Get plan features
    const planFeatures = await this.prisma.plan_features.findMany({
      where: { plan_id: currentPlanId }
    });

    const utilization: Record<string, any> = {};

    for (const feature of planFeatures) {
      if (feature.feature_type === 'limit' && feature.limit_value) {
        // Get current usage for this feature
        const quota = await this.prisma.usage_quotas.findFirst({
          where: {
            business_id: businessId,
            quota_type: feature.feature_key
          }
        });

        const usagePercentage = quota ? (quota.quota_used / feature.limit_value) * 100 : 0;
        
        utilization[feature.feature_key] = {
          usage_percentage: Math.round(usagePercentage),
          underutilized: usagePercentage < 20,
          overutilized: usagePercentage > 90
        };
      }
    }

    return utilization;
  }

  private async analyzePlanFit(
    businessId: string,
    currentPlan: any,
    targetPlan: any,
    analytics: UsageAnalytics
  ): Promise<PlanRecommendation | null> {
    // Calculate fit score
    const fitScore = this.calculatePlanFitScore(currentPlan, targetPlan, analytics);
    
    if (fitScore < 0.3) return null; // Low confidence

    // Calculate savings potential
    const savingsPotential = this.calculateSavingsPotential(currentPlan, targetPlan, analytics);

    // Calculate upgrade cost
    const upgradeCost = Math.max(0, targetPlan.price_cents - currentPlan.price_cents);

    // Analyze feature changes
    const featureChanges = this.analyzeFeatureChanges(currentPlan, targetPlan);

    // Assess risks
    const riskAssessment = this.assessRisks(currentPlan, targetPlan, analytics);

    return {
      business_id: businessId,
      current_plan_id: currentPlan.id,
      recommended_plan_id: targetPlan.id,
      confidence_score: fitScore,
      reasoning: this.generateReasoning(currentPlan, targetPlan, analytics),
      savings_potential: savingsPotential,
      upgrade_cost: upgradeCost,
      feature_gains: featureChanges.gains,
      feature_losses: featureChanges.losses,
      risk_assessment
    };
  }

  private calculatePlanFitScore(currentPlan: any, targetPlan: any, analytics: UsageAnalytics): number {
    // Simple scoring algorithm - can be enhanced with ML
    let score = 0.5; // Base score

    // Usage fit
    const usageFit = this.calculateUsageFit(targetPlan, analytics);
    score += usageFit * 0.3;

    // Cost efficiency
    const costEfficiency = this.calculateCostEfficiency(currentPlan, targetPlan, analytics);
    score += costEfficiency * 0.2;

    // Feature alignment
    const featureAlignment = this.calculateFeatureAlignment(targetPlan, analytics);
    score += featureAlignment * 0.2;

    return Math.min(1.0, Math.max(0.0, score));
  }

  private calculateUsageFit(targetPlan: any, analytics: UsageAnalytics): number {
    // Check if target plan can accommodate current usage
    const planFeatures = targetPlan.plan_features || [];
    let fitScore = 1.0;

    for (const [quotaType, usage] of Object.entries(analytics.total_usage)) {
      const feature = planFeatures.find((f: any) => f.feature_key === quotaType);
      if (feature && feature.limit_value !== -1 && usage > feature.limit_value) {
        fitScore *= 0.5; // Reduce fit if usage exceeds limits
      }
    }

    return fitScore;
  }

  private calculateCostEfficiency(currentPlan: any, targetPlan: any, analytics: UsageAnalytics): number {
    const currentCost = currentPlan.price_cents + analytics.cost_analysis.overage_costs;
    const targetCost = targetPlan.price_cents;
    
    if (targetCost < currentCost) {
      return 1.0; // Cost reduction
    } else if (targetCost > currentCost) {
      return Math.max(0.0, 1.0 - (targetCost - currentCost) / currentCost);
    }
    
    return 0.5; // Same cost
  }

  private calculateFeatureAlignment(targetPlan: any, analytics: UsageAnalytics): number {
    // Check if target plan has features that are underutilized in current plan
    const targetFeatures = targetPlan.plan_features || [];
    let alignmentScore = 0.5;

    for (const [feature, utilization] of Object.entries(analytics.feature_utilization)) {
      const targetFeature = targetFeatures.find((f: any) => f.feature_key === feature);
      if (targetFeature && utilization.underutilized) {
        alignmentScore += 0.1; // Bonus for features that could be better utilized
      }
    }

    return Math.min(1.0, alignmentScore);
  }

  private calculateSavingsPotential(currentPlan: any, targetPlan: any, analytics: UsageAnalytics): number {
    const currentTotalCost = currentPlan.price_cents + analytics.cost_analysis.overage_costs;
    const targetCost = targetPlan.price_cents;
    
    return Math.max(0, currentTotalCost - targetCost);
  }

  private analyzeFeatureChanges(currentPlan: any, targetPlan: any): {
    gains: string[];
    losses: string[];
  } {
    const currentFeatures = currentPlan.plan_features || [];
    const targetFeatures = targetPlan.plan_features || [];

    const gains: string[] = [];
    const losses: string[] = [];

    // Find new features in target plan
    for (const targetFeature of targetFeatures) {
      const currentFeature = currentFeatures.find((f: any) => f.feature_key === targetFeature.feature_key);
      if (!currentFeature || this.isFeatureUpgrade(currentFeature, targetFeature)) {
        gains.push(targetFeature.feature_key);
      }
    }

    // Find lost features
    for (const currentFeature of currentFeatures) {
      const targetFeature = targetFeatures.find((f: any) => f.feature_key === currentFeature.feature_key);
      if (!targetFeature || this.isFeatureDowngrade(currentFeature, targetFeature)) {
        losses.push(currentFeature.feature_key);
      }
    }

    return { gains, losses };
  }

  private isFeatureUpgrade(currentFeature: any, targetFeature: any): boolean {
    if (currentFeature.feature_type === 'limit' && targetFeature.feature_type === 'limit') {
      return targetFeature.limit_value > currentFeature.limit_value;
    }
    if (currentFeature.feature_type === 'boolean' && targetFeature.feature_type === 'boolean') {
      return !currentFeature.boolean_value && targetFeature.boolean_value;
    }
    return false;
  }

  private isFeatureDowngrade(currentFeature: any, targetFeature: any): boolean {
    if (currentFeature.feature_type === 'limit' && targetFeature.feature_type === 'limit') {
      return targetFeature.limit_value < currentFeature.limit_value;
    }
    if (currentFeature.feature_type === 'boolean' && targetFeature.feature_type === 'boolean') {
      return currentFeature.boolean_value && !targetFeature.boolean_value;
    }
    return false;
  }

  private assessRisks(currentPlan: any, targetPlan: any, analytics: UsageAnalytics): {
    downgrade_risk: 'low' | 'medium' | 'high';
    overage_risk: 'low' | 'medium' | 'high';
    feature_risk: 'low' | 'medium' | 'high';
  } {
    const downgradeRisk = targetPlan.price_cents < currentPlan.price_cents ? 'medium' : 'low';
    
    let overageRisk = 'low';
    if (targetPlan.price_cents < currentPlan.price_cents) {
      // Check if downgrade might cause overages
      const hasOverageRisk = Object.values(analytics.feature_utilization).some(
        (util: any) => util.overutilized
      );
      overageRisk = hasOverageRisk ? 'high' : 'medium';
    }

    const featureRisk = this.assessFeatureRisk(currentPlan, targetPlan);

    return {
      downgrade_risk: downgradeRisk as 'low' | 'medium' | 'high',
      overage_risk: overageRisk as 'low' | 'medium' | 'high',
      feature_risk: featureRisk as 'low' | 'medium' | 'high'
    };
  }

  private assessFeatureRisk(currentPlan: any, targetPlan: any): 'low' | 'medium' | 'high' {
    const currentFeatures = currentPlan.plan_features || [];
    const targetFeatures = targetPlan.plan_features || [];

    let riskScore = 0;
    
    for (const currentFeature of currentFeatures) {
      const targetFeature = targetFeatures.find((f: any) => f.feature_key === currentFeature.feature_key);
      if (!targetFeature) {
        riskScore += 1; // Feature completely removed
      } else if (this.isFeatureDowngrade(currentFeature, targetFeature)) {
        riskScore += 0.5; // Feature downgraded
      }
    }

    if (riskScore >= 2) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  private generateReasoning(currentPlan: any, targetPlan: any, analytics: UsageAnalytics): string[] {
    const reasoning: string[] = [];

    // Cost-based reasoning
    if (targetPlan.price_cents < currentPlan.price_cents) {
      reasoning.push(`Could save $${(currentPlan.price_cents - targetPlan.price_cents) / 100} per month`);
    } else if (targetPlan.price_cents > currentPlan.price_cents) {
      reasoning.push(`Additional cost of $${(targetPlan.price_cents - currentPlan.price_cents) / 100} per month`);
    }

    // Usage-based reasoning
    const overutilizedFeatures = Object.entries(analytics.feature_utilization)
      .filter(([, util]: [string, any]) => util.overutilized)
      .map(([feature]) => feature);

    if (overutilizedFeatures.length > 0) {
      reasoning.push(`Currently overutilizing: ${overutilizedFeatures.join(', ')}`);
    }

    // Feature-based reasoning
    const featureChanges = this.analyzeFeatureChanges(currentPlan, targetPlan);
    if (featureChanges.gains.length > 0) {
      reasoning.push(`Gains access to: ${featureChanges.gains.join(', ')}`);
    }
    if (featureChanges.losses.length > 0) {
      reasoning.push(`Loses access to: ${featureChanges.losses.join(', ')}`);
    }

    return reasoning;
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

  private calculateDailyUsage(events: any[]): Record<string, number> {
    const dailyUsage: Record<string, number> = {};
    
    for (const event of events) {
      const day = new Date(event.created_at).toISOString().slice(0, 10);
      dailyUsage[day] = (dailyUsage[day] || 0) + event.quantity;
    }
    
    return dailyUsage;
  }

  private calculateTrend(dailyUsage: Record<string, number>): {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentageChange: number;
    velocity: number;
  } {
    const days = Object.keys(dailyUsage).sort();
    if (days.length < 2) {
      return { direction: 'stable', percentageChange: 0, velocity: 0 };
    }

    const firstWeek = days.slice(0, Math.min(7, days.length));
    const lastWeek = days.slice(-7);

    const firstWeekAvg = firstWeek.reduce((sum, day) => sum + (dailyUsage[day] || 0), 0) / firstWeek.length;
    const lastWeekAvg = lastWeek.reduce((sum, day) => sum + (dailyUsage[day] || 0), 0) / lastWeek.length;

    const percentageChange = firstWeekAvg === 0 ? 0 : ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100;
    const velocity = lastWeekAvg;

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (percentageChange > 10) direction = 'increasing';
    else if (percentageChange < -10) direction = 'decreasing';

    return { direction, percentageChange, velocity };
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private async getHistoricalUsageData(businessId: string, days: number): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.prisma.usage_events.findMany({
      where: {
        business_id: businessId,
        created_at: { gte: startDate }
      },
      orderBy: { created_at: 'asc' }
    });
  }

  private async generateForecastRecommendations(
    businessId: string,
    predictions: Record<string, any>,
    forecastEnd: Date
  ): Promise<any> {
    // Analyze predictions and generate recommendations
    const totalPredictedUsage = Object.values(predictions).reduce(
      (sum: number, pred: any) => sum + pred.predicted_usage, 0
    );

    const avgConfidence = Object.values(predictions).reduce(
      (sum: number, pred: any) => sum + pred.confidence_score, 0
    ) / Object.keys(predictions).length;

    let planSuggestion = 'current';
    let riskLevel = 'low';
    let actionRequired = false;
    let timeline = 'No immediate action needed';

    if (totalPredictedUsage > 10000 && avgConfidence > 0.7) {
      planSuggestion = 'upgrade';
      riskLevel = 'high';
      actionRequired = true;
      timeline = 'Consider upgrading within 7 days';
    } else if (totalPredictedUsage < 1000 && avgConfidence > 0.7) {
      planSuggestion = 'downgrade';
      riskLevel = 'medium';
      actionRequired = true;
      timeline = 'Consider downgrading at next billing cycle';
    }

    return {
      plan_suggestion: planSuggestion,
      risk_level: riskLevel,
      action_required: actionRequired,
      timeline
    };
  }

  private async generateInsights(businessId: string, analytics: UsageAnalytics): Promise<any[]> {
    const insights: any[] = [];

    // Usage pattern insights
    const overutilizedFeatures = Object.entries(analytics.feature_utilization)
      .filter(([, util]: [string, any]) => util.overutilized);

    if (overutilizedFeatures.length > 0) {
      insights.push({
        type: 'usage_pattern',
        title: 'High Usage Detected',
        description: `You're approaching limits on ${overutilizedFeatures.map(([f]) => f).join(', ')}`,
        impact: 'high',
        actionable: true,
        recommendations: ['Consider upgrading your plan', 'Optimize usage patterns', 'Contact support for custom limits']
      });
    }

    // Cost optimization insights
    if (analytics.cost_analysis.overage_costs > 0) {
      insights.push({
        type: 'cost_optimization',
        title: 'Overage Charges Detected',
        description: `You've incurred $${analytics.cost_analysis.overage_costs / 100} in overage charges`,
        impact: 'medium',
        actionable: true,
        recommendations: ['Upgrade to a higher plan', 'Monitor usage more closely', 'Set up usage alerts']
      });
    }

    // Feature gap insights
    const underutilizedFeatures = Object.entries(analytics.feature_utilization)
      .filter(([, util]: [string, any]) => util.underutilized);

    if (underutilizedFeatures.length > 0) {
      insights.push({
        type: 'feature_gap',
        title: 'Underutilized Features',
        description: `You're not fully utilizing ${underutilizedFeatures.map(([f]) => f).join(', ')}`,
        impact: 'low',
        actionable: true,
        recommendations: ['Explore feature documentation', 'Contact support for training', 'Consider downgrading if not needed']
      });
    }

    return insights;
  }

  private async calculateKPIs(businessId: string, analytics: UsageAnalytics): Promise<any> {
    // Calculate key performance indicators
    const totalUsage = Object.values(analytics.total_usage).reduce((sum, usage) => sum + usage, 0);
    const totalLimits = Object.values(analytics.feature_utilization).reduce(
      (sum, util: any) => sum + (util.usage_percentage || 0), 0
    );

    return {
      usage_efficiency: Math.min(100, totalLimits / Object.keys(analytics.feature_utilization).length),
      cost_effectiveness: analytics.cost_analysis.overage_costs > 0 ? 50 : 100,
      feature_adoption: Object.values(analytics.feature_utilization).filter(
        (util: any) => util.usage_percentage > 0
      ).length / Object.keys(analytics.feature_utilization).length * 100,
      growth_velocity: Object.values(analytics.usage_trends).filter(
        (trend: any) => trend.direction === 'increasing'
      ).length / Object.keys(analytics.usage_trends).length * 100
    };
  }

  private async getBenchmarks(businessId: string, analytics: UsageAnalytics): Promise<any> {
    // Get industry benchmarks (simplified)
    const industryAverages = {
      usage_efficiency: 75,
      cost_effectiveness: 80,
      feature_adoption: 60,
      growth_velocity: 15
    };

    const kpis = await this.calculateKPIs(businessId, analytics);
    
    const peerComparison = {
      usage_efficiency: (kpis.usage_efficiency / industryAverages.usage_efficiency) * 100,
      cost_effectiveness: (kpis.cost_effectiveness / industryAverages.cost_effectiveness) * 100,
      feature_adoption: (kpis.feature_adoption / industryAverages.feature_adoption) * 100,
      growth_velocity: (kpis.growth_velocity / industryAverages.growth_velocity) * 100
    };

    const overallScore = Object.values(peerComparison).reduce((sum, score) => sum + score, 0) / 4;
    
    let performanceRating = 'below_average';
    if (overallScore >= 120) performanceRating = 'excellent';
    else if (overallScore >= 100) performanceRating = 'above_average';
    else if (overallScore >= 80) performanceRating = 'average';

    return {
      industry_average: industryAverages,
      peer_comparison: peerComparison,
      performance_rating: performanceRating
    };
  }
}
