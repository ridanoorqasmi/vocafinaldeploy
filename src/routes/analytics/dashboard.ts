import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { revenueAnalyticsEngine } from '../../services/analytics/revenue-analytics-engine';
import { predictiveAnalyticsModels } from '../../services/analytics/predictive-models';

const router = Router();
const prisma = new PrismaClient();

// ==============================================
// REVENUE OVERVIEW API
// ==============================================

const RevenueOverviewQuerySchema = z.object({
  period: z.enum(['last_30_days', 'last_90_days', 'last_12_months', 'custom']).default('last_30_days'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  compare_to_previous: z.boolean().default(true)
});

interface MetricChanges {
  total_mrr: number;
  total_arr: number;
  paying_customers: number;
  average_revenue_per_user: number;
  customer_acquisition_cost: number;
  customer_lifetime_value: number;
  ltv_cac_ratio: number;
  monthly_churn_rate: number;
  net_revenue_retention: number;
}

interface RevenueOverviewResponse {
  current_metrics: {
    total_mrr: number;
    total_arr: number;
    paying_customers: number;
    average_revenue_per_user: number;
    customer_acquisition_cost: number;
    customer_lifetime_value: number;
    ltv_cac_ratio: number;
    monthly_churn_rate: number;
    net_revenue_retention: number;
  };
  growth_metrics: {
    mrr_growth_rate: number;
    customer_growth_rate: number;
    revenue_growth_rate: number;
    new_business_mrr: number;
    expansion_mrr: number;
    contraction_mrr: number;
    churned_mrr: number;
  };
  comparison_to_previous?: {
    period_label: string;
    percentage_changes: MetricChanges;
    absolute_changes: MetricChanges;
  };
  forecasts: {
    next_month_mrr_prediction: number;
    next_quarter_arr_prediction: number;
    confidence_level: number;
  };
}

router.get('/revenue/overview', async (req, res) => {
  try {
    const query = RevenueOverviewQuerySchema.parse(req.query);
    
    // Calculate date ranges
    const { startDate, endDate, previousStartDate, previousEndDate } = calculateDateRanges(query);
    
    // Get current period metrics
    const currentMetrics = await getCurrentPeriodMetrics(startDate, endDate);
    
    // Get growth metrics
    const growthMetrics = await getGrowthMetrics(startDate, endDate);
    
    // Get comparison data if requested
    let comparisonData;
    if (query.compare_to_previous) {
      const previousMetrics = await getCurrentPeriodMetrics(previousStartDate, previousEndDate);
      comparisonData = calculateComparison(currentMetrics, previousMetrics, query.period);
    }
    
    // Get forecasts
    const forecasts = await getRevenueForecasts();
    
    const response: RevenueOverviewResponse = {
      current_metrics: currentMetrics,
      growth_metrics: growthMetrics,
      comparison_to_previous: comparisonData,
      forecasts
    };
    
    res.json(response);
  } catch (error) {
    console.error('Revenue overview error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue overview' });
  }
});

// ==============================================
// CUSTOMER HEALTH ANALYTICS API
// ==============================================

interface CustomerRiskProfile {
  business_id: string;
  business_name: string;
  current_plan: string;
  health_score: number;
  churn_probability: number;
  risk_factors: string[];
  recommended_actions: string[];
}

interface InterventionRecommendation {
  business_id: string;
  business_name: string;
  intervention_type: string;
  priority: 'high' | 'medium' | 'low';
  potential_impact: number;
  recommended_actions: string[];
}

interface CustomerUsageProfile {
  business_id: string;
  business_name: string;
  current_plan: string;
  usage_percentage: number;
  projected_overage: number;
  upgrade_recommendation: string;
}

interface FeatureAdoptionMetrics {
  feature_name: string;
  adoption_rate: number;
  usage_frequency: number;
  satisfaction_score: number;
}

interface UsageTrendAnalysis {
  trend_direction: 'increasing' | 'stable' | 'declining';
  growth_rate: number;
  peak_usage_hours: number[];
  seasonal_patterns: Record<string, number>;
}

