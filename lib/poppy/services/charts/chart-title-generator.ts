/**
 * Phase 5: Chart Title & Description Generator
 * Data Analyst Agent (Poppy) - LLM-Assisted Chart Metadata
 * 
 * LLM role is LIMITED:
 * - Suggest if chart is helpful (optional)
 * - Generate chart title
 * - Generate short description
 * 
 * LLM may NOT:
 * - Choose chart type
 * - Modify data
 * - Compute aggregates
 */

import { getOpenAIClient } from '@/lib/openai-client';
import type { GeneratedArtifact } from '@/lib/poppy/types';
import type { ChartSpec } from './chart-selection';

const openai = getOpenAIClient();

const SYSTEM_PROMPT = `You are a data visualization assistant.
Your role is LIMITED to:
1. Generating clear, concise chart titles
2. Writing brief chart descriptions (one sentence max)

You must NOT:
- Choose chart types
- Modify data values
- Compute new metrics
- Make predictions or forecasts

Be concise and factual.`;

/**
 * Generate chart title and description using LLM (optional enhancement)
 */
export async function generateChartMetadata(
  artifact: GeneratedArtifact,
  chartSpec: ChartSpec
): Promise<{ title: string; description?: string; usage?: { promptTokens: number; completionTokens: number } }> {
  const resultData = artifact.data as any;
  const resultType = resultData?.resultType;
  const metadata = artifact.metadata || {};

  // Prepare context for LLM
  const context = `Artifact Type: ${resultType}
Chart Type: ${chartSpec.type}
X-Axis: ${chartSpec.x}
Y-Axis: ${Array.isArray(chartSpec.y) ? chartSpec.y.join(', ') : chartSpec.y}
Metric: ${metadata.metric || 'N/A'}
Dimension: ${metadata.dimension || 'N/A'}
Current Title: ${artifact.title}`;

  const userMessage = `Generate a clear, concise chart title and optional one-sentence description for this visualization.

${context}

Respond in JSON format:
{
  "title": "Clear chart title here",
  "description": "Optional one-sentence description" (optional)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from LLM');
    }

    const parsed = JSON.parse(content);
    
    return {
      title: parsed.title?.trim() || chartSpec.title,
      description: parsed.description?.trim() || undefined,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
      } : undefined,
    };
  } catch (error) {
    console.error('[Chart Title Generator] Error generating metadata:', error);
    // Fallback to artifact title
    return {
      title: chartSpec.title,
    };
  }
}

