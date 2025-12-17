// lib/analytics-processor.ts
import { PrismaClient } from '@prisma/client';
import {
  DailyConversationMetrics,
  HourlyPerformanceMetrics,
  ConversationTopics,
  CustomerPatterns,
  TimeSeriesData,
  ConversationFlow,
  TopicSatisfaction,
  CostBreakdown,
  TemplateMetrics,
  RuleImpactAnalysis,
  AnalyticsContext,
  BusinessIntelligenceInsight
} from './analytics-types';

export class AnalyticsProcessor {
  private prisma: PrismaClient;
  private processingQueue: Map<string, any[]> = new Map();
  private batchSize = 100;
  private processingInterval = 30000; // 30 seconds

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.startBatchProcessing();
  }

  /**
   * Process real-time conversation events
   */
  async processConversationEvent(event: {
    type: 'conversation_start' | 'conversation_end' | 'message_sent' | 'satisfaction_feedback';
    business_id: string;
    session_id: string;
    customer_id?: string;
    data: any;
    timestamp: Date;
  }): Promise<void> {
    const queueKey = `${event.business_id}_${event.type}`;
    
    if (!this.processingQueue.has(queueKey)) {
      this.processingQueue.set(queueKey, []);
    }
    
    this.processingQueue.get(queueKey)!.push(event);
    
    // Process immediately for critical events
    if (event.type === 'satisfaction_feedback' || event.type === 'conversation_end') {
      await this.processBatch(queueKey);
    }
  }

  /**
   * Process query performance metrics
   */
  async processQueryPerformance(metrics: {
    business_id: string;
    query_id: string;
    response_time_ms: number;
    tokens_used: number;
    cost: number;
    success: boolean;
    cache_hit: boolean;
    timestamp: Date;
  }): Promise<void> {
    const queueKey = `${metrics.business_id}_query_performance`;
    
    if (!this.processingQueue.has(queueKey)) {
      this.processingQueue.set(queueKey, []);
    }
    
    this.processingQueue.get(queueKey)!.push(metrics);
  }

  /**
   * Start batch processing for analytics aggregation
   */
  private startBatchProcessing(): void {
    setInterval(async () => {
      for (const [queueKey, events] of this.processingQueue.entries()) {
        if (events.length >= this.batchSize) {
          await this.processBatch(queueKey);
        }
      }
    }, this.processingInterval);
  }

  /**
   * Process a batch of events
   */
  private async processBatch(queueKey: string): Promise<void> {
    const events = this.processingQueue.get(queueKey) || [];
    if (events.length === 0) return;

    const [businessId, eventType] = queueKey.split('_');
    
    try {
      switch (eventType) {
        case 'conversation_start':
        case 'conversation_end':
        case 'message_sent':
        case 'satisfaction_feedback':
          await this.aggregateConversationMetrics(businessId, events);
          break;
        case 'query_performance':
          await this.aggregatePerformanceMetrics(businessId, events);
          break;
      }
      
      // Clear processed events
      this.processingQueue.set(queueKey, []);
    } catch (error) {
      console.error(`Error processing batch for ${queueKey}:`, error);
    }
  }

  /**
   * Aggregate conversation metrics
   */
  private async aggregateConversationMetrics(businessId: string, events: any[]): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get or create daily metrics record
    let dailyMetrics = await this.prisma.dailyConversationMetrics.findFirst({
      where: { business_id: businessId, date: today }
    }) as DailyConversationMetrics | null;

    if (!dailyMetrics) {
      dailyMetrics = await this.prisma.dailyConversationMetrics.create({
        data: {
          id: `daily_${businessId}_${today.getTime()}`,
          business_id: businessId,
          date: today,
          total_conversations: 0,
          total_queries: 0,
          avg_conversation_length: 0,
          avg_response_time_ms: 0,
          satisfaction_score: 0,
          resolution_rate: 0,
          escalation_rate: 0,
          unique_customers: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      }) as DailyConversationMetrics;
    }

    // Process events and update metrics
    const conversationStarts = events.filter(e => e.type === 'conversation_start');
    const conversationEnds = events.filter(e => e.type === 'conversation_end');
    const messages = events.filter(e => e.type === 'message_sent');
    const satisfactionEvents = events.filter(e => e.type === 'satisfaction_feedback');

    // Update metrics
    const updates: Partial<DailyConversationMetrics> = {
      total_conversations: dailyMetrics.total_conversations + conversationStarts.length,
      total_queries: dailyMetrics.total_queries + messages.length,
      updated_at: new Date()
    };

    // Calculate satisfaction score
    if (satisfactionEvents.length > 0) {
      const totalSatisfaction = satisfactionEvents.reduce((sum, e) => sum + (e.data.rating || 0), 0);
      const avgSatisfaction = totalSatisfaction / satisfactionEvents.length;
      updates.satisfaction_score = (dailyMetrics.satisfaction_score + avgSatisfaction) / 2;
    }

    // Calculate resolution rate
    if (conversationEnds.length > 0) {
      const resolvedConversations = conversationEnds.filter(e => e.data.resolved).length;
      const resolutionRate = resolvedConversations / conversationEnds.length;
      updates.resolution_rate = (dailyMetrics.resolution_rate + resolutionRate) / 2;
    }

    await this.prisma.dailyConversationMetrics.update({
      where: { id: dailyMetrics.id },
      data: updates
    });
  }

  /**
   * Aggregate performance metrics
   */
  private async aggregatePerformanceMetrics(businessId: string, events: any[]): Promise<void> {
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    
    // Get or create hourly metrics record
    let hourlyMetrics = await this.prisma.hourlyPerformanceMetrics.findFirst({
      where: { business_id: businessId, hour_timestamp: hourStart }
    }) as HourlyPerformanceMetrics | null;

    if (!hourlyMetrics) {
      hourlyMetrics = await this.prisma.hourlyPerformanceMetrics.create({
        data: {
          id: `hourly_${businessId}_${hourStart.getTime()}`,
          business_id: businessId,
          hour_timestamp: hourStart,
          query_count: 0,
          avg_response_time_ms: 0,
          error_rate: 0,
          cache_hit_rate: 0,
          token_usage: 0,
          estimated_cost: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      }) as HourlyPerformanceMetrics;
    }

    // Calculate aggregated metrics
    const totalQueries = events.length;
    const successfulQueries = events.filter(e => e.success).length;
    const cacheHits = events.filter(e => e.cache_hit).length;
    const totalResponseTime = events.reduce((sum, e) => sum + e.response_time_ms, 0);
    const totalTokens = events.reduce((sum, e) => sum + e.tokens_used, 0);
    const totalCost = events.reduce((sum, e) => sum + e.cost, 0);

    const updates: Partial<HourlyPerformanceMetrics> = {
      query_count: hourlyMetrics.query_count + totalQueries,
      avg_response_time_ms: totalResponseTime / totalQueries,
      error_rate: (totalQueries - successfulQueries) / totalQueries,
      cache_hit_rate: cacheHits / totalQueries,
      token_usage: hourlyMetrics.token_usage + totalTokens,
      estimated_cost: hourlyMetrics.estimated_cost + totalCost,
      updated_at: new Date()
    };

    await this.prisma.hourlyPerformanceMetrics.update({
      where: { id: hourlyMetrics.id },
      data: updates
    });
  }

  /**
   * Get conversation analytics for a business
   */
  async getConversationAnalytics(context: AnalyticsContext): Promise<{
    conversation_metrics: any;
    topic_analysis: TopicSatisfaction[];
    customer_journey: any;
    satisfaction_analysis: any;
  }> {
    const { business_id, date_range } = context;

    // Get conversation metrics
    const dailyMetrics = await this.prisma.dailyConversationMetrics.findMany({
      where: {
        business_id,
        date: {
          gte: date_range.start_date,
          lte: date_range.end_date
        }
      }
    }) as DailyConversationMetrics[];

    // Aggregate metrics
    const conversationMetrics = {
      total_conversations: dailyMetrics.reduce((sum, m) => sum + m.total_conversations, 0),
      avg_conversation_length: dailyMetrics.reduce((sum, m) => sum + m.avg_conversation_length, 0) / dailyMetrics.length,
      resolution_rate: dailyMetrics.reduce((sum, m) => sum + m.resolution_rate, 0) / dailyMetrics.length,
      escalation_rate: dailyMetrics.reduce((sum, m) => sum + m.escalation_rate, 0) / dailyMetrics.length,
      repeat_customer_rate: 0.75 // Placeholder - would need customer analysis
    };

    // Get topic analysis
    const topicData = await this.prisma.conversationTopics.findMany({
      where: {
        business_id,
        date: {
          gte: date_range.start_date,
          lte: date_range.end_date
        }
      }
    }) as ConversationTopics[];

    const topicAnalysis: TopicSatisfaction[] = topicData.map(topic => ({
      topic: topic.topic_category,
      satisfaction_score: topic.avg_satisfaction,
      conversation_count: topic.frequency,
      trend_direction: 'stable' // Placeholder - would need trend analysis
    }));

    // Customer journey analysis (simplified)
    const customerJourney = {
      entry_points: [],
      conversation_flows: [],
      drop_off_points: [],
      successful_pathways: []
    };

    // Satisfaction analysis
    const satisfactionAnalysis = {
      overall_score: dailyMetrics.reduce((sum, m) => sum + m.satisfaction_score, 0) / dailyMetrics.length,
      satisfaction_by_topic: topicAnalysis,
      satisfaction_trends: [],
      improvement_opportunities: []
    };

    return {
      conversation_metrics: conversationMetrics,
      topic_analysis: topicAnalysis,
      customer_journey: customerJourney,
      satisfaction_analysis: satisfactionAnalysis
    };
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(context: AnalyticsContext): Promise<{
    response_performance: any;
    cost_analysis: CostBreakdown[];
    quality_metrics: any;
    usage_patterns: any;
  }> {
    const { business_id, date_range } = context;

    // Get hourly performance metrics
    const hourlyMetrics = await this.prisma.hourlyPerformanceMetrics.findMany({
      where: {
        business_id,
        hour_timestamp: {
          gte: date_range.start_date,
          lte: date_range.end_date
        }
      }
    }) as HourlyPerformanceMetrics[];

    // Calculate response performance
    const totalQueries = hourlyMetrics.reduce((sum, m) => sum + m.query_count, 0);
    const avgResponseTime = hourlyMetrics.reduce((sum, m) => sum + m.avg_response_time_ms, 0) / hourlyMetrics.length;
    const avgErrorRate = hourlyMetrics.reduce((sum, m) => sum + m.error_rate, 0) / hourlyMetrics.length;
    const avgCacheHitRate = hourlyMetrics.reduce((sum, m) => sum + m.cache_hit_rate, 0) / hourlyMetrics.length;

    const responsePerformance = {
      avg_response_time_ms: avgResponseTime,
      percentile_95th_response_time: avgResponseTime * 1.5, // Simplified calculation
      cache_hit_rate: avgCacheHitRate,
      error_rate: avgErrorRate
    };

    // Cost analysis
    const totalCost = hourlyMetrics.reduce((sum, m) => sum + m.estimated_cost, 0);
    const totalTokens = hourlyMetrics.reduce((sum, m) => sum + m.token_usage, 0);

    const costAnalysis: CostBreakdown[] = [
      {
        feature: 'Query Processing',
        cost: totalCost * 0.7,
        percentage: 70,
        token_usage: totalTokens * 0.7
      },
      {
        feature: 'Streaming',
        cost: totalCost * 0.2,
        percentage: 20,
        token_usage: totalTokens * 0.2
      },
      {
        feature: 'Batch Processing',
        cost: totalCost * 0.1,
        percentage: 10,
        token_usage: totalTokens * 0.1
      }
    ];

    // Quality metrics
    const qualityMetrics = {
      response_accuracy_score: 0.85, // Placeholder
      hallucination_detection_rate: 0.02, // Placeholder
      template_effectiveness: [],
      business_rule_impact: []
    };

    // Usage patterns
    const usagePatterns = {
      peak_hours: hourlyMetrics.map(m => ({
        hour: m.hour_timestamp.getHours(),
        query_count: m.query_count
      })),
      seasonal_trends: [],
      feature_adoption: [],
      user_engagement: []
    };

    return {
      response_performance: responsePerformance,
      cost_analysis: costAnalysis,
      quality_metrics: qualityMetrics,
      usage_patterns: usagePatterns
    };
  }

  /**
   * Generate business intelligence insights
   */
  async generateBusinessIntelligenceInsights(businessId: string): Promise<BusinessIntelligenceInsight[]> {
    const insights: BusinessIntelligenceInsight[] = [];

    // Get recent metrics
    const recentMetrics = await this.prisma.dailyConversationMetrics.findMany({
      where: { business_id: businessId },
      orderBy: { date: 'desc' },
      take: 7
    }) as DailyConversationMetrics[];

    if (recentMetrics.length >= 2) {
      const latest = recentMetrics[0];
      const previous = recentMetrics[1];

      // Satisfaction trend analysis
      if (latest.satisfaction_score < previous.satisfaction_score - 0.1) {
        insights.push({
          insight_type: 'warning',
          title: 'Customer Satisfaction Declining',
          description: `Satisfaction score dropped from ${previous.satisfaction_score.toFixed(2)} to ${latest.satisfaction_score.toFixed(2)}`,
          impact_score: 8,
          confidence_level: 0.9,
          recommended_action: 'Review recent conversations and identify quality issues',
          data_points: [latest.satisfaction_score, previous.satisfaction_score],
          created_at: new Date()
        });
      }

      // Conversation volume trend
      if (latest.total_conversations > previous.total_conversations * 1.5) {
        insights.push({
          insight_type: 'opportunity',
          title: 'High Conversation Volume',
          description: `Conversation volume increased by ${((latest.total_conversations / previous.total_conversations - 1) * 100).toFixed(1)}%`,
          impact_score: 6,
          confidence_level: 0.8,
          recommended_action: 'Consider scaling resources or optimizing response times',
          data_points: [latest.total_conversations, previous.total_conversations],
          created_at: new Date()
        });
      }
    }

    return insights;
  }
}

let analyticsProcessorInstance: AnalyticsProcessor | null = null;

export function getAnalyticsProcessor(prisma: PrismaClient): AnalyticsProcessor {
  if (!analyticsProcessorInstance) {
    analyticsProcessorInstance = new AnalyticsProcessor(prisma);
  }
  return analyticsProcessorInstance;
}