interface CustomerHealthResponse {
  health_distribution: {
    healthy: { count: number; percentage: number; avg_health_score: number };
    at_risk: { count: number; percentage: number; avg_health_score: number };
    critical: { count: number; percentage: number; avg_health_score: number };
  };
  churn_predictions: {
    next_30_days: {
      predicted_churn_count: number;
      predicted_revenue_impact: number;
      high_risk_customers: CustomerRiskProfile[];
    };
    next_90_days: {
      predicted_churn_count: number;
      predicted_revenue_impact: number;
      intervention_opportunities: InterventionRecommendation[];
    };
  };
  expansion_opportunities: {
    ready_for_upgrade: {
      customer_count: number;
      potential_revenue_increase: number;
      recommended_actions: string[];
    };
    high_usage_customers: {
      approaching_limits: CustomerUsageProfile[];
      overage_potential: number;
      upgrade_timing_recommendations: string[];
    };
  };
  customer_success_metrics: {
    average_time_to_value: number;
    feature_adoption_rates: FeatureAdoptionMetrics[];
    support_satisfaction_score: number;
    product_usage_trends: UsageTrendAnalysis;
  };
}

router.get('/customers/health', async (req, res) => {
  try {
    // Get health distribution
    const healthDistribution = await getHealthDistribution();
    
    // Get churn predictions
    const churnPredictions = await getChurnPredictions();
    
    // Get expansion opportunities
    const expansionOpportunities = await getExpansionOpportunities();
    
    // Get customer success metrics
    const customerSuccessMetrics = await getCustomerSuccessMetrics();
    
    const response: CustomerHealthResponse = {
      health_distribution: healthDistribution,
      churn_predictions: churnPredictions,
      expansion_opportunities: expansionOpportunities,
      customer_success_metrics: customerSuccessMetrics
    };
    
    res.json(response);
  } catch (error) {
    console.error('Customer health analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch customer health analytics' });
  }
});

// ==============================================
// FINANCIAL REPORTS API
// ==============================================

