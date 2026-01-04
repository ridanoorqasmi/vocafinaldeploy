/**
 * Phase 4.5: Intelligent LLM Explanation Service
 * Data Analyst Agent (Poppy) - Intelligent Explanation Layer
 * 
 * Generates intelligent, context-aware explanations of deterministic analysis results.
 * LLM is used ONLY for explanation and reasoning, NOT for computation.
 */

import { getOpenAIClient } from '@/lib/openai-client';
import type { GeneratedArtifact } from '@/lib/poppy/types';
import type { DatasetProfile } from '../data-profiler';

const openai = getOpenAIClient();

/**
 * Explanation intelligence modes
 */
export type ExplanationMode = 'descriptive' | 'interpretive' | 'comparative' | 'cautionary';

export interface ExplanationResult {
  summary: string;
  implications?: string[];
  caveats?: string[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * System prompt - immutable, enforces intelligent but bounded behavior
 */
const SYSTEM_PROMPT = `You are a senior data analyst.
You explain results using analyst reasoning, not computation.
You must not change or infer new values.
You may highlight implications, caveats, and context.
If insight cannot be justified from artifacts, say so clearly.
Be concise, precise, and grounded.`;

/**
 * Select explanation mode based on context (rule-based, deterministic)
 */
export function selectExplanationMode(
  artifact: GeneratedArtifact,
  priorArtifacts: GeneratedArtifact[],
  isFirstQuestion: boolean
): ExplanationMode {
  // Check if this is a follow-up on the same metric
  const currentMetric = artifact.metadata?.metric;
  const hasPriorSameMetric = priorArtifacts.some(
    a => a.metadata?.metric === currentMetric
  );

  // Rule 1: Follow-up on same metric → comparative
  if (hasPriorSameMetric) {
    return 'comparative';
  }

  // Rule 2: First question about a metric → interpretive (default)
  if (isFirstQuestion) {
    return 'interpretive';
  }

  // Rule 3: Single scalar metric → include cautionary elements
  const resultType = artifact.data?.resultType;
  if (resultType === 'scalar') {
    return 'cautionary';
  }

  // Rule 4: Unsupported context → fallback to descriptive
  return 'descriptive';
}

/**
 * Generate intelligent explanation for an artifact with context
 */
export async function generateExplanation(
  userQuestion: string,
  artifact: GeneratedArtifact,
  datasetProfile: DatasetProfile,
  mode: ExplanationMode,
  priorArtifacts: GeneratedArtifact[] = []
): Promise<ExplanationResult> {
  // Validate artifact has data
  if (!artifact.data || !artifact.data.resultData) {
    return {
      summary: "I don't have enough computed data to explain yet.",
      limitations: ['No artifact data available'],
    };
  }

  // Prepare artifact summary for LLM
  const artifactSummary = formatArtifactForLLM(artifact);
  
  // Prepare dataset profile summary (column names + types only)
  const profileSummary = formatProfileForLLM(datasetProfile);

  // Prepare prior artifacts context (last N artifacts, N ≤ 3)
  const priorContext = formatPriorArtifactsForLLM(priorArtifacts.slice(-3));

  // Construct mode-specific instruction
  const modeInstruction = getModeInstruction(mode);

  // Construct user message
  const userMessage = `User Question: ${userQuestion}

Current Computed Result:
${artifactSummary}

${priorContext ? `Prior Results (for context only):
${priorContext}

` : ''}Dataset Context:
${profileSummary}

${modeInstruction}

Respond in JSON format with this structure:
{
  "summary": "Your explanation text here",
  "implications": ["implication 1", "implication 2"] (optional array),
  "caveats": ["caveat 1", "caveat 2"] (optional array)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3, // Lower temperature for more deterministic explanations
      max_tokens: 500,
      response_format: { type: 'json_object' }, // Force structured output
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from LLM');
    }

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw new Error(`Failed to parse LLM response as JSON: ${parseError}`);
    }
    
    // Validate structure
    if (typeof parsed.summary !== 'string') {
      throw new Error('Invalid explanation format: missing summary');
    }

    return {
      summary: parsed.summary.trim(),
      implications: Array.isArray(parsed.implications) && parsed.implications.length > 0 
        ? parsed.implications.map((i: any) => String(i).trim()).filter((i: string) => i.length > 0)
        : undefined,
      caveats: Array.isArray(parsed.caveats) && parsed.caveats.length > 0
        ? parsed.caveats.map((c: any) => String(c).trim()).filter((c: string) => c.length > 0)
        : undefined,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
      } : undefined,
    };
  } catch (error) {
    console.error('[LLM Explainer] Error generating explanation:', error);
    
    // Fallback explanation
    return {
      summary: "I encountered an error while generating an explanation. The computed result is available in the artifacts panel.",
      caveats: ['Explanation generation failed'],
    };
  }
}

/**
 * Get mode-specific instruction for LLM
 */
function getModeInstruction(mode: ExplanationMode): string {
  switch (mode) {
    case 'descriptive':
      return 'Provide a clear, factual description of what this result represents. State the numbers exactly as shown.';
    case 'interpretive':
      return 'Explain what this result suggests and what it implies. Highlight key insights while staying grounded in the numbers.';
    case 'comparative':
      return 'Compare this result to prior results if available. Note changes, patterns, or relationships. Reference exact numbers from artifacts.';
    case 'cautionary':
      return 'Explain this result with emphasis on limitations, assumptions, and what should be considered when interpreting it.';
    default:
      return 'Explain what this computed result means. Reference the exact numbers from the artifact.';
  }
}

/**
 * Format prior artifacts for LLM context (metadata only, no raw data)
 */
function formatPriorArtifactsForLLM(priorArtifacts: GeneratedArtifact[]): string {
  if (priorArtifacts.length === 0) {
    return '';
  }

  let formatted = '';
  priorArtifacts.forEach((artifact, idx) => {
    const { resultType, metadata } = artifact.data;
    formatted += `Prior Result ${idx + 1}:\n`;
    formatted += `  Type: ${resultType}\n`;
    if (metadata.intent) {
      formatted += `  Intent: ${metadata.intent}\n`;
    }
    if (metadata.metric) {
      formatted += `  Metric: ${metadata.metric}\n`;
    }
    if (metadata.dimension) {
      formatted += `  Dimension: ${metadata.dimension}\n`;
    }
    
    // Include summary of result data (not full data)
    if (resultType === 'scalar') {
      formatted += `  Value: ${artifact.data.resultData}\n`;
    } else if (resultType === 'table' || resultType === 'series') {
      const data = artifact.data.resultData as any[];
      if (Array.isArray(data) && data.length > 0) {
        formatted += `  Rows/Points: ${data.length}\n`;
        formatted += `  Sample: ${JSON.stringify(data[0])}\n`;
      }
    }
    formatted += '\n';
  });

  return formatted.trim();
}

/**
 * Format artifact data for LLM (no raw data, only results)
 */
function formatArtifactForLLM(artifact: GeneratedArtifact): string {
  const { resultType, resultData, metadata } = artifact.data;
  
  let formatted = `Result Type: ${resultType}\n`;
  
  if (metadata.intent) {
    formatted += `Analysis Intent: ${metadata.intent}\n`;
  }
  if (metadata.metric) {
    formatted += `Metric: ${metadata.metric}\n`;
  }
  if (metadata.dimension) {
    formatted += `Dimension: ${metadata.dimension}\n`;
  }
  if (metadata.timeColumn) {
    formatted += `Time Column: ${metadata.timeColumn}\n`;
  }
  
  formatted += `\nResult Data:\n`;
  
  if (resultType === 'scalar') {
    // Scalar value
    formatted += `Value: ${resultData}`;
  } else if (resultType === 'table') {
    // Table data - show structure only, not all rows
    if (Array.isArray(resultData) && resultData.length > 0) {
      const firstRow = resultData[0];
      const columns = Object.keys(firstRow);
      formatted += `Columns: ${columns.join(', ')}\n`;
      formatted += `Total Rows: ${resultData.length}\n`;
      formatted += `Sample (first 3 rows):\n`;
      resultData.slice(0, 3).forEach((row: any, idx: number) => {
        formatted += `Row ${idx + 1}: ${JSON.stringify(row)}\n`;
      });
      if (resultData.length > 3) {
        formatted += `... and ${resultData.length - 3} more rows`;
      }
    } else {
      formatted += `Empty table`;
    }
  } else if (resultType === 'series') {
    // Series data - show structure only
    if (Array.isArray(resultData) && resultData.length > 0) {
      const firstPoint = resultData[0];
      const keys = Object.keys(firstPoint);
      formatted += `Series Keys: ${keys.join(', ')}\n`;
      formatted += `Total Data Points: ${resultData.length}\n`;
      formatted += `Sample (first 3 points):\n`;
      resultData.slice(0, 3).forEach((point: any, idx: number) => {
        formatted += `Point ${idx + 1}: ${JSON.stringify(point)}\n`;
      });
      if (resultData.length > 3) {
        formatted += `... and ${resultData.length - 3} more points`;
      }
    } else {
      formatted += `Empty series`;
    }
  }
  
  return formatted;
}

/**
 * Format dataset profile for LLM (column names + types only, no raw data)
 */
function formatProfileForLLM(profile: DatasetProfile): string {
  let formatted = `Dataset has ${profile.columns.length} columns:\n`;
  
  profile.columns.forEach((col) => {
    formatted += `- ${col.name} (${col.type})`;
    if (col.type === 'number') {
      if (col.min !== undefined && col.max !== undefined) {
        formatted += `, range: ${col.min} to ${col.max}`;
      }
      if (col.mean !== undefined) {
        formatted += `, mean: ${col.mean.toFixed(2)}`;
      }
    }
    formatted += '\n';
  });
  
  return formatted;
}

