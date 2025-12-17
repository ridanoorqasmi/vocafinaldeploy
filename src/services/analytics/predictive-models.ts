import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ==============================================
// PREDICTIVE ANALYTICS MODELS
// ==============================================

export interface ChurnPredictionInput {
  usage_trend_last_30_days: number;
  payment_failure_history: number;
  support_ticket_frequency: number;
  feature_adoption_rate: number;
  login_frequency_decline: number;
  plan_utilization_percentage: number;
  days_since_last_login: number;
  subscription_age_months: number;
  plan_id: string;
  total_revenue_cents: number;
}

export interface ChurnPredictionResult {
  business_id: string;
  churn_probability: number;
  confidence_score: number;
  prediction_horizon_days: number;
  risk_factors: string[];
  recommended_actions: string[];
}

export interface RevenueForecastInput {
  historical_mrr_growth: number[];
  seasonal_patterns: Record<string, number>;
  churn_rate_trends: number[];
  new_customer_acquisition: number[];
  expansion_revenue_trends: number[];
  market_conditions: Record<string, any>;
}

export interface RevenueForecastResult {
  forecast_date: Date;
  forecast_horizon_months: number;
  predicted_mrr_cents: number;
  predicted_arr_cents: number;
  confidence_score: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  growth_rate: number;
  key_assumptions: string[];
}

export interface ExpansionOpportunityInput {
  current_usage_vs_limit: number;
  usage_growth_trajectory: number;
  feature_engagement_score: number;
  support_interaction_sentiment: number;
  payment_history_reliability: number;
  plan_utilization_percentage: number;
  business_size_indicators: Record<string, any>;
}

export interface ExpansionOpportunityResult {
  business_id: string;
  opportunity_type: 'upgrade' | 'addon' | 'usage_increase';
  current_plan_id: string;
  recommended_plan_id?: string;
  potential_revenue_increase_cents: number;
  probability_of_conversion: number;
  urgency_score: number;
  recommended_actions: string[];
  timing_recommendation: string;
}

export class PredictiveAnalyticsModels {
  /**
   * Predict customer churn using gradient boosting approach
   */
  async predictChurn(businessId: string, predictionHorizonDays: number = 30): Promise<ChurnPredictionResult> {
    // Gather input features
    const inputFeatures = await this.gatherChurnInputFeatures(businessId);
    
    // Apply gradient boosting model (simplified implementation)
    const churnProbability = await this.applyChurnModel(inputFeatures);
    
    // Calculate confidence score
    const confidenceScore = this.calculateChurnConfidence(inputFeatures);
    
    // Identify risk factors
    const riskFactors = this.identifyChurnRiskFactors(inputFeatures);
    
    // Generate recommended actions
    const recommendedActions = this.generateChurnPreventionActions(inputFeatures, churnProbability);

    return {
      business_id: businessId,
      churn_probability: churnProbability,
      confidence_score: confidenceScore,
      prediction_horizon_days: predictionHorizonDays,
      risk_factors: riskFactors,
      recommended_actions: recommendedActions
    };
  }

  /**
   * Forecast revenue using LSTM-like time series approach
   */
  async forecastRevenue(
    forecastHorizonMonths: number = 12,
    inputFeatures?: RevenueForecastInput
  ): Promise<RevenueForecastResult> {
    // Gather historical data if not provided
    const features = inputFeatures || await this.gatherRevenueForecastInputs();
    
    // Apply time series forecasting model
    const forecast = await this.applyRevenueForecastModel(features, forecastHorizonMonths);
    
    // Calculate confidence intervals
    const confidenceInterval = this.calculateRevenueConfidenceInterval(forecast, features);
    
    // Generate key assumptions
    const keyAssumptions = this.generateRevenueForecastAssumptions(features);

    return {
      forecast_date: new Date(),
      forecast_horizon_months: forecastHorizonMonths,
      predicted_mrr_cents: forecast.predicted_mrr,
      predicted_arr_cents: forecast.predicted_arr,
      confidence_score: forecast.confidence,
      confidence_interval_lower: confidenceInterval.lower,
      confidence_interval_upper: confidenceInterval.upper,
      growth_rate: forecast.growth_rate,
      key_assumptions: keyAssumptions
    };
  }

