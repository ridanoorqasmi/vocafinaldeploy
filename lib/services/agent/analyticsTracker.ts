/**
 * Analytics Tracker for Chat Support Agent
 * Tracks conversation analytics for admin insights
 * Pure observation - does not affect chatbot responses
 */

import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

export interface QuestionAnalyticsData {
  conversationId: string;
  tenantId: string;
  questionText: string;
  normalizedQuestion: string;
  detectedIntent?: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  coverageStatus: 'covered' | 'partially_covered' | 'not_covered';
  supportIntent?: string;
  sentiment?: string;
  timestamp: Date;
}

/**
 * Track a question and its analytics data
 * Called after each user message is processed
 */
export async function trackQuestionAnalytics(data: QuestionAnalyticsData): Promise<void> {
  try {
    await prisma.questionAnalytics.create({
      data: {
        conversationId: data.conversationId,
        tenantId: data.tenantId,
        questionText: data.questionText,
        normalizedQuestion: data.normalizedQuestion,
        detectedIntent: data.detectedIntent,
        confidenceLevel: data.confidenceLevel,
        coverageStatus: data.coverageStatus,
        supportIntent: data.supportIntent,
        sentiment: data.sentiment,
        createdAt: data.timestamp
      }
    });
  } catch (error: any) {
    // Silently fail - analytics should not break the chat flow
    // Skip logging for "table doesn't exist" errors (migration not run yet)
    if (error?.code === 'P2021' || error?.code === '42P01' || error?.message?.includes('does not exist')) {
      // Table doesn't exist yet - this is expected if migration hasn't been run
      return;
    }
    // Only log other errors
    console.error('Error tracking question analytics:', error);
  }
}

/**
 * Normalize question text for grouping similar questions
 */
export function normalizeQuestion(question: string): string {
  // Convert to lowercase
  let normalized = question.toLowerCase().trim();
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Remove common question words for better grouping
  normalized = normalized.replace(/^(what|when|where|who|why|how|which|can|could|should|would|is|are|do|does|did|will|has|have|tell me|explain|show me|help me)\s+/i, '');
  
  // Remove punctuation
  normalized = normalized.replace(/[.,!?;:]/g, '');
  
  // Remove articles
  normalized = normalized.replace(/\b(the|a|an)\s+/gi, '');
  
  return normalized.trim();
}

