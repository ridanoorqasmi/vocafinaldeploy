// app/api/v1/analytics/overview/route.ts
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
    const periodGranularity = searchParams.get('periodGranularity') || 'day';
    const metrics = searchParams.get('metrics')?.split(',') || ['conversations', 'satisfaction', 'cost'];

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    // Set default date range if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Get conversation analytics
    const conversationAnalytics = await analyticsProcessor.getConversationAnalytics({
      business_id: businessId,
      date_range: { start_date: start, end_date: end },
      metrics,
      granularity: periodGranularity as any
    });

    // Get performance analytics
    const performanceAnalytics = await analyticsProcessor.getPerformanceAnalytics({
      business_id: businessId,
      date_range: { start_date: start, end_date: end },
      metrics,
      granularity: periodGranularity as any
    });

    // Get business intelligence insights
    const insights = await businessIntelligenceEngine.generateComprehensiveInsights(businessId, {
      start,
      end
    });

    // Calculate overview metrics
    const overview = {
      total_conversations: conversationAnalytics.conversation_metrics.total_conversations,
      total_unique_customers: conversationAnalytics.conversation_metrics.total_conversations * 0.8, // Estimated
      avg_satisfaction_score: conversationAnalytics.satisfaction_analysis.overall_score,
      total_cost: performanceAnalytics.cost_analysis.reduce((sum, cost) => sum + cost.cost, 0),
      cost_per_conversation: conversationAnalytics.conversation_metrics.total_conversations > 0 
        ? performanceAnalytics.cost_analysis.reduce((sum, cost) => sum + cost.cost, 0) / conversationAnalytics.conversation_metrics.total_conversations
        : 0
    };

    // Generate trends data
    const trends = {
      conversation_volume: this.generateTrendData(conversationAnalytics.conversation_metrics.total_conversations, start, end),
      satisfaction_trend: this.generateTrendData(conversationAnalytics.satisfaction_analysis.overall_score, start, end),
      response_time_trend: this.generateTrendData(performanceAnalytics.response_performance.avg_response_time_ms, start, end),
      cost_trend: this.generateTrendData(performanceAnalytics.cost_analysis.reduce((sum, cost) => sum + cost.cost, 0), start, end)
    };

    // Get top insights
    const topInsights = insights.slice(0, 5).map(insight => ({
      insight_type: insight.insight_type,
      title: insight.title,
      description: insight.description,
      impact_score: insight.impact_score,
      recommended_action: insight.recommended_action
    }));

    return NextResponse.json({
      overview,
      trends,
      top_insights: topInsights,
      metadata: {
        date_range: { start_date: start.toISOString(), end_date: end.toISOString() },
        granularity: periodGranularity,
        generated_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error getting analytics overview:', error);
    return NextResponse.json({ error: error.message || 'Failed to get analytics overview' }, { status: 500 });
  }
}

// Helper function to generate trend data
function generateTrendData(baseValue: number, startDate: Date, endDate: Date) {
  const data = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  for (let i = 0; i <= daysDiff; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    data.push({
      timestamp: date.toISOString(),
      value: baseValue + (Math.random() - 0.5) * baseValue * 0.2
    });
  }
  
  return data;
}
