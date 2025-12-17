// lib/business-intelligence-engine.ts
import { PrismaClient } from '@prisma/client';
import {
  BusinessIntelligenceInsight,
  TimeSeriesData,
  ConversationFlow,
  TopicSatisfaction,
  CostBreakdown,
  TemplateMetrics,
  RuleImpactAnalysis,
  AnalyticsContext
} from './analytics-types';

export interface SentimentAnalysis {
  overall_sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;
  confidence: number;
  trend_direction: 'improving' | 'stable' | 'declining';
}

export interface TopicCluster {
  cluster_id: string;
  topic_name: string;
  frequency: number;
  avg_satisfaction: number;
  resolution_rate: number;
  trending_direction: 'up' | 'down' | 'stable';
  related_topics: string[];
}

export interface CustomerSegment {
  segment_id: string;
  segment_name: string;
  customer_count: number;
  avg_satisfaction: number;
  avg_conversation_length: number;
  preferred_topics: string[];
  churn_risk: 'low' | 'medium' | 'high';
}

export interface OptimizationRecommendation {
  type: 'cost_reduction' | 'satisfaction_improvement' | 'efficiency_gain' | 'feature_usage';
  title: string;
  description: string;
  potential_impact: number;
  implementation_effort: 'low' | 'medium' | 'high';
  estimated_savings?: number;
  confidence_score: number;
}

export class BusinessIntelligenceEngine {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Analyze conversation sentiment and emotional tone
   */
  async analyzeConversationSentiment(businessId: string, dateRange: { start: Date; end: Date }): Promise<SentimentAnalysis> {
    // Get conversation data with satisfaction scores
    const dailyMetrics = await this.prisma.dailyConversationMetrics.findMany({
      where: {
        business_id: businessId,
        date: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      },
      orderBy: { date: 'asc' }
    }) as any[];

    if (dailyMetrics.length === 0) {
      return {
        overall_sentiment: 'neutral',
        sentiment_score: 0.5,
        confidence: 0,
        trend_direction: 'stable'
      };
    }

    // Calculate overall sentiment based on satisfaction scores
    const avgSatisfaction = dailyMetrics.reduce((sum, m) => sum + m.satisfaction_score, 0) / dailyMetrics.length;
    const sentimentScore = avgSatisfaction / 5; // Assuming 5-point scale

    // Determine sentiment category
    let overallSentiment: 'positive' | 'neutral' | 'negative';
    if (sentimentScore >= 0.7) {
      overallSentiment = 'positive';
    } else if (sentimentScore >= 0.4) {
      overallSentiment = 'neutral';
    } else {
      overallSentiment = 'negative';
    }

    // Calculate trend direction
    const recentScores = dailyMetrics.slice(-3).map(m => m.satisfaction_score);
    const olderScores = dailyMetrics.slice(0, 3).map(m => m.satisfaction_score);
    const recentAvg = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((sum, s) => sum + s, 0) / olderScores.length;

    let trendDirection: 'improving' | 'stable' | 'declining';
    if (recentAvg > olderAvg + 0.1) {
      trendDirection = 'improving';
    } else if (recentAvg < olderAvg - 0.1) {
      trendDirection = 'declining';
    } else {
      trendDirection = 'stable';
    }

    return {
      overall_sentiment: overallSentiment,
      sentiment_score: sentimentScore,
      confidence: 0.8, // Placeholder confidence score
      trend_direction: trendDirection
    };
  }

