/**
 * Phase 3: Analytics Intent Classifier
 * Data Analyst Agent (Poppy) - Rule-Based Intent Classification
 * 
 * Classifies user questions into deterministic analytical intents
 * NO AI - Pure rule-based pattern matching
 */

export type AnalyticsIntent =
  | 'aggregate_sum'
  | 'aggregate_avg'
  | 'aggregate_min'
  | 'aggregate_max'
  | 'aggregate_count'
  | 'group_by'
  | 'time_series'
  | 'unsupported_query';

export interface IntentClassification {
  intent: AnalyticsIntent;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Rule-based intent classifier
 * Maps user questions to analytical intents using keyword patterns
 */
export function classifyIntent(userQuestion: string): IntentClassification {
  const normalized = userQuestion.toLowerCase().trim();

  // Aggregate SUM patterns
  const sumPatterns = [
    /\b(total|sum|add up|sum of|summarize|summation)\b/i,
    /\b(how much|what is the total|what's the total)\b/i,
    /\b(revenue|sales|income|profit|amount|value)\s+(total|sum)\b/i,
    /\b(total)\s+(revenue|sales|income|profit|amount|value)\b/i,
  ];

  // Aggregate AVG patterns
  const avgPatterns = [
    /\b(average|avg|mean|mean value|average value)\b/i,
    /\b(what is the average|what's the average)\b/i,
    /\b(average|mean)\s+(of|for)\b/i,
    /\b(per|each)\s+(average|mean)\b/i,
  ];

  // Aggregate MIN patterns
  const minPatterns = [
    /\b(minimum|min|lowest|smallest|earliest|first|oldest)\b/i,
    /\b(what is the (minimum|min|lowest|smallest|earliest))\b/i,
    /\b(what's the (minimum|min|lowest|smallest|earliest))\b/i,
    /\b(find the (minimum|min|lowest|smallest|earliest))\b/i,
  ];

  // Aggregate MAX patterns
  const maxPatterns = [
    /\b(maximum|max|highest|largest|latest|newest|most recent|last)\b/i,
    /\b(what is the (maximum|max|highest|largest|latest|newest))\b/i,
    /\b(what's the (maximum|max|highest|largest|latest|newest))\b/i,
    /\b(find the (maximum|max|highest|largest|latest|newest))\b/i,
  ];

  // Aggregate COUNT patterns
  const countPatterns = [
    /\b(count|number|how many|quantity|total number)\b/i,
    /\b(how many|how much|number of)\b/i,
    /\b(count of|total count|total number of)\b/i,
  ];

  // GROUP BY patterns - improved to be more flexible
  const groupByPatterns = [
    // "X by Y" pattern (most common)
    /\b(show|display|list|get|find|what|total|sum|average|avg|count|revenue|sales)\s+.*?\s+(by|grouped by|group by|per|for each|for every)\s+[a-z_]+/i,
    // "by Y" pattern (standalone)
    /\b(by|grouped by|group by|per|for each|for every)\s+[a-z_]+\b/i,
    // "breakdown by" pattern
    /\b(breakdown|distribution|split|group|organize)\s+(by|per)\s+[a-z_]+\b/i,
    // "X per Y" pattern
    /\b([a-z_]+)\s+(by|per|for each|for every)\s+[a-z_]+\b/i,
  ];

  // TIME SERIES patterns
  const timeSeriesPatterns = [
    /\b(over time|over the|throughout|across time|time series|trend)\b/i,
    /\b(by|per|for each)\s+(day|month|year|week|date|time)\b/i,
    /\b(daily|monthly|yearly|weekly|hourly)\b/i,
    /\b(evolution|change|growth|decline)\s+(over|across)\s+(time|period)\b/i,
    /\b(revenue|sales|count)\s+(over|across|throughout)\s+(time|period|days|months|years)\b/i,
  ];

  // Check patterns in order of specificity (most specific first)
  
  // Time series (most specific - includes time dimension)
  for (const pattern of timeSeriesPatterns) {
    if (pattern.test(normalized)) {
      return { intent: 'time_series', confidence: 'high' };
    }
  }

  // Group by (specific - includes dimension)
  for (const pattern of groupByPatterns) {
    if (pattern.test(normalized)) {
      return { intent: 'group_by', confidence: 'high' };
    }
  }

  // Aggregate patterns (check in order: min, max, sum, avg, count)
  for (const pattern of minPatterns) {
    if (pattern.test(normalized)) {
      return { intent: 'aggregate_min', confidence: 'high' };
    }
  }

  for (const pattern of maxPatterns) {
    if (pattern.test(normalized)) {
      return { intent: 'aggregate_max', confidence: 'high' };
    }
  }

  for (const pattern of sumPatterns) {
    if (pattern.test(normalized)) {
      return { intent: 'aggregate_sum', confidence: 'high' };
    }
  }

  for (const pattern of avgPatterns) {
    if (pattern.test(normalized)) {
      return { intent: 'aggregate_avg', confidence: 'high' };
    }
  }

  for (const pattern of countPatterns) {
    if (pattern.test(normalized)) {
      return { intent: 'aggregate_count', confidence: 'high' };
    }
  }

  // If no pattern matches, return unsupported
  return { intent: 'unsupported_query', confidence: 'low' };
}