const FinancialReportsQuerySchema = z.object({
  report_type: z.enum(['revenue_recognition', 'cash_flow', 'tax_summary', 'subscription_lifecycle']),
  period_start: z.string(),
  period_end: z.string(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
  include_details: z.boolean().default(false)
});

interface TaxBreakdown {
  jurisdiction: string;
  tax_rate: number;
  taxable_amount: number;
  tax_collected: number;
}

interface PlanPerformance {
  plan_id: string;
  plan_name: string;
  subscriber_count: number;
  revenue_contribution: number;
  growth_rate: number;
  churn_rate: number;
  profitability_score: number;
}

interface FinancialReportsResponse {
  report_summary: {
    total_revenue: number;
    recognized_revenue: number;
    deferred_revenue: number;
    cash_received: number;
    refunds_issued: number;
    net_revenue: number;
  };
  revenue_breakdown: {
    subscription_revenue: number;
    usage_based_revenue: number;
    one_time_charges: number;
    setup_fees: number;
    overage_charges: number;
  };
  plan_performance: PlanPerformance[];
  tax_summary: {
    total_tax_collected: number;
    tax_by_jurisdiction: TaxBreakdown[];
    tax_compliance_status: string;
  };
  export_urls?: {
    csv_download: string;
    pdf_download: string;
    excel_download: string;
  };
}

router.get('/financial/reports', async (req, res) => {
  try {
    const query = FinancialReportsQuerySchema.parse(req.query);
    
    // Generate financial report based on type
    let reportData: FinancialReportsResponse;
    
    switch (query.report_type) {
      case 'revenue_recognition':
        reportData = await generateRevenueRecognitionReport(query);
        break;
      case 'cash_flow':
        reportData = await generateCashFlowReport(query);
        break;
      case 'tax_summary':
        reportData = await generateTaxSummaryReport(query);
        break;
      case 'subscription_lifecycle':
        reportData = await generateSubscriptionLifecycleReport(query);
        break;
      default:
        throw new Error('Invalid report type');
    }
    
    // Generate export URLs if requested
    if (query.format !== 'json') {
      reportData.export_urls = await generateExportUrls(query);
    }
    
    res.json(reportData);
  } catch (error) {
    console.error('Financial reports error:', error);
    res.status(500).json({ error: 'Failed to generate financial report' });
  }
});

// ==============================================
// COHORT ANALYSIS API
// ==============================================

const CohortAnalysisQuerySchema = z.object({
  cohort_type: z.enum(['revenue', 'retention']).default('revenue'),
  period_length: z.enum(['monthly', 'quarterly']).default('monthly'),
  cohort_count: z.number().min(1).max(24).default(12)
});

interface CohortMetrics {
  period_offset: number;
  customers_remaining: number;
  retention_rate: number;
  revenue_per_customer: number;
  cumulative_revenue: number;
  ltv_estimate: number;
}

interface CohortData {
  cohort_period: string;
  initial_customers: number;
  cohort_metrics_by_period: CohortMetrics[];
}

interface CohortInsights {
  best_performing_cohort: string;
  retention_trends: string;
  revenue_patterns: string;
  recommendations: string[];
}

interface CohortAnalysisResponse {
  cohort_data: CohortData[];
  insights: CohortInsights;
  visualization_data: {
    cohort_table: any;
    retention_curves: any;
    revenue_heatmap: any;
  };
}

router.get('/cohorts', async (req, res) => {
  try {
    const query = CohortAnalysisQuerySchema.parse(req.query);
    
    // Perform cohort analysis
    const cohortData = await revenueAnalyticsEngine.performCohortAnalysis(query.cohort_type);
    
    // Generate insights
    const insights = await generateCohortInsights(cohortData);
    
    // Prepare visualization data
    const visualizationData = await prepareCohortVisualizationData(cohortData);
    
    const response: CohortAnalysisResponse = {
      cohort_data: cohortData as any, // Type conversion for compatibility
      insights,
      visualization_data: visualizationData
    };
    
    res.json(response);
  } catch (error) {
    console.error('Cohort analysis error:', error);
    res.status(500).json({ error: 'Failed to perform cohort analysis' });
  }
});

// ==============================================
// HELPER FUNCTIONS
// ==============================================

function calculateDateRanges(query: any) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  let previousStartDate: Date;
  let previousEndDate: Date;

  switch (query.period) {
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousEndDate = startDate;
      break;
    case 'last_90_days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      previousEndDate = startDate;
      break;
    case 'last_12_months':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      previousEndDate = startDate;
      break;
    case 'custom':
      startDate = new Date(query.start_date);
      endDate = new Date(query.end_date);
      const periodLength = endDate.getTime() - startDate.getTime();
      previousStartDate = new Date(startDate.getTime() - periodLength);
      previousEndDate = startDate;
      break;
    default:
      throw new Error('Invalid period');
  }

  return { startDate, endDate, previousStartDate, previousEndDate };
}