  /**
   * Perform topic clustering and trend analysis
   */
  async analyzeTopicClusters(businessId: string, dateRange: { start: Date; end: Date }): Promise<TopicCluster[]> {
    // Get topic data
    const topicData = await this.prisma.conversationTopics.findMany({
      where: {
        business_id: businessId,
        date: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }
    }) as any[];

    // Group by topic category
    const topicGroups = topicData.reduce((groups, topic) => {
      const category = topic.topic_category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(topic);
      return groups;
    }, {} as Record<string, any[]>);

    // Create topic clusters
    const clusters: TopicCluster[] = Object.entries(topicGroups).map(([category, topics]) => {
      const totalFrequency = topics.reduce((sum, t) => sum + t.frequency, 0);
      const avgSatisfaction = topics.reduce((sum, t) => sum + t.avg_satisfaction, 0) / topics.length;
      const avgResolutionRate = topics.reduce((sum, t) => sum + t.resolution_success_rate, 0) / topics.length;

      // Determine trending direction (simplified)
      const trendingDirection: 'up' | 'down' | 'stable' = 'stable'; // Would need historical comparison

      return {
        cluster_id: `cluster_${category.toLowerCase().replace(/\s+/g, '_')}`,
        topic_name: category,
        frequency: totalFrequency,
        avg_satisfaction: avgSatisfaction,
        resolution_rate: avgResolutionRate,
        trending_direction: trendingDirection,
        related_topics: topics.map(t => t.intent_type)
      };
    });

    return clusters.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Analyze customer segments and behavior patterns
   */
  async analyzeCustomerSegments(businessId: string, dateRange: { start: Date; end: Date }): Promise<CustomerSegment[]> {
    // Get customer pattern data
    const customerPatterns = await this.prisma.customerPatterns.findMany({
      where: {
        business_id: businessId,
        first_interaction: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }
    }) as any[];

    if (customerPatterns.length === 0) {
      return [];
    }

    // Segment customers based on conversation frequency and satisfaction
    const segments: CustomerSegment[] = [];

    // High-value customers (frequent, satisfied)
    const highValueCustomers = customerPatterns.filter(cp => 
      cp.total_conversations >= 5 && cp.satisfaction_trend >= 0.7
    );
    if (highValueCustomers.length > 0) {
      segments.push({
        segment_id: 'high_value',
        segment_name: 'High-Value Customers',
        customer_count: highValueCustomers.length,
        avg_satisfaction: highValueCustomers.reduce((sum, c) => sum + c.satisfaction_trend, 0) / highValueCustomers.length,
        avg_conversation_length: highValueCustomers.reduce((sum, c) => sum + c.avg_session_length, 0) / highValueCustomers.length,
        preferred_topics: this.getMostCommonTopics(highValueCustomers),
        churn_risk: 'low'
      });
    }

    // At-risk customers (low satisfaction, declining trend)
    const atRiskCustomers = customerPatterns.filter(cp => 
      cp.satisfaction_trend < 0.4 || (cp.total_conversations > 3 && cp.satisfaction_trend < 0.5)
    );
    if (atRiskCustomers.length > 0) {
      segments.push({
        segment_id: 'at_risk',
        segment_name: 'At-Risk Customers',
        customer_count: atRiskCustomers.length,
        avg_satisfaction: atRiskCustomers.reduce((sum, c) => sum + c.satisfaction_trend, 0) / atRiskCustomers.length,
        avg_conversation_length: atRiskCustomers.reduce((sum, c) => sum + c.avg_session_length, 0) / atRiskCustomers.length,
        preferred_topics: this.getMostCommonTopics(atRiskCustomers),
        churn_risk: 'high'
      });
    }

    // New customers
    const newCustomers = customerPatterns.filter(cp => 
      cp.total_conversations <= 2
    );
    if (newCustomers.length > 0) {
      segments.push({
        segment_id: 'new_customers',
        segment_name: 'New Customers',
        customer_count: newCustomers.length,
        avg_satisfaction: newCustomers.reduce((sum, c) => sum + c.satisfaction_trend, 0) / newCustomers.length,
        avg_conversation_length: newCustomers.reduce((sum, c) => sum + c.avg_session_length, 0) / newCustomers.length,
        preferred_topics: this.getMostCommonTopics(newCustomers),
        churn_risk: 'medium'
      });
    }

    return segments;
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizationRecommendations(businessId: string): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Get recent performance data
    const recentMetrics = await this.prisma.dailyConversationMetrics.findMany({
      where: { business_id: businessId },
      orderBy: { date: 'desc' },
      take: 7
    }) as any[];

    const hourlyMetrics = await this.prisma.hourlyPerformanceMetrics.findMany({
      where: { business_id: businessId },
      orderBy: { hour_timestamp: 'desc' },
      take: 24
    }) as any[];

    if (recentMetrics.length > 0) {
      const latest = recentMetrics[0];

      // Cost optimization recommendations
      if (hourlyMetrics.length > 0) {
        const avgCost = hourlyMetrics.reduce((sum, h) => sum + h.estimated_cost, 0) / hourlyMetrics.length;
        const avgCacheHitRate = hourlyMetrics.reduce((sum, h) => sum + h.cache_hit_rate, 0) / hourlyMetrics.length;

        if (avgCacheHitRate < 0.7) {
          recommendations.push({
            type: 'cost_reduction',
            title: 'Improve Cache Hit Rate',
            description: `Current cache hit rate is ${(avgCacheHitRate * 100).toFixed(1)}%. Improving to 80%+ could reduce costs by 15-20%.`,
            potential_impact: 7,
            implementation_effort: 'medium',
            estimated_savings: avgCost * 0.15,
            confidence_score: 0.8
          });
        }
      }

      // Satisfaction improvement recommendations
      if (latest.satisfaction_score < 4.0) {
        recommendations.push({
          type: 'satisfaction_improvement',
          title: 'Improve Response Quality',
          description: `Current satisfaction score is ${latest.satisfaction_score.toFixed(2)}. Focus on response accuracy and helpfulness.`,
          potential_impact: 8,
          implementation_effort: 'high',
          confidence_score: 0.9
        });
      }

      // Efficiency recommendations
      if (latest.resolution_rate < 0.8) {
        recommendations.push({
          type: 'efficiency_gain',
          title: 'Improve Resolution Rate',
          description: `Current resolution rate is ${(latest.resolution_rate * 100).toFixed(1)}%. Better conversation flow could improve this.`,
          potential_impact: 6,
          implementation_effort: 'medium',
          confidence_score: 0.7
        });
      }
    }

    return recommendations.sort((a, b) => b.potential_impact - a.potential_impact);
  }

  /**
   * Analyze conversation flow and drop-off points
   */
  async analyzeConversationFlow(businessId: string, dateRange: { start: Date; end: Date }): Promise<ConversationFlow[]> {
    // This would typically analyze conversation transcripts
    // For now, we'll return a simplified analysis based on metrics
    
    const dailyMetrics = await this.prisma.dailyConversationMetrics.findMany({
      where: {
        business_id: businessId,
        date: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }
    }) as any[];

    const flows: ConversationFlow[] = [
      {
        step: 1,
        action: 'Initial Query',
        frequency: dailyMetrics.reduce((sum, m) => sum + m.total_conversations, 0),
        success_rate: 1.0,
        avg_time_spent: 30
      },
      {
        step: 2,
        action: 'AI Response',
        frequency: dailyMetrics.reduce((sum, m) => sum + m.total_conversations, 0),
        success_rate: 0.95,
        avg_time_spent: 45
      },
      {
        step: 3,
        action: 'Follow-up Question',
        frequency: Math.floor(dailyMetrics.reduce((sum, m) => sum + m.total_conversations, 0) * 0.6),
        success_rate: 0.85,
        avg_time_spent: 60
      },
      {
        step: 4,
        action: 'Resolution',
        frequency: Math.floor(dailyMetrics.reduce((sum, m) => sum + m.total_conversations, 0) * 0.8),
        success_rate: 0.9,
        avg_time_spent: 90
      }
    ];

    return flows;
  }

  /**
   * Generate comprehensive business intelligence insights
   */
  async generateComprehensiveInsights(businessId: string, dateRange: { start: Date; end: Date }): Promise<BusinessIntelligenceInsight[]> {
    const insights: BusinessIntelligenceInsight[] = [];

    // Get sentiment analysis
    const sentiment = await this.analyzeConversationSentiment(businessId, dateRange);
    if (sentiment.overall_sentiment === 'negative' || sentiment.trend_direction === 'declining') {
      insights.push({
        insight_type: 'warning',
        title: 'Customer Sentiment Concerns',
        description: `Overall sentiment is ${sentiment.overall_sentiment} with a ${sentiment.trend_direction} trend`,
        impact_score: 8,
        confidence_level: sentiment.confidence,
        recommended_action: 'Review recent conversations and improve response quality',
        data_points: [sentiment.sentiment_score, sentiment.trend_direction],
        created_at: new Date()
      });
    }

    // Get topic clusters
    const topicClusters = await this.analyzeTopicClusters(businessId, dateRange);
    const topTopic = topicClusters[0];
    if (topTopic && topTopic.avg_satisfaction < 3.5) {
      insights.push({
        insight_type: 'opportunity',
        title: 'Improve Top Topic Performance',
        description: `Top topic "${topTopic.topic_name}" has low satisfaction (${topTopic.avg_satisfaction.toFixed(2)})`,
        impact_score: 6,
        confidence_level: 0.8,
        recommended_action: 'Optimize responses for this topic category',
        data_points: [topTopic.topic_name, topTopic.avg_satisfaction],
        created_at: new Date()
      });
    }

    // Get customer segments
    const segments = await this.analyzeCustomerSegments(businessId, dateRange);
    const atRiskSegment = segments.find(s => s.churn_risk === 'high');
    if (atRiskSegment && atRiskSegment.customer_count > 0) {
      insights.push({
        insight_type: 'warning',
        title: 'High Churn Risk Segment',
        description: `${atRiskSegment.customer_count} customers in high churn risk segment`,
        impact_score: 9,
        confidence_level: 0.7,
        recommended_action: 'Implement retention strategies for at-risk customers',
        data_points: [atRiskSegment.customer_count, atRiskSegment.avg_satisfaction],
        created_at: new Date()
      });
    }

    // Get optimization recommendations
    const recommendations = await this.generateOptimizationRecommendations(businessId);
    if (recommendations.length > 0) {
      const topRecommendation = recommendations[0];
      insights.push({
        insight_type: 'opportunity',
        title: 'Optimization Opportunity',
        description: topRecommendation.description,
        impact_score: topRecommendation.potential_impact,
        confidence_level: topRecommendation.confidence_score,
        recommended_action: topRecommendation.title,
        data_points: [topRecommendation.type, topRecommendation.potential_impact],
        created_at: new Date()
      });
    }

    return insights.sort((a, b) => b.impact_score - a.impact_score);
  }

  /**
   * Helper method to get most common topics from customer patterns
   */
  private getMostCommonTopics(customers: any[]): string[] {
    const topicCounts: Record<string, number> = {};
    
    customers.forEach(customer => {
      customer.preferred_topics?.forEach((topic: string) => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });

    return Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);
  }
}

let businessIntelligenceEngineInstance: BusinessIntelligenceEngine | null = null;

export function getBusinessIntelligenceEngine(prisma: PrismaClient): BusinessIntelligenceEngine {
  if (!businessIntelligenceEngineInstance) {
    businessIntelligenceEngineInstance = new BusinessIntelligenceEngine(prisma);
  }
  return businessIntelligenceEngineInstance;
}
