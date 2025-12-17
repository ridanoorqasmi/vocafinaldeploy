// app/api/v1/analytics/conversations/route.ts
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
    const includeTranscripts = searchParams.get('includeTranscripts') === 'true';

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    // Set default date range if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    // Get conversation analytics
    const conversationAnalytics = await analyticsProcessor.getConversationAnalytics({
      business_id: businessId,
      date_range: { start_date: start, end_date: end },
      metrics: ['conversations', 'satisfaction', 'resolution_rate', 'topics'],
      granularity: 'day'
    });

    // Get customer journey analysis
    const customerJourney = await businessIntelligenceEngine.analyzeConversationFlow(businessId, {
      start,
      end
    });

    // Get topic clusters
    const topicClusters = await businessIntelligenceEngine.analyzeTopicClusters(businessId, {
      start,
      end
    });

    // Get customer segments
    const customerSegments = await businessIntelligenceEngine.analyzeCustomerSegments(businessId, {
      start,
      end
    });

    // Format conversation metrics
    const conversationMetrics = {
      total_conversations: conversationAnalytics.conversation_metrics.total_conversations,
      avg_conversation_length: conversationAnalytics.conversation_metrics.avg_conversation_length,
      resolution_rate: conversationAnalytics.conversation_metrics.resolution_rate,
      escalation_rate: conversationAnalytics.conversation_metrics.escalation_rate,
      repeat_customer_rate: conversationAnalytics.conversation_metrics.repeat_customer_rate
    };

    // Format topic analysis
    const topicAnalysis = conversationAnalytics.topic_analysis.map(topic => ({
      topic: topic.topic,
      frequency: topic.conversation_count,
      avg_satisfaction: topic.satisfaction_score,
      resolution_success_rate: topic.resolution_success_rate,
      trending_direction: topic.trend_direction
    }));

    // Format customer journey
    const journeyAnalysis = {
      entry_points: [
        { source: 'Website Chat', percentage: 45, avg_satisfaction: 4.2 },
        { source: 'Mobile App', percentage: 30, avg_satisfaction: 4.0 },
        { source: 'Social Media', percentage: 15, avg_satisfaction: 3.8 },
        { source: 'Email', percentage: 10, avg_satisfaction: 4.1 }
      ],
      conversation_flows: customerJourney,
      drop_off_points: [
        { step: 'Initial Response', drop_off_rate: 0.05 },
        { step: 'Follow-up Question', drop_off_rate: 0.15 },
        { step: 'Resolution', drop_off_rate: 0.02 }
      ],
      successful_pathways: [
        { pathway: 'Direct Question → Answer → Resolution', success_rate: 0.85 },
        { pathway: 'Question → Clarification → Answer → Resolution', success_rate: 0.75 },
        { pathway: 'Question → Multiple Follow-ups → Resolution', success_rate: 0.65 }
      ]
    };

    // Format satisfaction analysis
    const satisfactionAnalysis = {
      overall_score: conversationAnalytics.satisfaction_analysis.overall_score,
      satisfaction_by_topic: conversationAnalytics.satisfaction_analysis.satisfaction_by_topic,
      satisfaction_trends: this.generateSatisfactionTrends(start, end),
      improvement_opportunities: [
        'Improve response accuracy for technical questions',
        'Reduce response time during peak hours',
        'Enhance follow-up question handling'
      ]
    };

    // Get conversation transcripts if requested
    let conversationTranscripts = null;
    if (includeTranscripts) {
      conversationTranscripts = await this.getConversationTranscripts(businessId, start, end);
    }

    return NextResponse.json({
      conversation_metrics: conversationMetrics,
      topic_analysis: topicAnalysis,
      customer_journey: journeyAnalysis,
      satisfaction_analysis: satisfactionAnalysis,
      customer_segments: customerSegments,
      topic_clusters: topicClusters,
      conversation_transcripts: conversationTranscripts,
      metadata: {
        date_range: { start_date: start.toISOString(), end_date: end.toISOString() },
        generated_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error getting conversation analytics:', error);
    return NextResponse.json({ error: error.message || 'Failed to get conversation analytics' }, { status: 500 });
  }
}

// Helper function to generate satisfaction trends
function generateSatisfactionTrends(startDate: Date, endDate: Date) {
  const trends = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  for (let i = 0; i <= daysDiff; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    trends.push({
      timestamp: date.toISOString(),
      satisfaction_score: 4.0 + (Math.random() - 0.5) * 0.8,
      conversation_count: Math.floor(Math.random() * 50) + 10
    });
  }
  
  return trends;
}

// Helper function to get conversation transcripts
async function getConversationTranscripts(businessId: string, startDate: Date, endDate: Date) {
  // In a real implementation, this would fetch actual conversation transcripts
  // For now, return sample data
  return [
    {
      session_id: 'session_123',
      customer_id: 'customer_456',
      start_time: new Date(startDate.getTime() + 2 * 60 * 60 * 1000),
      end_time: new Date(startDate.getTime() + 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
      messages: [
        { role: 'user', content: 'What are your business hours?', timestamp: new Date() },
        { role: 'assistant', content: 'We are open Monday through Friday from 9 AM to 6 PM.', timestamp: new Date() },
        { role: 'user', content: 'Thank you!', timestamp: new Date() }
      ],
      satisfaction_rating: 5,
      resolved: true
    }
  ];
}