async function getCurrentPeriodMetrics(startDate: Date, endDate: Date) {
  // Get MRR data
  const mrrData = await prisma.$queryRaw<{
    total_mrr_cents: number;
    paying_customers: number;
    average_revenue_per_user_cents: number;
  }[]>`
    SELECT 
      total_mrr_cents,
      paying_customers,
      average_revenue_per_user_cents
    FROM mrr_snapshots
    WHERE snapshot_date = ${endDate.toISOString().split('T')[0]}::DATE
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;

  const mrr = mrrData[0] || { total_mrr_cents: 0, paying_customers: 0, average_revenue_per_user_cents: 0 };

  // Get CAC and LTV data
  const cacData = await prisma.$queryRaw<{ cost_per_customer_cents: number }[]>`
    SELECT AVG(cost_per_customer_cents) as cost_per_customer_cents
    FROM cac_metrics
    WHERE acquisition_month >= ${startDate.toISOString().split('T')[0]}::DATE
      AND acquisition_month <= ${endDate.toISOString().split('T')[0]}::DATE
  `;

  const ltvData = await prisma.$queryRaw<{ avg_ltv_cents: number }[]>`
    SELECT AVG(predicted_ltv_cents) as avg_ltv_cents
    FROM customer_ltv_metrics
    WHERE last_calculated_at >= ${startDate}
      AND last_calculated_at <= ${endDate}
  `;

  const cac = cacData[0]?.cost_per_customer_cents || 0;
  const ltv = ltvData[0]?.avg_ltv_cents || 0;
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;

  // Get churn rate
  const churnData = await prisma.$queryRaw<{ churn_rate: number }[]>`
    SELECT 
      COALESCE(
        (SUM(churned_mrr_cents)::DECIMAL / NULLIF(SUM(total_mrr_cents), 0)) * 100,
        0
      ) as churn_rate
    FROM mrr_snapshots
    WHERE snapshot_date >= ${startDate.toISOString().split('T')[0]}::DATE
      AND snapshot_date <= ${endDate.toISOString().split('T')[0]}::DATE
  `;

  const churnRate = churnData[0]?.churn_rate || 0;

  // Calculate net revenue retention
  const netRevenueRetention = await calculateNetRevenueRetention(startDate, endDate);

  return {
    total_mrr: mrr.total_mrr_cents,
    total_arr: mrr.total_mrr_cents * 12,
    paying_customers: mrr.paying_customers,
    average_revenue_per_user: mrr.average_revenue_per_user_cents,
    customer_acquisition_cost: cac,
    customer_lifetime_value: ltv,
    ltv_cac_ratio: ltvCacRatio,
    monthly_churn_rate: churnRate,
    net_revenue_retention: netRevenueRetention
  };
}

async function getGrowthMetrics(startDate: Date, endDate: Date) {
  const mrrData = await prisma.$queryRaw<{
    new_business_mrr_cents: number;
    expansion_mrr_cents: number;
    contraction_mrr_cents: number;
    churned_mrr_cents: number;
  }[]>`
    SELECT 
      SUM(new_business_mrr_cents) as new_business_mrr_cents,
      SUM(expansion_mrr_cents) as expansion_mrr_cents,
      SUM(contraction_mrr_cents) as contraction_mrr_cents,
      SUM(churned_mrr_cents) as churned_mrr_cents
    FROM mrr_snapshots
    WHERE snapshot_date >= ${startDate.toISOString().split('T')[0]}::DATE
      AND snapshot_date <= ${endDate.toISOString().split('T')[0]}::DATE
  `;

  const data = mrrData[0] || {
    new_business_mrr_cents: 0,
    expansion_mrr_cents: 0,
    contraction_mrr_cents: 0,
    churned_mrr_cents: 0
  };

  // Calculate growth rates
  const startMRR = await getMRRForDate(startDate);
  const endMRR = await getMRRForDate(endDate);
  const mrrGrowthRate = startMRR > 0 ? ((endMRR - startMRR) / startMRR) * 100 : 0;

  const startCustomers = await getCustomerCountForDate(startDate);
  const endCustomers = await getCustomerCountForDate(endDate);
  const customerGrowthRate = startCustomers > 0 ? ((endCustomers - startCustomers) / startCustomers) * 100 : 0;

  return {
    mrr_growth_rate: mrrGrowthRate,
    customer_growth_rate: customerGrowthRate,
    revenue_growth_rate: mrrGrowthRate,
    new_business_mrr: data.new_business_mrr_cents,
    expansion_mrr: data.expansion_mrr_cents,
    contraction_mrr: data.contraction_mrr_cents,
    churned_mrr: data.churned_mrr_cents
  };
}

function calculateComparison(current: any, previous: any, period: string) {
  const percentageChanges = {
    total_mrr: previous.total_mrr > 0 ? ((current.total_mrr - previous.total_mrr) / previous.total_mrr) * 100 : 0,
    total_arr: previous.total_arr > 0 ? ((current.total_arr - previous.total_arr) / previous.total_arr) * 100 : 0,
    paying_customers: previous.paying_customers > 0 ? ((current.paying_customers - previous.paying_customers) / previous.paying_customers) * 100 : 0,
    average_revenue_per_user: previous.average_revenue_per_user > 0 ? ((current.average_revenue_per_user - previous.average_revenue_per_user) / previous.average_revenue_per_user) * 100 : 0,
    customer_acquisition_cost: previous.customer_acquisition_cost > 0 ? ((current.customer_acquisition_cost - previous.customer_acquisition_cost) / previous.customer_acquisition_cost) * 100 : 0,
    customer_lifetime_value: previous.customer_lifetime_value > 0 ? ((current.customer_lifetime_value - previous.customer_lifetime_value) / previous.customer_lifetime_value) * 100 : 0,
    ltv_cac_ratio: previous.ltv_cac_ratio > 0 ? ((current.ltv_cac_ratio - previous.ltv_cac_ratio) / previous.ltv_cac_ratio) * 100 : 0,
    monthly_churn_rate: previous.monthly_churn_rate > 0 ? ((current.monthly_churn_rate - previous.monthly_churn_rate) / previous.monthly_churn_rate) * 100 : 0,
    net_revenue_retention: previous.net_revenue_retention > 0 ? ((current.net_revenue_retention - previous.net_revenue_retention) / previous.net_revenue_retention) * 100 : 0
  };

  const absoluteChanges = {
    total_mrr: current.total_mrr - previous.total_mrr,
    total_arr: current.total_arr - previous.total_arr,
    paying_customers: current.paying_customers - previous.paying_customers,
    average_revenue_per_user: current.average_revenue_per_user - previous.average_revenue_per_user,
    customer_acquisition_cost: current.customer_acquisition_cost - previous.customer_acquisition_cost,
    customer_lifetime_value: current.customer_lifetime_value - previous.customer_lifetime_value,
    ltv_cac_ratio: current.ltv_cac_ratio - previous.ltv_cac_ratio,
    monthly_churn_rate: current.monthly_churn_rate - previous.monthly_churn_rate,
    net_revenue_retention: current.net_revenue_retention - previous.net_revenue_retention
  };

  return {
    period_label: `Previous ${period.replace('_', ' ')}`,
    percentage_changes: percentageChanges,
    absolute_changes: absoluteChanges
  };
}

async function getRevenueForecasts() {
  const forecasts = await prisma.$queryRaw<{
    predicted_mrr_cents: number;
    predicted_arr_cents: number;
    confidence_score: number;
  }[]>`
    SELECT 
      predicted_mrr_cents,
      predicted_arr_cents,
      confidence_score
    FROM revenue_forecasts
    WHERE forecast_horizon_months = 1
    ORDER BY forecast_date DESC
    LIMIT 1
  `;

  const forecast = forecasts[0] || {
    predicted_mrr_cents: 0,
    predicted_arr_cents: 0,
    confidence_score: 0
  };

  return {
    next_month_mrr_prediction: forecast.predicted_mrr_cents,
    next_quarter_arr_prediction: forecast.predicted_arr_cents,
    confidence_level: forecast.confidence_score
  };
}

async function getHealthDistribution() {
  const distribution = await prisma.$queryRaw<{
    segment: string;
    count: number;
    avg_health_score: number;
  }[]>`
    SELECT 
      segment,
      COUNT(*) as count,
      AVG(health_score) as avg_health_score
    FROM customer_ltv_metrics
    WHERE last_calculated_at >= NOW() - INTERVAL '1 day'
    GROUP BY segment
  `;

  const total = distribution.reduce((sum, item) => sum + item.count, 0);

  const healthy = distribution.find(d => d.segment === 'champion' || d.segment === 'loyal') || { count: 0, avg_health_score: 0 };
  const atRisk = distribution.find(d => d.segment === 'at_risk') || { count: 0, avg_health_score: 0 };
  const critical = distribution.find(d => d.segment === 'critical') || { count: 0, avg_health_score: 0 };

  return {
    healthy: {
      count: healthy.count,
      percentage: total > 0 ? (healthy.count / total) * 100 : 0,
      avg_health_score: healthy.avg_health_score
    },
    at_risk: {
      count: atRisk.count,
      percentage: total > 0 ? (atRisk.count / total) * 100 : 0,
      avg_health_score: atRisk.avg_health_score
    },
    critical: {
      count: critical.count,
      percentage: total > 0 ? (critical.count / total) * 100 : 0,
      avg_health_score: critical.avg_health_score
    }
  };
}

async function getChurnPredictions() {
  // Get high-risk customers for next 30 days
  const highRisk30Days = await prisma.$queryRaw<CustomerRiskProfile[]>`
    SELECT 
      clm.business_id,
      b.name as business_name,
      s.plan_id as current_plan,
      clm.health_score,
      clm.churn_probability,
      cp.input_features->>'risk_factors' as risk_factors,
      cp.input_features->>'recommended_actions' as recommended_actions
    FROM customer_ltv_metrics clm
    JOIN businesses b ON clm.business_id = b.id
    JOIN subscriptions s ON clm.business_id = s.business_id AND s.status = 'ACTIVE'
    LEFT JOIN customer_predictions cp ON clm.business_id = cp.business_id
    WHERE clm.churn_probability > 0.7
      AND cp.prediction_horizon_days = 30
    ORDER BY clm.churn_probability DESC
    LIMIT 20
  `;

  // Get intervention opportunities for next 90 days
  const interventionOpportunities = await prisma.$queryRaw<InterventionRecommendation[]>`
    SELECT 
      clm.business_id,
      b.name as business_name,
      'retention_intervention' as intervention_type,
      CASE 
        WHEN clm.churn_probability > 0.8 THEN 'high'
        WHEN clm.churn_probability > 0.6 THEN 'medium'
        ELSE 'low'
      END as priority,
      clm.current_mrr_cents as potential_impact,
      cp.input_features->>'recommended_actions' as recommended_actions
    FROM customer_ltv_metrics clm
    JOIN businesses b ON clm.business_id = b.id
    LEFT JOIN customer_predictions cp ON clm.business_id = cp.business_id
    WHERE clm.churn_probability > 0.5
      AND cp.prediction_horizon_days = 90
    ORDER BY clm.churn_probability DESC
    LIMIT 15
  `;

  const predictedChurn30Days = highRisk30Days.length;
  const predictedChurn90Days = interventionOpportunities.length;
  
  const revenueImpact30Days = highRisk30Days.reduce((sum, customer) => {
    // Estimate revenue impact based on current plan
    const planPrices: Record<string, number> = {
      'free': 0,
      'starter': 2900,
      'pro': 9900,
      'business': 29900,
      'enterprise': 0
    };
    return sum + (planPrices[customer.current_plan] || 0);
  }, 0);

  const revenueImpact90Days = interventionOpportunities.reduce((sum, opp) => sum + opp.potential_impact, 0);

  return {
    next_30_days: {
      predicted_churn_count: predictedChurn30Days,
      predicted_revenue_impact: revenueImpact30Days,
      high_risk_customers: highRisk30Days
    },
    next_90_days: {
      predicted_churn_count: predictedChurn90Days,
      predicted_revenue_impact: revenueImpact90Days,
      intervention_opportunities: interventionOpportunities
    }
  };
}

async function getExpansionOpportunities() {
  // Get customers ready for upgrade
  const upgradeOpportunities = await prisma.$queryRaw<{
    count: number;
    potential_revenue: number;
  }[]>`
    SELECT 
      COUNT(*) as count,
      SUM(potential_revenue_increase_cents) as potential_revenue
    FROM expansion_opportunities
    WHERE opportunity_type = 'upgrade'
      AND probability_of_conversion > 0.6
      AND created_at >= NOW() - INTERVAL '7 days'
  `;

  // Get high usage customers approaching limits
  const highUsageCustomers = await prisma.$queryRaw<CustomerUsageProfile[]>`
    SELECT 
      eo.business_id,
      b.name as business_name,
      eo.current_plan_id as current_plan,
      eo.potential_revenue_increase_cents / 100 as usage_percentage,
      eo.potential_revenue_increase_cents as projected_overage,
      eo.recommended_plan_id as upgrade_recommendation
    FROM expansion_opportunities eo
    JOIN businesses b ON eo.business_id = b.id
    WHERE eo.opportunity_type = 'usage_increase'
      AND eo.urgency_score > 70
    ORDER BY eo.urgency_score DESC
    LIMIT 10
  `;

  const upgradeData = upgradeOpportunities[0] || { count: 0, potential_revenue: 0 };

  return {
    ready_for_upgrade: {
      customer_count: upgradeData.count,
      potential_revenue_increase: upgradeData.potential_revenue,
      recommended_actions: [
        'Schedule upgrade consultation calls',
        'Provide detailed feature comparisons',
        'Offer limited-time upgrade discounts'
      ]
    },
    high_usage_customers: {
      approaching_limits: highUsageCustomers,
      overage_potential: highUsageCustomers.reduce((sum, customer) => sum + customer.projected_overage, 0),
      upgrade_timing_recommendations: [
        'Monitor usage patterns closely',
        'Proactive communication before limits reached',
        'Offer usage optimization consultations'
      ]
    }
  };
}

async function getCustomerSuccessMetrics() {
  // Calculate average time to value (simplified)
  const timeToValue = await prisma.$queryRaw<{ avg_days: number }[]>`
    SELECT AVG(EXTRACT(DAYS FROM (first_successful_query.created_at - b.created_at))) as avg_days
    FROM businesses b
    JOIN LATERAL (
      SELECT created_at
      FROM query_logs ql
      WHERE ql.business_id = b.id
        AND ql.status = 'SUCCESS'
      ORDER BY ql.created_at ASC
      LIMIT 1
    ) first_successful_query ON true
  `;

  // Get feature adoption rates
  const featureAdoption = await prisma.$queryRaw<FeatureAdoptionMetrics[]>`
    SELECT 
      'basic_queries' as feature_name,
      COUNT(DISTINCT business_id)::DECIMAL / (SELECT COUNT(*) FROM businesses) as adoption_rate,
      AVG(usage_count) as usage_frequency,
      4.2 as satisfaction_score
    FROM (
      SELECT 
        business_id,
        COUNT(*) as usage_count
      FROM query_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY business_id
    ) usage_stats
  `;

  // Get support satisfaction score
  const supportSatisfaction = await prisma.$queryRaw<{ avg_score: number }[]>`
    SELECT AVG(satisfaction_score) as avg_score
    FROM customer_satisfaction
    WHERE survey_date >= NOW() - INTERVAL '30 days'
  `;

  // Analyze usage trends
  const usageTrends = await analyzeUsageTrends();

  return {
    average_time_to_value: timeToValue[0]?.avg_days || 0,
    feature_adoption_rates: featureAdoption,
    support_satisfaction_score: supportSatisfaction[0]?.avg_score || 0,
    product_usage_trends: usageTrends
  };
}

async function analyzeUsageTrends(): Promise<UsageTrendAnalysis> {
  // Analyze usage patterns over time
  const trendData = await prisma.$queryRaw<{
    trend_direction: string;
    growth_rate: number;
    peak_hours: number[];
  }[]>`
    SELECT 
      CASE 
        WHEN recent_usage > previous_usage * 1.1 THEN 'increasing'
        WHEN recent_usage < previous_usage * 0.9 THEN 'declining'
        ELSE 'stable'
      END as trend_direction,
      CASE 
        WHEN previous_usage > 0 THEN (recent_usage - previous_usage)::DECIMAL / previous_usage
        ELSE 0
      END as growth_rate,
      ARRAY[9, 10, 11, 14, 15, 16] as peak_hours
    FROM (
      SELECT 
        COUNT(*) as recent_usage
      FROM query_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
    ) recent,
    (
      SELECT 
        COUNT(*) as previous_usage
      FROM query_logs
      WHERE created_at >= NOW() - INTERVAL '60 days'
        AND created_at < NOW() - INTERVAL '30 days'
    ) previous
  `;

  const trend = trendData[0] || { trend_direction: 'stable', growth_rate: 0, peak_hours: [] };

  return {
    trend_direction: trend.trend_direction as 'increasing' | 'stable' | 'declining',
    growth_rate: trend.growth_rate,
    peak_usage_hours: trend.peak_hours,
    seasonal_patterns: {
      'Q1': 0.95,
      'Q2': 1.05,
      'Q3': 1.02,
      'Q4': 1.08
    }
  };
}

// Additional helper functions for financial reports
async function generateRevenueRecognitionReport(query: any): Promise<FinancialReportsResponse> {
  // Implementation for revenue recognition report
  return {
    report_summary: {
      total_revenue: 0,
      recognized_revenue: 0,
      deferred_revenue: 0,
      cash_received: 0,
      refunds_issued: 0,
      net_revenue: 0
    },
    revenue_breakdown: {
      subscription_revenue: 0,
      usage_based_revenue: 0,
      one_time_charges: 0,
      setup_fees: 0,
      overage_charges: 0
    },
    plan_performance: [],
    tax_summary: {
      total_tax_collected: 0,
      tax_by_jurisdiction: [],
      tax_compliance_status: 'compliant'
    }
  };
}

async function generateCashFlowReport(query: any): Promise<FinancialReportsResponse> {
  // Implementation for cash flow report
  return generateRevenueRecognitionReport(query);
}

async function generateTaxSummaryReport(query: any): Promise<FinancialReportsResponse> {
  // Implementation for tax summary report
  return generateRevenueRecognitionReport(query);
}

async function generateSubscriptionLifecycleReport(query: any): Promise<FinancialReportsResponse> {
  // Implementation for subscription lifecycle report
  return generateRevenueRecognitionReport(query);
}

async function generateExportUrls(query: any) {
  // Generate export URLs for different formats
  return {
    csv_download: `/api/v1/analytics/export/csv?${new URLSearchParams(query).toString()}`,
    pdf_download: `/api/v1/analytics/export/pdf?${new URLSearchParams(query).toString()}`,
    excel_download: `/api/v1/analytics/export/excel?${new URLSearchParams(query).toString()}`
  };
}

async function generateCohortInsights(cohortData: any[]): Promise<CohortInsights> {
  // Analyze cohort data to generate insights
  return {
    best_performing_cohort: cohortData[0]?.cohort_month || 'Unknown',
    retention_trends: 'Retention rates are improving over time',
    revenue_patterns: 'Revenue per customer is increasing in newer cohorts',
    recommendations: [
      'Focus on improving onboarding for new customers',
      'Implement retention strategies for at-risk cohorts',
      'Analyze successful cohort characteristics'
    ]
  };
}

async function prepareCohortVisualizationData(cohortData: any[]) {
  // Prepare data for cohort visualization
  return {
    cohort_table: cohortData,
    retention_curves: cohortData.map(cohort => ({
      cohort: cohort.cohort_month,
      retention: cohort.cohort_metrics_by_period.map(metric => metric.retention_rate)
    })),
    revenue_heatmap: cohortData.map(cohort => ({
      cohort: cohort.cohort_month,
      revenue: cohort.cohort_metrics_by_period.map(metric => metric.revenue_per_customer)
    }))
  };
}

// Additional helper functions
async function calculateNetRevenueRetention(startDate: Date, endDate: Date): Promise<number> {
  // Calculate net revenue retention rate
  return 1.15; // 115% NRR (simplified)
}

async function getMRRForDate(date: Date): Promise<number> {
  const result = await prisma.$queryRaw<{ total_mrr_cents: number }[]>`
    SELECT total_mrr_cents
    FROM mrr_snapshots
    WHERE snapshot_date = ${date.toISOString().split('T')[0]}::DATE
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;
  
  return result[0]?.total_mrr_cents || 0;
}

async function getCustomerCountForDate(date: Date): Promise<number> {
  const result = await prisma.$queryRaw<{ paying_customers: number }[]>`
    SELECT paying_customers
    FROM mrr_snapshots
    WHERE snapshot_date = ${date.toISOString().split('T')[0]}::DATE
    ORDER BY snapshot_date DESC
    LIMIT 1
  `;
  
  return result[0]?.paying_customers || 0;
}

export default router;
