/**
 * Difference Explainer Service
 * Data Analyst Agent (Poppy) - Scoped Explanation Layer
 * 
 * Generates plain-language explanations for metric differences using only provided numbers.
 * No analysis, no speculation, no causes - just factual restatement.
 */

export interface DifferenceExplanationRequest {
  metricName: string;
  groupALabel: string;
  groupBLabel: string;
  groupAAverage: number;
  groupBAverage: number;
  absoluteDifference: number;
  relativeDifference: number; // percentage
}

export interface DifferenceExplanation {
  explanation: string;
}

/**
 * Generate plain-language explanation for a metric difference
 * Uses only the provided numbers - no analysis, no speculation
 */
export function explainDifference(
  request: DifferenceExplanationRequest
): DifferenceExplanation {
  const {
    metricName,
    groupALabel,
    groupBLabel,
    groupAAverage,
    groupBAverage,
    absoluteDifference,
    relativeDifference,
  } = request;

  // Determine which group has higher value
  const groupAIsHigher = groupAAverage > groupBAverage;
  const higherGroup = groupAIsHigher ? groupALabel : groupBLabel;
  const lowerGroup = groupAIsHigher ? groupBLabel : groupALabel;
  const higherValue = groupAIsHigher ? groupAAverage : groupBAverage;
  const lowerValue = groupAIsHigher ? groupBAverage : groupAAverage;

  // Format numbers for readability
  const formatNumber = (num: number): string => {
    if (Math.abs(num) >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  // Build explanation sentences
  const sentences: string[] = [];

  // Sentence 1: Which group has higher value
  sentences.push(
    `For the ${metricName} metric, ${higherGroup} has a higher average value than ${lowerGroup}.`
  );

  // Sentence 2: Specific values
  sentences.push(
    `The average for ${higherGroup} is ${formatNumber(higherValue)}, compared to ${formatNumber(lowerValue)} for ${lowerGroup}.`
  );

  // Sentence 3: Absolute difference
  sentences.push(
    `This represents an absolute difference of ${formatNumber(absoluteDifference)}.`
  );

  // Sentence 4: Relative difference (if meaningful)
  if (relativeDifference > 0.1) {
    const direction = groupAIsHigher ? 'higher' : 'lower';
    sentences.push(
      `This is ${relativeDifference.toFixed(1)}% ${direction} relative to ${lowerGroup}.`
    );
  }

  return {
    explanation: sentences.join(' '),
  };
}



