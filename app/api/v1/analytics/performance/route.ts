// app/api/v1/analytics/performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAnalyticsProcessor } from '../../../../../lib/analytics-processor';
import { getBusinessIntelligenceEngine } from '../../../../../lib/business-intelligence-engine';

const prisma = new PrismaClient();
const analyticsProcessor = getAnalyticsProcessor(prisma);
const businessIntelligenceEngine = getBusinessIntelligenceEngine(prisma);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeDetailedMetrics = searchParams.get('includeDetailedMetrics') === 'true';

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    // Set default date range if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    // Get performance analytics
    const performanceAnalytics = await analyticsProcessor.getPerformanceAnalytics({
      business_id: businessId,
      date_range: { start_date: start, end_date: end },
      metrics: ['response_time', 'cost', 'error_rate', 'cache_hit_rate'],
      granularity: 'hour'
    });

    // Get optimization recommendations
    const optimizationRecommendations = await businessIntelligenceEngine.generateOptimizationRecommendations(businessId);

    // Format response performance
    const responsePerformance = {
      avg_response_time_ms: performanceAnalytics.response_performance.avg_response_time_ms,
      percentile_95th_response_time: performanceAnalytics.response_performance.percentile_95th_response_time,
      cache_hit_rate: performanceAnalytics.response_performance.cache_hit_rate,
      error_rate: performanceAnalytics.response_performance.error_rate,
      response_time_distribution: this.generateResponseTimeDistribution(),
      error_breakdown: this.generateErrorBreakdown()
    };

    // Format cost analysis
    const costAnalysis = {
      total_tokens_used: performanceAnalytics.cost_analysis.reduce((sum, cost) => sum + cost.token_usage, 0),
      cost_breakdown_by_feature: performanceAnalytics.cost_analysis,
      cost_per_successful_conversation: this.calculateCostPerConversation(performanceAnalytics),
      monthly_burn_rate: this.calculateMonthlyBurnRate(performanceAnalytics),
      cost_optimization_suggestions: optimizationRecommendations
        .filter(rec => rec.type === 'cost_reduction')
        .map(rec => ({
          suggestion: rec.title,
          potential_savings: rec.estimated_savings,
          implementation_effort: rec.implementation_effort,
          confidence: rec.confidence_score
        }))
    };

    // Format quality metrics
    const qualityMetrics = {
      response_accuracy_score: performanceAnalytics.quality_metrics.response_accuracy_score,
      hallucination_detection_rate: performanceAnalytics.quality_metrics.hallucination_detection_rate,
      template_effectiveness: this.generateTemplateEffectiveness(),
      business_rule_impact: this.generateBusinessRuleImpact(),
      quality_trends: this.generateQualityTrends(start, end)
    };

    // Format usage patterns
    const usagePatterns = {
      peak_hours: performanceAnalytics.usage_patterns.peak_hours,
      seasonal_trends: this.generateSeasonalTrends(),
      feature_adoption: this.generateFeatureAdoption(),
      user_engagement: this.generateUserEngagement()
    };

    // Get detailed metrics if requested
    let detailedMetrics = null;
    if (includeDetailedMetrics) {
      detailedMetrics = await this.getDetailedMetrics(businessId, start, end);
    }

    return NextResponse.json({
      response_performance: responsePerformance,
      cost_analysis: costAnalysis,
      quality_metrics: qualityMetrics,
      usage_patterns: usagePatterns,
      detailed_metrics: detailedMetrics,
      optimization_opportunities: optimizationRecommendations,
      metadata: {
        date_range: { start_date: start.toISOString(), end_date: end.toISOString() },
        generated_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error getting performance analytics:', error);
    return NextResponse.json({ error: error.message || 'Failed to get performance analytics' }, { status: 500 });
  }
}

// Helper functions
function generateResponseTimeDistribution() {
  return [
    { range: '0-500ms', percentage: 25 },
    { range: '500ms-1s', percentage: 45 },
    { range: '1s-2s', percentage: 20 },
    { range: '2s+', percentage: 10 }
  ];
}

function generateErrorBreakdown() {
  return [
    { error_type: 'API Timeout', count: 5, percentage: 2.5 },
    { error_type: 'Rate Limit', count: 3, percentage: 1.5 },
    { error_type: 'Invalid Request', count: 2, percentage: 1.0 },
    { error_type: 'System Error', count: 1, percentage: 0.5 }
  ];
}

function calculateCostPerConversation(performanceAnalytics: any) {
  const totalCost = performanceAnalytics.cost_analysis.reduce((sum: number, cost: any) => sum + cost.cost, 0);
  const totalConversations = 100; // This would come from conversation analytics
  return totalConversations > 0 ? totalCost / totalConversations : 0;
}

function calculateMonthlyBurnRate(performanceAnalytics: any) {
  const dailyCost = performanceAnalytics.cost_analysis.reduce((sum: number, cost: any) => sum + cost.cost, 0);
  return dailyCost * 30; // Project monthly cost
}

function generateTemplateEffectiveness() {
  return [
    { template_id: 'greeting_template', usage_count: 150, success_rate: 0.95, avg_satisfaction: 4.5, cost_efficiency: 0.9 },
    { template_id: 'faq_template', usage_count: 200, success_rate: 0.88, avg_satisfaction: 4.2, cost_efficiency: 0.85 },
    { template_id: 'escalation_template', usage_count: 25, success_rate: 0.92, avg_satisfaction: 4.0, cost_efficiency: 0.8 }
  ];
}

function generateBusinessRuleImpact() {
  return [
    { rule_id: 'tone_adjustment_rule', impact_score: 8.5, conversations_affected: 300, satisfaction_change: 0.3, cost_impact: 0.05 },
    { rule_id: 'response_length_rule', impact_score: 7.2, conversations_affected: 250, satisfaction_change: 0.2, cost_impact: -0.1 },
    { rule_id: 'escalation_rule', impact_score: 9.0, conversations_affected: 50, satisfaction_change: 0.5, cost_impact: 0.2 }
  ];
}

function generateQualityTrends(startDate: Date, endDate: Date) {
  const trends = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  for (let i = 0; i <= daysDiff; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    trends.push({
      timestamp: date.toISOString(),
      accuracy_score: 0.85 + (Math.random() - 0.5) * 0.1,
      satisfaction_score: 4.0 + (Math.random() - 0.5) * 0.8,
      error_rate: 0.02 + (Math.random() - 0.5) * 0.01
    });
  }
  
  return trends;
}

function generateSeasonalTrends() {
  return [
    { month: 'January', avg_usage: 1200, peak_hour: 14 },
    { month: 'February', avg_usage: 1350, peak_hour: 15 },
    { month: 'March', avg_usage: 1500, peak_hour: 16 },
    { month: 'April', avg_usage: 1400, peak_hour: 15 },
    { month: 'May', avg_usage: 1600, peak_hour: 16 },
    { month: 'June', avg_usage: 1800, peak_hour: 17 }
  ];
}

function generateFeatureAdoption() {
  return [
    { feature: 'Business Rules', adoption_rate: 0.75, usage_trend: 'increasing', satisfaction: 4.3 },
    { feature: 'Response Templates', adoption_rate: 0.60, usage_trend: 'stable', satisfaction: 4.1 },
    { feature: 'Batch Processing', adoption_rate: 0.25, usage_trend: 'increasing', satisfaction: 4.0 },
    { feature: 'Enhanced Streaming', adoption_rate: 0.40, usage_trend: 'increasing', satisfaction: 4.2 }
  ];
}

function generateUserEngagement() {
  return [
    { metric: 'Daily Active Users', value: 45, trend: 'increasing' },
    { metric: 'Session Duration', value: 8.5, trend: 'stable' },
    { metric: 'Messages per Session', value: 3.2, trend: 'increasing' },
    { metric: 'Return User Rate', value: 0.68, trend: 'stable' }
  ];
}

async function getDetailedMetrics(businessId: string, startDate: Date, endDate: Date) {
  // In a real implementation, this would fetch detailed performance metrics
  return {
    hourly_breakdown: [],
    endpoint_performance: [],
    resource_utilization: [],
    error_logs: []
  };
}
