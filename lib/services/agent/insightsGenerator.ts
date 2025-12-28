/**
 * Admin Insights Generator
 * Generates actionable insights from conversation analytics
 * Pure analytics - no impact on chatbot responses
 */

import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

export interface AdminInsights {
  frequentlyAskedTopics: Array<{
    question: string;
    count: number;
    normalizedQuestion: string;
  }>;
  knowledgeGaps: Array<{
    topic: string;
    questionCount: number;
    sampleQuestions: string[];
  }>;
  lowConfidenceAreas: Array<{
    topic: string;
    questionCount: number;
    averageConfidence: string;
    sampleQuestions: string[];
  }>;
  repeatedComplaints: Array<{
    topic: string;
    complaintCount: number;
    sampleQuestions: string[];
    escalationRisk: 'high' | 'medium' | 'low';
  }>;
  summary: {
    totalQuestions: number;
    averageConfidence: string;
    coverageRate: number;
    timeRange: string;
  };
}

/**
 * Generate admin insights from analytics data
 */
export async function generateAdminInsights(
  tenantId: string,
  timeRangeDays: number = 30
): Promise<AdminInsights> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRangeDays);

  // Get all analytics for the tenant in the time range
  let analytics;
  try {
    analytics = await prisma.questionAnalytics.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  } catch (error: any) {
    // If table doesn't exist yet, return empty insights
    if (error?.code === 'P2021' || error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return {
        frequentlyAskedTopics: [],
        knowledgeGaps: [],
        lowConfidenceAreas: [],
        repeatedComplaints: [],
        summary: {
          totalQuestions: 0,
          averageConfidence: 'N/A',
          coverageRate: 0,
          timeRange: `${timeRangeDays} days`
        }
      };
    }
    throw error;
  }

  const totalQuestions = analytics.length;

  // Calculate summary metrics
  const confidenceCounts = {
    High: analytics.filter(a => a.confidenceLevel === 'High').length,
    Medium: analytics.filter(a => a.confidenceLevel === 'Medium').length,
    Low: analytics.filter(a => a.confidenceLevel === 'Low').length
  };

  const averageConfidence = totalQuestions > 0
    ? confidenceCounts.High >= confidenceCounts.Medium && confidenceCounts.High >= confidenceCounts.Low
      ? 'High'
      : confidenceCounts.Medium >= confidenceCounts.Low
        ? 'Medium'
        : 'Low'
    : 'N/A';

  const coverageCounts = {
    covered: analytics.filter(a => a.coverageStatus === 'covered').length,
    partially_covered: analytics.filter(a => a.coverageStatus === 'partially_covered').length,
    not_covered: analytics.filter(a => a.coverageStatus === 'not_covered').length
  };

  const coverageRate = totalQuestions > 0
    ? Math.round((coverageCounts.covered / totalQuestions) * 100)
    : 0;

  // 1. Frequently Asked Topics (Top 10)
  const questionGroups = new Map<string, { count: number; sampleQuestion: string }>();
  
  for (const item of analytics) {
    const normalized = item.normalizedQuestion || item.questionText.toLowerCase().trim();
    if (normalized.length < 3) continue; // Skip very short questions
    
    if (questionGroups.has(normalized)) {
      questionGroups.get(normalized)!.count++;
    } else {
      questionGroups.set(normalized, {
        count: 1,
        sampleQuestion: item.questionText
      });
    }
  }

  const frequentlyAskedTopics = Array.from(questionGroups.entries())
    .map(([normalized, data]) => ({
      question: data.sampleQuestion,
      count: data.count,
      normalizedQuestion: normalized
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 2. Knowledge Gaps (Not covered questions)
  const notCoveredQuestions = analytics.filter(a => a.coverageStatus === 'not_covered');
  const gapGroups = new Map<string, { count: number; questions: string[] }>();
  
  for (const item of notCoveredQuestions) {
    const normalized = item.normalizedQuestion || item.questionText.toLowerCase().trim();
    if (normalized.length < 3) continue;
    
    if (gapGroups.has(normalized)) {
      gapGroups.get(normalized)!.count++;
      if (!gapGroups.get(normalized)!.questions.includes(item.questionText)) {
        gapGroups.get(normalized)!.questions.push(item.questionText);
      }
    } else {
      gapGroups.set(normalized, {
        count: 1,
        questions: [item.questionText]
      });
    }
  }

  const knowledgeGaps = Array.from(gapGroups.entries())
    .map(([normalized, data]) => ({
      topic: data.questions[0], // Use first question as topic representation
      questionCount: data.count,
      sampleQuestions: data.questions.slice(0, 3) // Show up to 3 sample questions
    }))
    .sort((a, b) => b.questionCount - a.questionCount)
    .slice(0, 10);

  // 3. Low Confidence Areas
  const lowConfidenceQuestions = analytics.filter(a => a.confidenceLevel === 'Low');
  const lowConfGroups = new Map<string, { count: number; questions: string[] }>();
  
  for (const item of lowConfidenceQuestions) {
    const normalized = item.normalizedQuestion || item.questionText.toLowerCase().trim();
    if (normalized.length < 3) continue;
    
    if (lowConfGroups.has(normalized)) {
      lowConfGroups.get(normalized)!.count++;
      if (!lowConfGroups.get(normalized)!.questions.includes(item.questionText)) {
        lowConfGroups.get(normalized)!.questions.push(item.questionText);
      }
    } else {
      lowConfGroups.set(normalized, {
        count: 1,
        questions: [item.questionText]
      });
    }
  }

  const lowConfidenceAreas = Array.from(lowConfGroups.entries())
    .map(([normalized, data]) => ({
      topic: data.questions[0],
      questionCount: data.count,
      averageConfidence: 'Low',
      sampleQuestions: data.questions.slice(0, 3)
    }))
    .sort((a, b) => b.questionCount - a.questionCount)
    .slice(0, 10);

  // 4. Repeated Complaints
  const complaintQuestions = analytics.filter(a => 
    a.supportIntent === 'complaint' || 
    a.supportIntent === 'escalation_risk' ||
    a.sentiment === 'frustrated' ||
    a.sentiment === 'urgent'
  );

  const complaintGroups = new Map<string, { count: number; questions: string[]; maxSentiment: string }>();
  
  for (const item of complaintQuestions) {
    const normalized = item.normalizedQuestion || item.questionText.toLowerCase().trim();
    if (normalized.length < 3) continue;
    
    if (complaintGroups.has(normalized)) {
      complaintGroups.get(normalized)!.count++;
      if (!complaintGroups.get(normalized)!.questions.includes(item.questionText)) {
        complaintGroups.get(normalized)!.questions.push(item.questionText);
      }
      // Track highest escalation level
      if (item.sentiment === 'urgent' || item.supportIntent === 'escalation_risk') {
        complaintGroups.get(normalized)!.maxSentiment = 'urgent';
      } else if (item.sentiment === 'frustrated' && complaintGroups.get(normalized)!.maxSentiment !== 'urgent') {
        complaintGroups.get(normalized)!.maxSentiment = 'frustrated';
      }
    } else {
      complaintGroups.set(normalized, {
        count: 1,
        questions: [item.questionText],
        maxSentiment: item.sentiment || 'frustrated'
      });
    }
  }

  const repeatedComplaints = Array.from(complaintGroups.entries())
    .map(([normalized, data]) => ({
      topic: data.questions[0],
      complaintCount: data.count,
      sampleQuestions: data.questions.slice(0, 3),
      escalationRisk: data.maxSentiment === 'urgent' || data.count >= 5
        ? 'high' as const
        : data.count >= 3
          ? 'medium' as const
          : 'low' as const
    }))
    .sort((a, b) => b.complaintCount - a.complaintCount)
    .slice(0, 10);

  return {
    frequentlyAskedTopics,
    knowledgeGaps,
    lowConfidenceAreas,
    repeatedComplaints,
    summary: {
      totalQuestions,
      averageConfidence,
      coverageRate,
      timeRange: `${timeRangeDays} days`
    }
  };
}