  /**
   * Identify expansion opportunities using machine learning
   */
  async identifyExpansionOpportunities(businessId: string): Promise<ExpansionOpportunityResult[]> {
    // Gather input features for expansion analysis
    const inputFeatures = await this.gatherExpansionInputFeatures(businessId);
    
    // Apply expansion opportunity model
    const opportunities = await this.applyExpansionModel(inputFeatures, businessId);
    
    return opportunities;
  }

  /**
   * Batch process churn predictions for all customers
   */
  async batchPredictChurn(predictionHorizonDays: number = 30): Promise<ChurnPredictionResult[]> {
    const businesses = await prisma.business.findMany({
      where: {
        subscriptions: {
          some: { status: 'ACTIVE' }
        }
      },
      select: { id: true }
    });

    const predictions: ChurnPredictionResult[] = [];
    
    // Process in batches to avoid memory issues
    const batchSize = 50;
    for (let i = 0; i < businesses.length; i += batchSize) {
      const batch = businesses.slice(i, i + batchSize);
      
      const batchPromises = batch.map(business => 
        this.predictChurn(business.id, predictionHorizonDays)
      );
      
      const batchResults = await Promise.all(batchPromises);
      predictions.push(...batchResults);
    }

    return predictions;
  }

  /**
   * Store prediction results in database
   */
  async storeChurnPrediction(prediction: ChurnPredictionResult): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO customer_predictions (
        business_id,
        prediction_type,
        prediction_horizon_days,
        probability,
        confidence_score,
        input_features,
        model_version
      ) VALUES (
        ${prediction.business_id}::UUID,
        'churn',
        ${prediction.prediction_horizon_days},
        ${prediction.churn_probability},
        ${prediction.confidence_score},
        ${JSON.stringify({
          risk_factors: prediction.risk_factors,
          recommended_actions: prediction.recommended_actions
        })}::JSONB,
        'v1.0'
      )
    `;
  }

  /**
   * Store revenue forecast in database
   */
  async storeRevenueForecast(forecast: RevenueForecastResult): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO revenue_forecasts (
        forecast_date,
        forecast_horizon_months,
        predicted_mrr_cents,
        predicted_arr_cents,
        confidence_score,
        model_version,
        input_features
      ) VALUES (
        ${forecast.forecast_date}::DATE,
        ${forecast.forecast_horizon_months},
        ${forecast.predicted_mrr_cents},
        ${forecast.predicted_arr_cents},
        ${forecast.confidence_score},
        'v1.0',
        ${JSON.stringify({
          growth_rate: forecast.growth_rate,
          key_assumptions: forecast.key_assumptions
        })}::JSONB
      )
    `;
  }

  /**
   * Store expansion opportunities in database
   */
  async storeExpansionOpportunities(opportunities: ExpansionOpportunityResult[]): Promise<void> {
    for (const opportunity of opportunities) {
      await prisma.$executeRaw`
        INSERT INTO expansion_opportunities (
          business_id,
          opportunity_type,
          current_plan_id,
          recommended_plan_id,
          potential_revenue_increase_cents,
          probability_of_conversion,
          urgency_score,
          recommended_actions
        ) VALUES (
          ${opportunity.business_id}::UUID,
          ${opportunity.opportunity_type},
          ${opportunity.current_plan_id},
          ${opportunity.recommended_plan_id || null},
          ${opportunity.potential_revenue_increase_cents},
          ${opportunity.probability_of_conversion},
          ${opportunity.urgency_score},
          ${JSON.stringify(opportunity.recommended_actions)}::JSONB
        )
      `;
    }
  }

  // ==============================================
  // HELPER METHODS
  // ==============================================

  private async gatherChurnInputFeatures(businessId: string): Promise<ChurnPredictionInput> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Get usage trend
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

    const usageTrend = previousUsage > 0 ? (recentUsage - previousUsage) / previousUsage : 0;

    // Get payment failure history
    const paymentFailures = await prisma.$queryRaw<number>`
      SELECT COUNT(*)
      FROM payment_history
      WHERE business_id = ${businessId}::UUID
        AND status = 'failed'
        AND processed_at >= NOW() - INTERVAL '90 days'
    `;

    // Get support ticket frequency
    const supportTickets = await prisma.queryLog.count({
      where: {
        businessId,
        status: 'ERROR',
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    // Get feature adoption rate (simplified)
    const featureAdoptionRate = await this.calculateFeatureAdoptionRate(businessId);

    // Get login frequency decline
    const loginFrequencyDecline = await this.calculateLoginFrequencyDecline(businessId);

    // Get plan utilization percentage
    const planUtilization = await this.calculatePlanUtilization(businessId);

    // Get days since last login
    const daysSinceLastLogin = await this.getDaysSinceLastLogin(businessId);

    // Get subscription age
    const subscriptionAge = await this.getSubscriptionAgeMonths(businessId);

    // Get current plan and total revenue
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscriptions: { where: { status: 'ACTIVE' } }
      }
    });

    const currentPlanId = business?.subscriptions[0]?.planId || 'free';
    const totalRevenue = await this.getTotalRevenue(businessId);

    return {
      usage_trend_last_30_days: usageTrend,
      payment_failure_history: paymentFailures,
      support_ticket_frequency: supportTickets,
      feature_adoption_rate: featureAdoptionRate,
      login_frequency_decline: loginFrequencyDecline,
      plan_utilization_percentage: planUtilization,
      days_since_last_login: daysSinceLastLogin,
      subscription_age_months: subscriptionAge,
      plan_id: currentPlanId,
      total_revenue_cents: totalRevenue
    };
  }

  private async applyChurnModel(features: ChurnPredictionInput): Promise<number> {
    // Simplified gradient boosting model implementation
    // In a real implementation, this would use a trained ML model
    
    let probability = 0.1; // Base churn rate

    // Usage trend factor
    if (features.usage_trend_last_30_days < -0.3) probability += 0.3;
    else if (features.usage_trend_last_30_days < -0.1) probability += 0.15;
    else if (features.usage_trend_last_30_days < 0) probability += 0.05;

    // Payment failure factor
    if (features.payment_failure_history > 3) probability += 0.25;
    else if (features.payment_failure_history > 1) probability += 0.15;
    else if (features.payment_failure_history > 0) probability += 0.05;

    // Support ticket factor
    if (features.support_ticket_frequency > 5) probability += 0.2;
    else if (features.support_ticket_frequency > 2) probability += 0.1;
    else if (features.support_ticket_frequency > 0) probability += 0.05;

    // Feature adoption factor
    if (features.feature_adoption_rate < 0.3) probability += 0.15;
    else if (features.feature_adoption_rate < 0.5) probability += 0.1;

    // Login frequency factor
    if (features.login_frequency_decline > 0.5) probability += 0.2;
    else if (features.login_frequency_decline > 0.2) probability += 0.1;

    // Plan utilization factor
    if (features.plan_utilization_percentage > 0.9) probability += 0.1; // Over-utilization stress
    else if (features.plan_utilization_percentage < 0.1) probability += 0.15; // Under-utilization

    // Days since last login factor
    if (features.days_since_last_login > 30) probability += 0.2;
    else if (features.days_since_last_login > 14) probability += 0.1;
    else if (features.days_since_last_login > 7) probability += 0.05;

    // Subscription age factor (new customers more likely to churn)
    if (features.subscription_age_months < 1) probability += 0.1;
    else if (features.subscription_age_months < 3) probability += 0.05;

    // Plan type factor
    if (features.plan_id === 'free') probability += 0.1;
    else if (features.plan_id === 'starter') probability += 0.05;

    return Math.min(0.95, Math.max(0.01, probability));
  }

  private calculateChurnConfidence(features: ChurnPredictionInput): number {
    // Calculate confidence based on data quality and feature completeness
    let confidence = 0.8; // Base confidence

    // Adjust based on data availability
    if (features.subscription_age_months < 1) confidence -= 0.2;
    if (features.total_revenue_cents === 0) confidence -= 0.1;
    if (features.days_since_last_login > 30) confidence -= 0.1;

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private identifyChurnRiskFactors(features: ChurnPredictionInput): string[] {
    const riskFactors: string[] = [];

    if (features.usage_trend_last_30_days < -0.2) {
      riskFactors.push('Declining usage trend');
    }

    if (features.payment_failure_history > 2) {
      riskFactors.push('Multiple payment failures');
    }

    if (features.support_ticket_frequency > 3) {
      riskFactors.push('High support ticket volume');
    }

    if (features.feature_adoption_rate < 0.3) {
      riskFactors.push('Low feature adoption');
    }

    if (features.login_frequency_decline > 0.3) {
      riskFactors.push('Decreasing login frequency');
    }

    if (features.plan_utilization_percentage > 0.9) {
      riskFactors.push('Plan over-utilization');
    }

    if (features.days_since_last_login > 14) {
      riskFactors.push('Inactive for extended period');
    }

    if (features.subscription_age_months < 1) {
      riskFactors.push('New customer (high early churn risk)');
    }

    return riskFactors;
  }

  private generateChurnPreventionActions(features: ChurnPredictionInput, churnProbability: number): string[] {
    const actions: string[] = [];

    if (churnProbability > 0.7) {
      actions.push('Immediate intervention: Assign dedicated customer success manager');
      actions.push('Schedule retention call within 24 hours');
      actions.push('Offer personalized onboarding or training session');
    } else if (churnProbability > 0.5) {
      actions.push('Schedule proactive check-in call');
      actions.push('Send personalized usage optimization tips');
      actions.push('Offer plan upgrade with discount');
    } else if (churnProbability > 0.3) {
      actions.push('Send educational content about advanced features');
      actions.push('Invite to upcoming product webinar');
    }

    if (features.usage_trend_last_30_days < -0.2) {
      actions.push('Analyze usage patterns and provide optimization recommendations');
      actions.push('Offer additional training or onboarding support');
    }

    if (features.payment_failure_history > 1) {
      actions.push('Contact customer about payment method update');
      actions.push('Offer flexible payment options');
    }

    if (features.support_ticket_frequency > 2) {
      actions.push('Review and resolve outstanding support issues');
      actions.push('Provide proactive technical support');
    }

    if (features.feature_adoption_rate < 0.3) {
      actions.push('Send feature discovery emails');
      actions.push('Offer personalized feature walkthrough');
    }

    return actions;
  }

  private async gatherRevenueForecastInputs(): Promise<RevenueForecastInput> {
    // Get historical MRR data
    const mrrHistory = await prisma.$queryRaw<{ total_mrr_cents: number, snapshot_date: Date }[]>`
      SELECT total_mrr_cents, snapshot_date
      FROM mrr_snapshots
      ORDER BY snapshot_date DESC
      LIMIT 12
    `;

    const historicalMRRGrowth = mrrHistory.map((record, index) => {
      if (index === 0) return 0;
      const previous = mrrHistory[index - 1];
      return (record.total_mrr_cents - previous.total_mrr_cents) / previous.total_mrr_cents;
    });

    // Get seasonal patterns (simplified)
    const seasonalPatterns = {
      'Q1': 0.95, // Slight dip in Q1
      'Q2': 1.05, // Growth in Q2
      'Q3': 1.02, // Steady growth in Q3
      'Q4': 1.08  // Strong growth in Q4
    };

    // Get churn rate trends
    const churnRateTrends = await this.calculateChurnRateTrends();

    // Get new customer acquisition trends
    const newCustomerAcquisition = await this.calculateNewCustomerAcquisitionTrends();

    // Get expansion revenue trends
    const expansionRevenueTrends = await this.calculateExpansionRevenueTrends();

    return {
      historical_mrr_growth: historicalMRRGrowth,
      seasonal_patterns: seasonalPatterns,
      churn_rate_trends: churnRateTrends,
      new_customer_acquisition: newCustomerAcquisition,
      expansion_revenue_trends: expansionRevenueTrends,
      market_conditions: {
        economic_indicators: 'stable',
        competitive_landscape: 'moderate',
        technology_adoption: 'increasing'
      }
    };
  }

  private async applyRevenueForecastModel(
    features: RevenueForecastInput,
    forecastHorizonMonths: number
  ): Promise<{
    predicted_mrr: number;
    predicted_arr: number;
    confidence: number;
    growth_rate: number;
  }> {
    // Simplified LSTM-like forecasting
    const currentMRR = features.historical_mrr_growth[0] || 0;
    const averageGrowthRate = features.historical_mrr_growth.reduce((sum, rate) => sum + rate, 0) / features.historical_mrr_growth.length;
    
    // Apply seasonal adjustments
    const currentQuarter = this.getCurrentQuarter();
    const seasonalMultiplier = features.seasonal_patterns[currentQuarter] || 1.0;
    
    // Calculate predicted MRR
    const baseGrowthRate = Math.max(0.02, averageGrowthRate); // Minimum 2% growth
    const adjustedGrowthRate = baseGrowthRate * seasonalMultiplier;
    
    const predictedMRR = currentMRR * Math.pow(1 + adjustedGrowthRate, forecastHorizonMonths);
    const predictedARR = predictedMRR * 12;
    
    // Calculate confidence based on data quality and trends
    const confidence = this.calculateRevenueForecastConfidence(features);
    
    return {
      predicted_mrr: Math.round(predictedMRR),
      predicted_arr: Math.round(predictedARR),
      confidence,
      growth_rate: adjustedGrowthRate
    };
  }

  private calculateRevenueConfidenceInterval(
    forecast: any,
    features: RevenueForecastInput
  ): { lower: number; upper: number } {
    const confidenceLevel = 0.8; // 80% confidence interval
    const margin = forecast.predicted_mrr * (1 - forecast.confidence) * 0.5;
    
    return {
      lower: Math.max(0, forecast.predicted_mrr - margin),
      upper: forecast.predicted_mrr + margin
    };
  }

  private generateRevenueForecastAssumptions(features: RevenueForecastInput): string[] {
    const assumptions: string[] = [];
    
    assumptions.push('Current market conditions remain stable');
    assumptions.push('No major competitive disruptions');
    assumptions.push('Customer acquisition costs remain within historical ranges');
    assumptions.push('Churn rates remain at current levels');
    assumptions.push('Seasonal patterns continue as observed');
    
    if (features.market_conditions.economic_indicators === 'declining') {
      assumptions.push('Economic conditions may impact growth rates');
    }
    
    return assumptions;
  }

  private async gatherExpansionInputFeatures(businessId: string): Promise<ExpansionOpportunityInput> {
    // Get current usage vs limit
    const currentUsageVsLimit = await this.calculateCurrentUsageVsLimit(businessId);
    
    // Get usage growth trajectory
    const usageGrowthTrajectory = await this.calculateUsageGrowthTrajectory(businessId);
    
    // Get feature engagement score
    const featureEngagementScore = await this.calculateFeatureEngagementScore(businessId);
    
    // Get support interaction sentiment
    const supportSentiment = await this.calculateSupportSentiment(businessId);
    
    // Get payment history reliability
    const paymentReliability = await this.calculatePaymentReliability(businessId);
    
    // Get plan utilization percentage
    const planUtilization = await this.calculatePlanUtilization(businessId);
    
    // Get business size indicators
    const businessSizeIndicators = await this.getBusinessSizeIndicators(businessId);

    return {
      current_usage_vs_limit: currentUsageVsLimit,
      usage_growth_trajectory: usageGrowthTrajectory,
      feature_engagement_score: featureEngagementScore,
      support_interaction_sentiment: supportSentiment,
      payment_history_reliability: paymentReliability,
      plan_utilization_percentage: planUtilization,
      business_size_indicators: businessSizeIndicators
    };
  }

  private async applyExpansionModel(
    features: ExpansionOpportunityInput,
    businessId: string
  ): Promise<ExpansionOpportunityResult[]> {
    const opportunities: ExpansionOpportunityResult[] = [];
    
    // Get current plan
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscriptions: { where: { status: 'ACTIVE' } }
      }
    });

    if (!business || business.subscriptions.length === 0) {
      return opportunities;
    }

    const currentPlanId = business.subscriptions[0].planId;

    // Check for upgrade opportunity
    if (this.shouldRecommendUpgrade(features, currentPlanId)) {
      const upgradeOpportunity = await this.createUpgradeOpportunity(features, businessId, currentPlanId);
      opportunities.push(upgradeOpportunity);
    }

    // Check for usage increase opportunity
    if (this.shouldRecommendUsageIncrease(features)) {
      const usageOpportunity = await this.createUsageIncreaseOpportunity(features, businessId);
      opportunities.push(usageOpportunity);
    }

    // Check for addon opportunity
    if (this.shouldRecommendAddon(features)) {
      const addonOpportunity = await this.createAddonOpportunity(features, businessId);
      opportunities.push(addonOpportunity);
    }

    return opportunities;
  }

  // Additional helper methods for feature calculation
  private async calculateFeatureAdoptionRate(businessId: string): Promise<number> {
    // Simplified feature adoption calculation
    const totalFeatures = 10; // Total available features
    const adoptedFeatures = await prisma.queryLog.findMany({
      where: {
        businessId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      select: { query: true },
      distinct: ['query']
    });

    return Math.min(1, adoptedFeatures.length / totalFeatures);
  }

  private async calculateLoginFrequencyDecline(businessId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const recentLogins = await prisma.queryLog.count({
      where: {
        businessId,
        createdAt: { gte: sevenDaysAgo }
      }
    });

    const previousLogins = await prisma.queryLog.count({
      where: {
        businessId,
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }
      }
    });

    if (previousLogins === 0) return 0;
    return Math.max(0, (previousLogins - recentLogins) / previousLogins);
  }

  private async calculatePlanUtilization(businessId: string): Promise<number> {
    // Get current plan limits
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        subscriptions: { where: { status: 'ACTIVE' } }
      }
    });

    if (!business || business.subscriptions.length === 0) return 0;

    const planId = business.subscriptions[0].planId;
    
    // Get plan features to determine limits
    const planFeatures = await prisma.$queryRaw<{ limit_value: number }[]>`
      SELECT limit_value
      FROM plan_features
      WHERE plan_id = ${planId}
        AND feature_key = 'queries_per_month'
    `;

    if (planFeatures.length === 0) return 0;

    const monthlyLimit = planFeatures[0].limit_value;
    if (monthlyLimit === -1) return 0.5; // Unlimited plan

    // Get current usage
    const currentUsage = await prisma.queryLog.count({
      where: {
        businessId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    return Math.min(1, currentUsage / monthlyLimit);
  }

  private async getDaysSinceLastLogin(businessId: string): Promise<number> {
    const lastQuery = await prisma.queryLog.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (!lastQuery) return 999;

    const diffTime = Date.now() - lastQuery.createdAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  private async getSubscriptionAgeMonths(businessId: string): Promise<number> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        businessId,
        status: 'ACTIVE'
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    });

    if (!subscription) return 0;

    const diffTime = Date.now() - subscription.createdAt.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
  }

  private async getTotalRevenue(businessId: string): Promise<number> {
    const result = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payment_history
      WHERE business_id = ${businessId}::UUID
        AND status = 'succeeded'
    `;

    return result[0]?.total || 0;
  }

  // Additional helper methods for expansion opportunities
  private shouldRecommendUpgrade(features: ExpansionOpportunityInput, currentPlanId: string): boolean {
    return features.plan_utilization_percentage > 0.8 && 
           features.usage_growth_trajectory > 0.1 &&
           features.payment_history_reliability > 0.9 &&
           currentPlanId !== 'enterprise';
  }

  private shouldRecommendUsageIncrease(features: ExpansionOpportunityInput): boolean {
    return features.current_usage_vs_limit > 0.9 &&
           features.usage_growth_trajectory > 0.05;
  }

  private shouldRecommendAddon(features: ExpansionOpportunityInput): boolean {
    return features.feature_engagement_score > 0.7 &&
           features.plan_utilization_percentage > 0.6;
  }

  private async createUpgradeOpportunity(
    features: ExpansionOpportunityInput,
    businessId: string,
    currentPlanId: string
  ): Promise<ExpansionOpportunityResult> {
    // Determine recommended plan
    const planHierarchy = ['free', 'starter', 'pro', 'business', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlanId);
    const recommendedPlanId = planHierarchy[Math.min(currentIndex + 1, planHierarchy.length - 1)];

    // Calculate potential revenue increase
    const planPrices: Record<string, number> = {
      'free': 0,
      'starter': 2900,
      'pro': 9900,
      'business': 29900,
      'enterprise': 0
    };

    const currentPrice = planPrices[currentPlanId] || 0;
    const recommendedPrice = planPrices[recommendedPlanId] || 0;
    const potentialIncrease = recommendedPrice - currentPrice;

    return {
      business_id: businessId,
      opportunity_type: 'upgrade',
      current_plan_id: currentPlanId,
      recommended_plan_id: recommendedPlanId,
      potential_revenue_increase_cents: potentialIncrease,
      probability_of_conversion: Math.min(0.8, features.plan_utilization_percentage * 1.2),
      urgency_score: features.plan_utilization_percentage > 0.95 ? 90 : 70,
      recommended_actions: [
        'Schedule upgrade consultation call',
        'Provide detailed feature comparison',
        'Offer limited-time upgrade discount'
      ],
      timing_recommendation: 'Within 30 days'
    };
  }

  private async createUsageIncreaseOpportunity(
    features: ExpansionOpportunityInput,
    businessId: string
  ): Promise<ExpansionOpportunityResult> {
    return {
      business_id: businessId,
      opportunity_type: 'usage_increase',
      current_plan_id: 'current',
      potential_revenue_increase_cents: 0, // Usage-based pricing
      probability_of_conversion: 0.6,
      urgency_score: 60,
      recommended_actions: [
        'Provide usage optimization tips',
        'Offer usage monitoring dashboard',
        'Suggest efficiency improvements'
      ],
      timing_recommendation: 'Ongoing'
    };
  }

  private async createAddonOpportunity(
    features: ExpansionOpportunityInput,
    businessId: string
  ): Promise<ExpansionOpportunityResult> {
    return {
      business_id: businessId,
      opportunity_type: 'addon',
      current_plan_id: 'current',
      potential_revenue_increase_cents: 5000, // Estimated addon value
      probability_of_conversion: 0.5,
      urgency_score: 50,
      recommended_actions: [
        'Present addon feature benefits',
        'Offer addon trial period',
        'Provide implementation support'
      ],
      timing_recommendation: 'Within 60 days'
    };
  }

  // Additional helper methods for revenue forecasting
  private async calculateChurnRateTrends(): Promise<number[]> {
    // Simplified churn rate calculation
    return [0.05, 0.04, 0.06, 0.05, 0.03]; // Last 5 months
  }

  private async calculateNewCustomerAcquisitionTrends(): Promise<number[]> {
    // Get new customer counts for last 5 months
    const monthlyAcquisitions = await prisma.$queryRaw<{ month: string, count: number }[]>`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM businesses
      WHERE created_at >= NOW() - INTERVAL '5 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `;

    return monthlyAcquisitions.map(record => record.count);
  }

  private async calculateExpansionRevenueTrends(): Promise<number[]> {
    // Simplified expansion revenue calculation
    return [1000, 1200, 1500, 1800, 2000]; // Last 5 months in cents
  }

  private getCurrentQuarter(): string {
    const month = new Date().getMonth() + 1;
    if (month <= 3) return 'Q1';
    if (month <= 6) return 'Q2';
    if (month <= 9) return 'Q3';
    return 'Q4';
  }

  private calculateRevenueForecastConfidence(features: RevenueForecastInput): number {
    let confidence = 0.8;

    // Adjust based on data quality
    if (features.historical_mrr_growth.length < 6) confidence -= 0.1;
    if (features.churn_rate_trends.some(rate => rate > 0.1)) confidence -= 0.1;

    return Math.max(0.5, Math.min(0.95, confidence));
  }

  // Additional helper methods for expansion analysis
  private async calculateCurrentUsageVsLimit(businessId: string): Promise<number> {
    return await this.calculatePlanUtilization(businessId);
  }

  private async calculateUsageGrowthTrajectory(businessId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

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

    if (previousUsage === 0) return 0;
    return (recentUsage - previousUsage) / previousUsage;
  }

  private async calculateFeatureEngagementScore(businessId: string): Promise<number> {
    return await this.calculateFeatureAdoptionRate(businessId);
  }

  private async calculateSupportSentiment(businessId: string): Promise<number> {
    // Simplified sentiment calculation based on support ticket resolution
    const totalTickets = await prisma.queryLog.count({
      where: {
        businessId,
        status: 'ERROR',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    // Assume higher ticket count = lower sentiment
    return Math.max(0, 1 - (totalTickets / 10));
  }

  private async calculatePaymentReliability(businessId: string): Promise<number> {
    const totalPayments = await prisma.$queryRaw<number>`
      SELECT COUNT(*)
      FROM payment_history
      WHERE business_id = ${businessId}::UUID
        AND processed_at >= NOW() - INTERVAL '90 days'
    `;

    const successfulPayments = await prisma.$queryRaw<number>`
      SELECT COUNT(*)
      FROM payment_history
      WHERE business_id = ${businessId}::UUID
        AND status = 'succeeded'
        AND processed_at >= NOW() - INTERVAL '90 days'
    `;

    return totalPayments > 0 ? successfulPayments / totalPayments : 1;
  }

  private async getBusinessSizeIndicators(businessId: string): Promise<Record<string, any>> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        users: true,
        locations: true,
        subscriptions: { where: { status: 'ACTIVE' } }
      }
    });

    return {
      team_size: business?.users.length || 0,
      location_count: business?.locations.length || 0,
      subscription_tier: business?.subscriptions[0]?.planId || 'free'
    };
  }
}

export const predictiveAnalyticsModels = new PredictiveAnalyticsModels();
