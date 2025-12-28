/**
 * Fast-Path Question Analyzer
 * Quickly determines if a question is simple enough for fast-path processing
 * without full intent analysis overhead
 */

export interface FastPathResult {
  isSimple: boolean;
  requiresFullReasoning: boolean;
  estimatedComplexity: 'simple' | 'medium' | 'complex';
}

/**
 * Quick heuristic-based analysis to determine if question needs full reasoning
 * Returns immediately without LLM call for simple questions
 */
export function analyzeFastPath(question: string): FastPathResult {
  const lowerQuestion = question.toLowerCase().trim();
  const questionLength = question.length;
  const wordCount = question.split(/\s+/).length;

  // Very simple questions (greetings, yes/no, single word)
  if (
    wordCount <= 3 ||
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure)$/i.test(lowerQuestion)
  ) {
    return {
      isSimple: true,
      requiresFullReasoning: false,
      estimatedComplexity: 'simple'
    };
  }

  // Complex indicators - requires full reasoning
  const complexIndicators = [
    /\b(compare|comparison|difference|similar|versus|vs|versus)\b/i,
    /\b(explain|why|how|what if|analyze|evaluate)\b/i,
    /\b(summarize|summary|overview|overall)\b/i,
    /\b(and|also|plus|additionally)\b/i, // Multi-part
    /\?.*\?/, // Multiple question marks
    /\b(step|steps|procedure|process|workflow)\b/i,
    /\b(pros|cons|advantages|disadvantages|benefits|drawbacks)\b/i
  ];

  const hasComplexIndicator = complexIndicators.some(pattern => pattern.test(question));

  if (hasComplexIndicator || wordCount > 20) {
    return {
      isSimple: false,
      requiresFullReasoning: true,
      estimatedComplexity: 'complex'
    };
  }

  // Ambiguous questions (pronouns, vague references)
  const ambiguousIndicors = [
    /\b(it|this|that|they|them|those|these|what|which|who)\b/i,
    /^(so|well|um|hmm|actually)\b/i,
    /\?$.*(mean|refer|about)/i
  ];

  const isAmbiguous = ambiguousIndicors.some(pattern => pattern.test(question));

  if (isAmbiguous) {
    return {
      isSimple: false,
      requiresFullReasoning: true,
      estimatedComplexity: 'medium'
    };
  }

  // Medium complexity - direct questions but may need some reasoning
  if (wordCount > 8 || questionLength > 60) {
    return {
      isSimple: false,
      requiresFullReasoning: false, // Can use simplified reasoning
      estimatedComplexity: 'medium'
    };
  }

  // Simple direct questions
  return {
    isSimple: true,
    requiresFullReasoning: false,
    estimatedComplexity: 'simple'
  };
}

/**
 * Determines if question needs multi-query retrieval
 * Simple questions can use single query
 */
export function needsMultiQuery(question: string, fastPath: FastPathResult): boolean {
  if (fastPath.isSimple) {
    return false; // Single query sufficient
  }
  
  // Multi-query needed for complex questions
  return fastPath.requiresFullReasoning || fastPath.estimatedComplexity === 'complex';
}

/**
 * Determines optimal chunk count based on question complexity
 */
export function getOptimalChunkCount(fastPath: FastPathResult): number {
  switch (fastPath.estimatedComplexity) {
    case 'simple':
      return 3; // Top 3 chunks sufficient
    case 'medium':
      return 5; // Top 5 chunks
    case 'complex':
      return 8; // Full retrieval
    default:
      return 5;
  }
}



