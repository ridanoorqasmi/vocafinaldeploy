import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ==============================================
// INSIGHTS ENGINE
// ==============================================

export interface BusinessInsight {
  insight_type: string;
  insight_category: string;
  title: string;
  description: string;
  impact_score: number;
  confidence_score: number;
  actionable: boolean;
  recommended_actions: string[];
  insight_data: Record<string, any>;
  generated_at: Date;
  expires_at?: Date;
}

export interface BusinessAlert {
  alert_type: string;
  alert_category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  business_id?: string;
  alert_data: Record<string, any>;
  acknowledged_at?: Date;
  resolved_at?: Date;
  created_at: Date;
}

export interface RevenueInsight {
  growth_anomalies: string[];
  seasonal_patterns: Record<string, number>;
  plan_optimization: string[];
  pricing_opportunities: string[];
}

export interface CustomerInsight {
  churn_drivers: string[];
  expansion_triggers: string[];
  success_patterns: string[];
  segmentation_opportunities: string[];
}

export interface BusinessInsightData {
  revenue_insights: RevenueInsight;
  customer_insights: CustomerInsight;
  business_insights: {
    market_opportunities: string[];
    competitive_positioning: string[];
    operational_efficiency: string[];
    investment_priorities: string[];
  };
}

export class InsightsEngine {
  /**
   * Generate comprehensive business insights
   */
  async generateBusinessInsights(): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];

    // Generate revenue insights
    const revenueInsights = await this.generateRevenueInsights();
    insights.push(...revenueInsights);

    // Generate customer insights
    const customerInsights = await this.generateCustomerInsights();
    insights.push(...customerInsights);

    // Generate operational insights
    const operationalInsights = await this.generateOperationalInsights();
    insights.push(...operationalInsights);

    // Store insights in database
    await this.storeInsights(insights);

    return insights;
  }

  /**
   * Generate business alerts based on thresholds and anomalies
   */
  async generateBusinessAlerts(): Promise<BusinessAlert[]> {
    const alerts: BusinessAlert[] = [];

    // Revenue alerts
    const revenueAlerts = await this.generateRevenueAlerts();
    alerts.push(...revenueAlerts);

    // Customer alerts
    const customerAlerts = await this.generateCustomerAlerts();
    alerts.push(...customerAlerts);

    // Operational alerts
    const operationalAlerts = await this.generateOperationalAlerts();
    alerts.push(...operationalAlerts);

    // Store alerts in database
    await this.storeAlerts(alerts);

    return alerts;
  }

  /**
   * Analyze revenue patterns and generate insights
   */
  private async generateRevenueInsights(): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];

    // Analyze MRR growth patterns
    const mrrGrowthInsight = await this.analyzeMRRGrowth();
    if (mrrGrowthInsight) insights.push(mrrGrowthInsight);

    // Analyze seasonal patterns
    const seasonalInsight = await this.analyzeSeasonalPatterns();
    if (seasonalInsight) insights.push(seasonalInsight);

    // Analyze plan performance
    const planPerformanceInsight = await this.analyzePlanPerformance();
    if (planPerformanceInsight) insights.push(planPerformanceInsight);

    // Analyze pricing opportunities
    const pricingInsight = await this.analyzePricingOpportunities();
    if (pricingInsight) insights.push(pricingInsight);

    return insights;
  }

  /**
   * Analyze customer behavior and generate insights
   */
  private async generateCustomerInsights(): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];

    // Analyze churn drivers
    const churnDriversInsight = await this.analyzeChurnDrivers();
    if (churnDriversInsight) insights.push(churnDriversInsight);

    // Analyze expansion opportunities
    const expansionInsight = await this.analyzeExpansionOpportunities();
    if (expansionInsight) insights.push(expansionInsight);

    // Analyze customer success patterns
    const successPatternsInsight = await this.analyzeCustomerSuccessPatterns();
    if (successPatternsInsight) insights.push(successPatternsInsight);

    // Analyze segmentation opportunities
    const segmentationInsight = await this.analyzeSegmentationOpportunities();
    if (segmentationInsight) insights.push(segmentationInsight);

    return insights;
  }

  /**
   * Generate operational insights
   */
  private async generateOperationalInsights(): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];

    // Analyze market opportunities
    const marketInsight = await this.analyzeMarketOpportunities();
    if (marketInsight) insights.push(marketInsight);

    // Analyze competitive positioning
    const competitiveInsight = await this.analyzeCompetitivePositioning();
    if (competitiveInsight) insights.push(competitiveInsight);

    // Analyze operational efficiency
    const efficiencyInsight = await this.analyzeOperationalEfficiency();
    if (efficiencyInsight) insights.push(efficiencyInsight);

    // Analyze investment priorities
    const investmentInsight = await this.analyzeInvestmentPriorities();
    if (investmentInsight) insights.push(investmentInsight);

    return insights;
  }

  /**
   * Generate revenue alerts
   */
  private async generateRevenueAlerts(): Promise<BusinessAlert[]> {
    const alerts: BusinessAlert[] = [];

    // Check for MRR decline
    const mrrDeclineAlert = await this.checkMRRDecline();
    if (mrrDeclineAlert) alerts.push(mrrDeclineAlert);

    // Check for churn spike
    const churnSpikeAlert = await this.checkChurnSpike();
    if (churnSpikeAlert) alerts.push(churnSpikeAlert);

    // Check for revenue milestones
    const milestoneAlert = await this.checkRevenueMilestones();
    if (milestoneAlert) alerts.push(milestoneAlert);

    // Check for forecast variance
    const forecastVarianceAlert = await this.checkForecastVariance();
    if (forecastVarianceAlert) alerts.push(forecastVarianceAlert);

    return alerts;
  }

  /**
   * Generate customer alerts
   */
  private async generateCustomerAlerts(): Promise<BusinessAlert[]> {
    const alerts: BusinessAlert[] = [];

    // Check for high-value churn risk
    const highValueChurnAlert = await this.checkHighValueChurnRisk();
    if (highValueChurnAlert) alerts.push(highValueChurnAlert);

    // Check for expansion opportunities
    const expansionAlert = await this.checkExpansionOpportunities();
    if (expansionAlert) alerts.push(expansionAlert);

    // Check for support escalation
    const supportAlert = await this.checkSupportEscalation();
    if (supportAlert) alerts.push(supportAlert);

    // Check for usage anomalies
    const usageAnomalyAlert = await this.checkUsageAnomalies();
    if (usageAnomalyAlert) alerts.push(usageAnomalyAlert);

    return alerts;
  }

  /**
   * Generate operational alerts
   */
  private async generateOperationalAlerts(): Promise<BusinessAlert[]> {
    const alerts: BusinessAlert[] = [];

    // Check for payment failure trends
    const paymentFailureAlert = await this.checkPaymentFailureTrends();
    if (paymentFailureAlert) alerts.push(paymentFailureAlert);

    // Check for plan performance issues
    const planPerformanceAlert = await this.checkPlanPerformanceIssues();
    if (planPerformanceAlert) alerts.push(planPerformanceAlert);

    // Check for seasonal capacity needs
    const capacityAlert = await this.checkSeasonalCapacityNeeds();
    if (capacityAlert) alerts.push(capacityAlert);

    return alerts;
  }

  // ==============================================
  // REVENUE INSIGHT METHODS
  // ==============================================

  private async analyzeMRRGrowth(): Promise<BusinessInsight | null> {
    const mrrData = await prisma.$queryRaw<{
      current_mrr: number;
      previous_mrr: number;
      growth_rate: number;
    }[]>`
      WITH current_mrr AS (
        SELECT total_mrr_cents
        FROM mrr_snapshots
        WHERE snapshot_date = CURRENT_DATE
        ORDER BY snapshot_date DESC
        LIMIT 1
      ),
      previous_mrr AS (
        SELECT total_mrr_cents
        FROM mrr_snapshots
        WHERE snapshot_date = CURRENT_DATE - INTERVAL '1 month'
        ORDER BY snapshot_date DESC
        LIMIT 1
      )
      SELECT 
        c.total_mrr_cents as current_mrr,
        p.total_mrr_cents as previous_mrr,
        CASE 
          WHEN p.total_mrr_cents > 0 THEN 
            ((c.total_mrr_cents - p.total_mrr_cents)::DECIMAL / p.total_mrr_cents) * 100
          ELSE 0
        END as growth_rate
      FROM current_mrr c
      CROSS JOIN previous_mrr p
    `;

    const data = mrrData[0];
    if (!data) return null;

    const growthRate = data.growth_rate;
    let insight: BusinessInsight;

    if (growthRate > 20) {
      insight = {
        insight_type: 'revenue_growth',
        insight_category: 'revenue',
        title: 'Exceptional MRR Growth Detected',
        description: `MRR has grown by ${growthRate.toFixed(1)}% month-over-month, indicating strong business momentum.`,
        impact_score: 90,
        confidence_score: 0.95,
        actionable: true,
        recommended_actions: [
          'Analyze growth drivers to replicate success',
          'Scale marketing efforts to capitalize on momentum',
          'Ensure infrastructure can handle increased demand'
        ],
        insight_data: {
          growth_rate: growthRate,
          current_mrr: data.current_mrr,
          previous_mrr: data.previous_mrr
        },
        generated_at: new Date()
      };
    } else if (growthRate < -10) {
      insight = {
        insight_type: 'revenue_decline',
        insight_category: 'revenue',
        title: 'MRR Decline Alert',
        description: `MRR has declined by ${Math.abs(growthRate).toFixed(1)}% month-over-month, requiring immediate attention.`,
        impact_score: 85,
        confidence_score: 0.90,
        actionable: true,
        recommended_actions: [
          'Investigate root causes of revenue decline',
          'Implement retention strategies immediately',
          'Review pricing and value proposition'
        ],
        insight_data: {
          growth_rate: growthRate,
          current_mrr: data.current_mrr,
          previous_mrr: data.previous_mrr
        },
        generated_at: new Date()
      };
    } else {
      return null; // No significant insight
    }

    return insight;
  }

  private async analyzeSeasonalPatterns(): Promise<BusinessInsight | null> {
    const seasonalData = await prisma.$queryRaw<{
      quarter: string;
      avg_mrr: number;
      growth_rate: number;
    }[]>`
      SELECT 
        CASE 
          WHEN EXTRACT(MONTH FROM snapshot_date) IN (1,2,3) THEN 'Q1'
          WHEN EXTRACT(MONTH FROM snapshot_date) IN (4,5,6) THEN 'Q2'
          WHEN EXTRACT(MONTH FROM snapshot_date) IN (7,8,9) THEN 'Q3'
          ELSE 'Q4'
        END as quarter,
        AVG(total_mrr_cents) as avg_mrr,
        AVG(
          CASE 
            WHEN LAG(total_mrr_cents) OVER (ORDER BY snapshot_date) > 0 THEN
              ((total_mrr_cents - LAG(total_mrr_cents) OVER (ORDER BY snapshot_date))::DECIMAL / 
               LAG(total_mrr_cents) OVER (ORDER BY snapshot_date)) * 100
            ELSE 0
          END
        ) as growth_rate
      FROM mrr_snapshots
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY quarter
      ORDER BY quarter
    `;

    if (seasonalData.length < 4) return null;

    // Find strongest and weakest quarters
    const sortedByGrowth = seasonalData.sort((a, b) => b.growth_rate - a.growth_rate);
    const strongestQuarter = sortedByGrowth[0];
    const weakestQuarter = sortedByGrowth[sortedByGrowth.length - 1];

    const seasonalVariation = strongestQuarter.growth_rate - weakestQuarter.growth_rate;

    if (seasonalVariation > 15) {
      return {
        insight_type: 'seasonal_patterns',
        insight_category: 'revenue',
        title: 'Significant Seasonal Patterns Detected',
        description: `Strong seasonal variation detected with ${strongestQuarter.quarter} showing ${strongestQuarter.growth_rate.toFixed(1)}% growth and ${weakestQuarter.quarter} showing ${weakestQuarter.growth_rate.toFixed(1)}% growth.`,
        impact_score: 75,
        confidence_score: 0.85,
        actionable: true,
        recommended_actions: [
          'Adjust marketing spend based on seasonal patterns',
          'Plan capacity and resources for peak seasons',
          'Develop strategies to smooth seasonal variations'
        ],
        insight_data: {
          seasonal_data: seasonalData,
          strongest_quarter: strongestQuarter,
          weakest_quarter: weakestQuarter,
          seasonal_variation: seasonalVariation
        },
        generated_at: new Date()
      };
    }

    return null;
  }

  private async analyzePlanPerformance(): Promise<BusinessInsight | null> {
    const planData = await prisma.$queryRaw<{
      plan_id: string;
      subscriber_count: number;
      churn_rate: number;
      upgrade_rate: number;
      satisfaction_score: number;
    }[]>`
      SELECT 
        pa.plan_id,
        pa.total_subscribers as subscriber_count,
        pa.churn_rate,
        pa.upgrade_rate,
        pa.plan_satisfaction_score as satisfaction_score
      FROM plan_analytics pa
      WHERE pa.analysis_period_end >= CURRENT_DATE - INTERVAL '1 month'
      ORDER BY pa.total_subscribers DESC
    `;

    if (planData.length === 0) return null;

    // Find underperforming plans
    const underperformingPlans = planData.filter(plan => 
      plan.churn_rate > 0.1 || plan.satisfaction_score < 3.0
    );

    if (underperformingPlans.length > 0) {
      return {
        insight_type: 'plan_optimization',
        insight_category: 'revenue',
        title: 'Plan Performance Issues Detected',
        description: `${underperformingPlans.length} plan(s) showing concerning performance metrics including high churn rates or low satisfaction scores.`,
        impact_score: 80,
        confidence_score: 0.90,
        actionable: true,
        recommended_actions: [
          'Review and optimize underperforming plan features',
          'Adjust pricing strategy for problematic plans',
          'Improve onboarding and support for affected plans'
        ],
        insight_data: {
          underperforming_plans: underperformingPlans,
          total_plans_analyzed: planData.length
        },
        generated_at: new Date()
      };
    }

    return null;
  }

  private async analyzePricingOpportunities(): Promise<BusinessInsight | null> {
    const pricingData = await prisma.$queryRaw<{
      plan_id: string;
      price_cents: number;
      utilization_rate: number;
      upgrade_rate: number;
      overage_revenue: number;
    }[]>`
      SELECT 
        pd.id as plan_id,
        pd.price_cents,
        AVG(pa.average_usage_percentage) as utilization_rate,
        AVG(pa.upgrade_rate) as upgrade_rate,
        AVG(pa.overage_revenue_cents) as overage_revenue
      FROM plan_definitions pd
      LEFT JOIN plan_analytics pa ON pd.id = pa.plan_id
      WHERE pd.is_active = true
      GROUP BY pd.id, pd.price_cents
      ORDER BY pd.price_cents
    `;

    if (pricingData.length === 0) return null;

    // Find pricing opportunities
    const opportunities: string[] = [];

    pricingData.forEach(plan => {
      if (plan.utilization_rate > 0.9 && plan.upgrade_rate < 0.05) {
        opportunities.push(`${plan.plan_id}: High utilization but low upgrade rate - consider price increase`);
      }
      if (plan.utilization_rate < 0.3 && plan.upgrade_rate > 0.1) {
        opportunities.push(`${plan.plan_id}: Low utilization but high upgrade rate - consider price decrease`);
      }
      if (plan.overage_revenue > plan.price_cents * 0.2) {
        opportunities.push(`${plan.plan_id}: High overage revenue - consider plan limit adjustments`);
      }
    });

    if (opportunities.length > 0) {
      return {
        insight_type: 'pricing_optimization',
        insight_category: 'revenue',
        title: 'Pricing Optimization Opportunities',
        description: `Identified ${opportunities.length} pricing optimization opportunities across your plan portfolio.`,
        impact_score: 70,
        confidence_score: 0.80,
        actionable: true,
        recommended_actions: [
          'Conduct A/B tests on pricing changes',
          'Analyze customer willingness to pay',
          'Implement dynamic pricing strategies'
        ],
        insight_data: {
          opportunities,
          plans_analyzed: pricingData.length
        },
        generated_at: new Date()
      };
    }

    return null;
  }

  // ==============================================
  // CUSTOMER INSIGHT METHODS
  // ==============================================

  private async analyzeChurnDrivers(): Promise<BusinessInsight | null> {
    const churnData = await prisma.$queryRaw<{
      risk_factor: string;
      frequency: number;
      impact_score: number;
    }[]>`
      SELECT 
        risk_factor,
        COUNT(*) as frequency,
        AVG(churn_probability) as impact_score
      FROM (
        SELECT 
          jsonb_array_elements_text(churn_risk_factors) as risk_factor,
          churn_probability
        FROM churn_analysis
        WHERE analysis_date >= CURRENT_DATE - INTERVAL '30 days'
          AND churn_probability > 0.5
      ) risk_factors
      GROUP BY risk_factor
      ORDER BY frequency DESC
    `;

    if (churnData.length === 0) return null;

    const topChurnDrivers = churnData.slice(0, 3);

    return {
      insight_type: 'churn_drivers',
      insight_category: 'customer',
      title: 'Primary Churn Drivers Identified',
      description: `Analysis of high-risk customers reveals the top churn drivers: ${topChurnDrivers.map(d => d.risk_factor).join(', ')}.`,
      impact_score: 85,
      confidence_score: 0.90,
      actionable: true,
      recommended_actions: [
        'Develop targeted retention strategies for identified risk factors',
        'Implement proactive monitoring for at-risk customers',
        'Create educational content to address common issues'
      ],
      insight_data: {
        top_churn_drivers: topChurnDrivers,
        total_risk_factors: churnData.length
      },
      generated_at: new Date()
    };
  }

  private async analyzeExpansionOpportunities(): Promise<BusinessInsight | null> {
    const expansionData = await prisma.$queryRaw<{
      opportunity_type: string;
      count: number;
      potential_revenue: number;
      avg_probability: number;
    }[]>`
      SELECT 
        opportunity_type,
        COUNT(*) as count,
        SUM(potential_revenue_increase_cents) as potential_revenue,
        AVG(probability_of_conversion) as avg_probability
      FROM expansion_opportunities
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND probability_of_conversion > 0.6
      GROUP BY opportunity_type
      ORDER BY potential_revenue DESC
    `;

    if (expansionData.length === 0) return null;

    const totalPotentialRevenue = expansionData.reduce((sum, opp) => sum + opp.potential_revenue, 0);

    return {
      insight_type: 'expansion_opportunities',
      insight_category: 'customer',
      title: 'Significant Expansion Opportunities Available',
      description: `Identified ${expansionData.length} expansion opportunity types with potential revenue increase of $${(totalPotentialRevenue / 100).toFixed(2)}.`,
      impact_score: 80,
      confidence_score: 0.85,
      actionable: true,
      recommended_actions: [
        'Prioritize high-probability expansion opportunities',
        'Develop targeted outreach campaigns',
        'Create expansion playbooks for sales team'
      ],
      insight_data: {
        expansion_opportunities: expansionData,
        total_potential_revenue: totalPotentialRevenue
      },
      generated_at: new Date()
    };
  }

  private async analyzeCustomerSuccessPatterns(): Promise<BusinessInsight | null> {
    const successData = await prisma.$queryRaw<{
      pattern: string;
      success_rate: number;
      customer_count: number;
    }[]>`
      SELECT 
        'high_engagement' as pattern,
        COUNT(*) as customer_count,
        AVG(health_score) as success_rate
      FROM customer_ltv_metrics
      WHERE segment = 'champion'
        AND last_calculated_at >= CURRENT_DATE - INTERVAL '7 days'
    `;

    if (successData.length === 0) return null;

    const successPattern = successData[0];

    return {
      insight_type: 'success_patterns',
      insight_category: 'customer',
      title: 'Customer Success Patterns Identified',
      description: `Analysis reveals ${successPattern.customer_count} champion customers with average health score of ${successPattern.success_rate.toFixed(1)}.`,
      impact_score: 75,
      confidence_score: 0.85,
      actionable: true,
      recommended_actions: [
        'Document success patterns for replication',
        'Develop onboarding programs based on champion characteristics',
        'Create customer success playbooks'
      ],
      insight_data: {
        success_patterns: successData,
        champion_customers: successPattern.customer_count
      },
      generated_at: new Date()
    };
  }

  private async analyzeSegmentationOpportunities(): Promise<BusinessInsight | null> {
    const segmentationData = await prisma.$queryRaw<{
      segment: string;
      count: number;
      avg_ltv: number;
      avg_health: number;
    }[]>`
      SELECT 
        segment,
        COUNT(*) as count,
        AVG(predicted_ltv_cents) as avg_ltv,
        AVG(health_score) as avg_health
      FROM customer_ltv_metrics
      WHERE last_calculated_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY segment
      ORDER BY avg_ltv DESC
    `;

    if (segmentationData.length < 2) return null;

    // Check for segmentation opportunities
    const ltvVariance = this.calculateVariance(segmentationData.map(d => d.avg_ltv));
    const healthVariance = this.calculateVariance(segmentationData.map(d => d.avg_health));

    if (ltvVariance > 1000000 || healthVariance > 100) { // Significant variance
      return {
        insight_type: 'segmentation_opportunities',
        insight_category: 'customer',
        title: 'Customer Segmentation Opportunities',
        description: `Significant variance in customer value and health scores suggests opportunities for more granular segmentation and targeted strategies.`,
        impact_score: 70,
        confidence_score: 0.80,
        actionable: true,
        recommended_actions: [
          'Develop more granular customer segments',
          'Create segment-specific marketing strategies',
          'Implement segment-based pricing models'
        ],
        insight_data: {
          segmentation_data: segmentationData,
          ltv_variance: ltvVariance,
          health_variance: healthVariance
        },
        generated_at: new Date()
      };
    }

    return null;
  }

  // ==============================================
  // ALERT METHODS
  // ==============================================

  private async checkMRRDecline(): Promise<BusinessAlert | null> {
    const mrrData = await prisma.$queryRaw<{
      current_mrr: number;
      previous_mrr: number;
      decline_rate: number;
    }[]>`
      WITH current_mrr AS (
        SELECT total_mrr_cents
        FROM mrr_snapshots
        WHERE snapshot_date = CURRENT_DATE
        ORDER BY snapshot_date DESC
        LIMIT 1
      ),
      previous_mrr AS (
        SELECT total_mrr_cents
        FROM mrr_snapshots
        WHERE snapshot_date = CURRENT_DATE - INTERVAL '1 month'
        ORDER BY snapshot_date DESC
        LIMIT 1
      )
      SELECT 
        c.total_mrr_cents as current_mrr,
        p.total_mrr_cents as previous_mrr,
        CASE 
          WHEN p.total_mrr_cents > 0 THEN 
            ((p.total_mrr_cents - c.total_mrr_cents)::DECIMAL / p.total_mrr_cents) * 100
          ELSE 0
        END as decline_rate
      FROM current_mrr c
      CROSS JOIN previous_mrr p
    `;

    const data = mrrData[0];
    if (!data || data.decline_rate < 5) return null; // Only alert for >5% decline

    const severity = data.decline_rate > 15 ? 'critical' : data.decline_rate > 10 ? 'high' : 'medium';

    return {
      alert_type: 'mrr_decline',
      alert_category: 'revenue',
      severity,
      title: 'MRR Decline Alert',
      message: `MRR has declined by ${data.decline_rate.toFixed(1)}% compared to last month. Current MRR: $${(data.current_mrr / 100).toFixed(2)}`,
      alert_data: {
        decline_rate: data.decline_rate,
        current_mrr: data.current_mrr,
        previous_mrr: data.previous_mrr
      },
      created_at: new Date()
    };
  }

  private async checkChurnSpike(): Promise<BusinessAlert | null> {
    const churnData = await prisma.$queryRaw<{
      current_churn_rate: number;
      historical_avg: number;
      spike_percentage: number;
    }[]>`
      WITH current_churn AS (
        SELECT 
          AVG(churn_probability) as current_churn_rate
        FROM customer_ltv_metrics
        WHERE last_calculated_at >= CURRENT_DATE - INTERVAL '7 days'
      ),
      historical_churn AS (
        SELECT 
          AVG(churn_probability) as historical_avg
        FROM customer_ltv_metrics
        WHERE last_calculated_at >= CURRENT_DATE - INTERVAL '30 days'
          AND last_calculated_at < CURRENT_DATE - INTERVAL '7 days'
      )
      SELECT 
        c.current_churn_rate,
        h.historical_avg,
        CASE 
          WHEN h.historical_avg > 0 THEN 
            ((c.current_churn_rate - h.historical_avg)::DECIMAL / h.historical_avg) * 100
          ELSE 0
        END as spike_percentage
      FROM current_churn c
      CROSS JOIN historical_churn h
    `;

    const data = churnData[0];
    if (!data || data.spike_percentage < 20) return null; // Only alert for >20% spike

    const severity = data.spike_percentage > 50 ? 'critical' : data.spike_percentage > 30 ? 'high' : 'medium';

    return {
      alert_type: 'churn_spike',
      alert_category: 'customer',
      severity,
      title: 'Churn Rate Spike Detected',
      message: `Churn rate has increased by ${data.spike_percentage.toFixed(1)}% compared to historical average. Current rate: ${(data.current_churn_rate * 100).toFixed(1)}%`,
      alert_data: {
        current_churn_rate: data.current_churn_rate,
        historical_avg: data.historical_avg,
        spike_percentage: data.spike_percentage
      },
      created_at: new Date()
    };
  }

  private async checkHighValueChurnRisk(): Promise<BusinessAlert | null> {
    const highValueRisk = await prisma.$queryRaw<{
      business_id: string;
      business_name: string;
      current_mrr: number;
      churn_probability: number;
    }[]>`
      SELECT 
        clm.business_id,
        b.name as business_name,
        clm.current_mrr_cents as current_mrr,
        clm.churn_probability
      FROM customer_ltv_metrics clm
      JOIN businesses b ON clm.business_id = b.id
      WHERE clm.churn_probability > 0.8
        AND clm.current_mrr_cents > 50000  -- High value customers (>$500/month)
        AND clm.last_calculated_at >= CURRENT_DATE - INTERVAL '1 day'
      ORDER BY clm.current_mrr_cents DESC
      LIMIT 5
    `;

    if (highValueRisk.length === 0) return null;

    const totalAtRisk = highValueRisk.reduce((sum, customer) => sum + customer.current_mrr, 0);

    return {
      alert_type: 'high_value_churn_risk',
      alert_category: 'customer',
      severity: 'critical',
      title: 'High-Value Customers at Risk',
      message: `${highValueRisk.length} high-value customers are at high churn risk, representing $${(totalAtRisk / 100).toFixed(2)} in monthly revenue.`,
      alert_data: {
        at_risk_customers: highValueRisk,
        total_revenue_at_risk: totalAtRisk
      },
      created_at: new Date()
    };
  }

  private async checkExpansionOpportunities(): Promise<BusinessAlert | null> {
    const expansionData = await prisma.$queryRaw<{
      opportunity_count: number;
      potential_revenue: number;
      high_probability_count: number;
    }[]>`
      SELECT 
        COUNT(*) as opportunity_count,
        SUM(potential_revenue_increase_cents) as potential_revenue,
        COUNT(CASE WHEN probability_of_conversion > 0.8 THEN 1 END) as high_probability_count
      FROM expansion_opportunities
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND probability_of_conversion > 0.6
    `;

    const data = expansionData[0];
    if (!data || data.opportunity_count < 5) return null;

    return {
      alert_type: 'expansion_opportunities',
      alert_category: 'customer',
      severity: 'medium',
      title: 'Expansion Opportunities Available',
      message: `${data.opportunity_count} expansion opportunities identified with potential revenue of $${(data.potential_revenue / 100).toFixed(2)}. ${data.high_probability_count} have high conversion probability.`,
      alert_data: {
        opportunity_count: data.opportunity_count,
        potential_revenue: data.potential_revenue,
        high_probability_count: data.high_probability_count
      },
      created_at: new Date()
    };
  }

  // ==============================================
  // HELPER METHODS
  // ==============================================

  private async storeInsights(insights: BusinessInsight[]): Promise<void> {
    for (const insight of insights) {
      await prisma.$executeRaw`
        INSERT INTO business_insights (
          insight_type,
          insight_category,
          title,
          description,
          impact_score,
          confidence_score,
          actionable,
          recommended_actions,
          insight_data
        ) VALUES (
          ${insight.insight_type},
          ${insight.insight_category},
          ${insight.title},
          ${insight.description},
          ${insight.impact_score},
          ${insight.confidence_score},
          ${insight.actionable},
          ${JSON.stringify(insight.recommended_actions)}::JSONB,
          ${JSON.stringify(insight.insight_data)}::JSONB
        )
      `;
    }
  }

  private async storeAlerts(alerts: BusinessAlert[]): Promise<void> {
    for (const alert of alerts) {
      await prisma.$executeRaw`
        INSERT INTO business_alerts (
          alert_type,
          alert_category,
          severity,
          title,
          message,
          business_id,
          alert_data
        ) VALUES (
          ${alert.alert_type},
          ${alert.alert_category},
          ${alert.severity},
          ${alert.title},
          ${alert.message},
          ${alert.business_id ? alert.business_id + '::UUID' : 'NULL'},
          ${JSON.stringify(alert.alert_data)}::JSONB
        )
      `;
    }
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return variance;
  }

  // Additional alert methods
  private async checkRevenueMilestones(): Promise<BusinessAlert | null> {
    const currentMRR = await prisma.$queryRaw<{ total_mrr_cents: number }[]>`
      SELECT total_mrr_cents
      FROM mrr_snapshots
      WHERE snapshot_date = CURRENT_DATE
      ORDER BY snapshot_date DESC
      LIMIT 1
    `;

    const mrr = currentMRR[0]?.total_mrr_cents || 0;
    const milestones = [1000000, 5000000, 10000000, 25000000, 50000000]; // $10k, $50k, $100k, $250k, $500k MRR

    for (const milestone of milestones) {
      if (mrr >= milestone && mrr < milestone * 1.1) { // Within 10% of milestone
        return {
          alert_type: 'revenue_milestone',
          alert_category: 'revenue',
          severity: 'low',
          title: 'Revenue Milestone Achieved',
          message: `Congratulations! You've reached $${(milestone / 100).toFixed(0)} MRR.`,
          alert_data: { milestone, current_mrr: mrr },
          created_at: new Date()
        };
      }
    }

    return null;
  }

  private async checkForecastVariance(): Promise<BusinessAlert | null> {
    const forecastData = await prisma.$queryRaw<{
      predicted_mrr: number;
      actual_mrr: number;
      variance_percentage: number;
    }[]>`
      WITH latest_forecast AS (
        SELECT predicted_mrr_cents
        FROM revenue_forecasts
        WHERE forecast_horizon_months = 1
        ORDER BY forecast_date DESC
        LIMIT 1
      ),
      current_mrr AS (
        SELECT total_mrr_cents
        FROM mrr_snapshots
        WHERE snapshot_date = CURRENT_DATE
        ORDER BY snapshot_date DESC
        LIMIT 1
      )
      SELECT 
        f.predicted_mrr_cents as predicted_mrr,
        c.total_mrr_cents as actual_mrr,
        CASE 
          WHEN f.predicted_mrr_cents > 0 THEN 
            ABS((c.total_mrr_cents - f.predicted_mrr_cents)::DECIMAL / f.predicted_mrr_cents) * 100
          ELSE 0
        END as variance_percentage
      FROM latest_forecast f
      CROSS JOIN current_mrr c
    `;

    const data = forecastData[0];
    if (!data || data.variance_percentage < 15) return null; // Only alert for >15% variance

    const severity = data.variance_percentage > 30 ? 'high' : 'medium';

    return {
      alert_type: 'forecast_variance',
      alert_category: 'revenue',
      severity,
      title: 'Revenue Forecast Variance Alert',
      message: `Actual MRR differs from forecast by ${data.variance_percentage.toFixed(1)}%. Predicted: $${(data.predicted_mrr / 100).toFixed(2)}, Actual: $${(data.actual_mrr / 100).toFixed(2)}`,
      alert_data: {
        predicted_mrr: data.predicted_mrr,
        actual_mrr: data.actual_mrr,
        variance_percentage: data.variance_percentage
      },
      created_at: new Date()
    };
  }

  private async checkSupportEscalation(): Promise<BusinessAlert | null> {
    const supportData = await prisma.$queryRaw<{
      business_id: string;
      business_name: string;
      error_count: number;
      recent_errors: number;
    }[]>`
      SELECT 
        ql.business_id,
        b.name as business_name,
        COUNT(*) as error_count,
        COUNT(CASE WHEN ql.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_errors
      FROM query_logs ql
      JOIN businesses b ON ql.business_id = b.id
      WHERE ql.status = 'ERROR'
        AND ql.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY ql.business_id, b.name
      HAVING COUNT(*) > 10 AND COUNT(CASE WHEN ql.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) > 3
      ORDER BY error_count DESC
      LIMIT 5
    `;

    if (supportData.length === 0) return null;

    return {
      alert_type: 'support_escalation',
      alert_category: 'customer',
      severity: 'medium',
      title: 'Customer Support Escalation Needed',
      message: `${supportData.length} customers showing elevated error rates requiring immediate attention.`,
      alert_data: { escalated_customers: supportData },
      created_at: new Date()
    };
  }

  private async checkUsageAnomalies(): Promise<BusinessAlert | null> {
    const usageData = await prisma.$queryRaw<{
      business_id: string;
      business_name: string;
      usage_change: number;
      current_usage: number;
    }[]>`
      WITH usage_comparison AS (
        SELECT 
          business_id,
          COUNT(*) as current_usage,
          LAG(COUNT(*)) OVER (PARTITION BY business_id ORDER BY DATE(created_at)) as previous_usage
        FROM query_logs
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY business_id, DATE(created_at)
      )
      SELECT 
        uc.business_id,
        b.name as business_name,
        uc.current_usage,
        CASE 
          WHEN uc.previous_usage > 0 THEN 
            ((uc.current_usage - uc.previous_usage)::DECIMAL / uc.previous_usage) * 100
          ELSE 0
        END as usage_change
      FROM usage_comparison uc
      JOIN businesses b ON uc.business_id = b.id
      WHERE ABS(usage_change) > 50  -- >50% change
      ORDER BY ABS(usage_change) DESC
      LIMIT 5
    `;

    if (usageData.length === 0) return null;

    return {
      alert_type: 'usage_anomalies',
      alert_category: 'customer',
      severity: 'medium',
      title: 'Usage Pattern Anomalies Detected',
      message: `${usageData.length} customers showing unusual usage pattern changes requiring investigation.`,
      alert_data: { anomalous_customers: usageData },
      created_at: new Date()
    };
  }

  private async checkPaymentFailureTrends(): Promise<BusinessAlert | null> {
    const paymentData = await prisma.$queryRaw<{
      failure_rate: number;
      total_payments: number;
      failed_payments: number;
    }[]>`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
        CASE 
          WHEN COUNT(*) > 0 THEN 
            (COUNT(CASE WHEN status = 'failed' THEN 1 END)::DECIMAL / COUNT(*)) * 100
          ELSE 0
        END as failure_rate
      FROM payment_history
      WHERE processed_at >= NOW() - INTERVAL '7 days'
    `;

    const data = paymentData[0];
    if (!data || data.failure_rate < 10) return null; // Only alert for >10% failure rate

    const severity = data.failure_rate > 20 ? 'high' : 'medium';

    return {
      alert_type: 'payment_failure_trends',
      alert_category: 'operational',
      severity,
      title: 'Payment Failure Rate Alert',
      message: `Payment failure rate is ${data.failure_rate.toFixed(1)}% (${data.failed_payments}/${data.total_payments} payments). This is above normal thresholds.`,
      alert_data: {
        failure_rate: data.failure_rate,
        total_payments: data.total_payments,
        failed_payments: data.failed_payments
      },
      created_at: new Date()
    };
  }

  private async checkPlanPerformanceIssues(): Promise<BusinessAlert | null> {
    const planData = await prisma.$queryRaw<{
      plan_id: string;
      churn_rate: number;
      satisfaction_score: number;
      subscriber_count: number;
    }[]>`
      SELECT 
        plan_id,
        AVG(churn_rate) as churn_rate,
        AVG(plan_satisfaction_score) as satisfaction_score,
        SUM(total_subscribers) as subscriber_count
      FROM plan_analytics
      WHERE analysis_period_end >= CURRENT_DATE - INTERVAL '1 month'
      GROUP BY plan_id
      HAVING AVG(churn_rate) > 0.15 OR AVG(plan_satisfaction_score) < 3.0
      ORDER BY AVG(churn_rate) DESC
    `;

    if (planData.length === 0) return null;

    return {
      alert_type: 'plan_performance_issues',
      alert_category: 'operational',
      severity: 'medium',
      title: 'Plan Performance Issues Detected',
      message: `${planData.length} plan(s) showing concerning performance metrics including high churn rates or low satisfaction scores.`,
      alert_data: { underperforming_plans: planData },
      created_at: new Date()
    };
  }

  private async checkSeasonalCapacityNeeds(): Promise<BusinessAlert | null> {
    // Simplified seasonal capacity analysis
    const capacityData = await prisma.$queryRaw<{
      current_load: number;
      projected_load: number;
      capacity_utilization: number;
    }[]>`
      SELECT 
        COUNT(*) as current_load,
        COUNT(*) * 1.2 as projected_load,
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(*)::DECIMAL / 1000) * 100  -- Assuming 1000 as capacity limit
          ELSE 0
        END as capacity_utilization
      FROM query_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;

    const data = capacityData[0];
    if (!data || data.capacity_utilization < 80) return null; // Only alert for >80% utilization

    return {
      alert_type: 'seasonal_capacity_needs',
      alert_category: 'operational',
      severity: 'medium',
      title: 'Capacity Utilization Alert',
      message: `Current system load is at ${data.capacity_utilization.toFixed(1)}% capacity. Consider scaling resources for upcoming seasonal demand.`,
      alert_data: {
        current_load: data.current_load,
        projected_load: data.projected_load,
        capacity_utilization: data.capacity_utilization
      },
      created_at: new Date()
    };
  }

  /**
   * Analyze market opportunities
   */
  private async analyzeMarketOpportunities(): Promise<BusinessInsight | null> {
    // Simplified market opportunity analysis
    const marketData = await prisma.business.count();
    
    if (marketData < 100) {
      return {
        insight_type: 'market_opportunity',
        insight_category: 'growth',
        title: 'Market Expansion Opportunity',
        description: 'Current market penetration is low, indicating significant growth potential.',
        impact_score: 85,
        confidence_score: 0.8,
        actionable: true,
        recommended_actions: ['Increase marketing spend', 'Expand to new markets', 'Develop partnerships'],
        insight_data: { market_size: marketData, opportunity_score: 0.8 },
        generated_at: new Date()
      };
    }
    
    return null;
  }

  /**
   * Analyze competitive positioning
   */
  private async analyzeCompetitivePositioning(): Promise<BusinessInsight | null> {
    // Simplified competitive analysis
    const avgRevenue = await prisma.$queryRaw<{ avg_revenue: number }[]>`
      SELECT AVG(total_revenue_cents) as avg_revenue 
      FROM customer_ltv_metrics 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;
    
    const avgRev = avgRevenue[0]?.avg_revenue || 0;
    
    if (avgRev < 50000) { // Less than $500 average
      return {
        insight_type: 'competitive_positioning',
        insight_category: 'strategy',
        title: 'Competitive Positioning Risk',
        description: 'Average customer value is below market standards, indicating potential competitive disadvantage.',
        impact_score: 75,
        confidence_score: 0.7,
        actionable: true,
        recommended_actions: ['Improve value proposition', 'Enhance customer experience', 'Review pricing strategy'],
        insight_data: { avg_customer_value: avgRev, competitive_score: 0.6 },
        generated_at: new Date()
      };
    }
    
    return null;
  }

  /**
   * Analyze operational efficiency
   */
  private async analyzeOperationalEfficiency(): Promise<BusinessInsight | null> {
    // Simplified operational efficiency analysis
    const queryCount = await prisma.queryLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    });
    
    const businessCount = await prisma.business.count();
    const efficiencyRatio = businessCount > 0 ? queryCount / businessCount : 0;
    
    if (efficiencyRatio < 10) { // Less than 10 queries per business per month
      return {
        insight_type: 'operational_efficiency',
        insight_category: 'operations',
        title: 'Low Platform Utilization',
        description: 'Platform usage is below optimal levels, indicating potential efficiency improvements.',
        impact_score: 70,
        confidence_score: 0.8,
        actionable: true,
        recommended_actions: ['Improve user onboarding', 'Enhance feature discoverability', 'Provide training resources'],
        insight_data: { utilization_rate: efficiencyRatio, efficiency_score: 0.5 },
        generated_at: new Date()
      };
    }
    
    return null;
  }

  /**
   * Analyze investment priorities
   */
  private async analyzeInvestmentPriorities(): Promise<BusinessInsight | null> {
    // Simplified investment priority analysis
    const churnRate = await prisma.$queryRaw<{ churn_rate: number }[]>`
      SELECT 
        (COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::DECIMAL / COUNT(*)) * 100 as churn_rate
      FROM subscriptions 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;
    
    const rate = churnRate[0]?.churn_rate || 0;
    
    if (rate > 5) { // More than 5% churn rate
      return {
        insight_type: 'investment_priority',
        insight_category: 'retention',
        title: 'High Priority: Customer Retention',
        description: 'Churn rate is above acceptable levels, requiring immediate investment in retention initiatives.',
        impact_score: 90,
        confidence_score: 0.9,
        actionable: true,
        recommended_actions: ['Implement retention campaigns', 'Improve customer support', 'Add value-added features'],
        insight_data: { churn_rate: rate, priority_score: 0.9 },
        generated_at: new Date()
      };
    }
    
    return null;
  }
}

export const insightsEngine = new InsightsEngine();
