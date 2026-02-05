/**
 * Phase 2: Sales Agent "Sally" - Strategy Selector
 * 
 * ⚠️ PHASE 2 ONLY - Strategy Lock
 * ⚠️ Deterministic first, LLM fallback only if inconclusive
 * ⚠️ Exactly one strategy per run
 * 
 * This module selects a sales strategy based on audience, market, and goal.
 * Strategy selection is deterministic using rules, with LLM fallback only
 * when rules are inconclusive.
 */

import { getOpenAIClient } from '@/lib/openai-client';

export type SalesStrategy = 'pain' | 'roi' | 'curiosity' | 'authority';

export interface StrategySelection {
  strategy: SalesStrategy;
  reason: string;
}

export interface StrategySelectionInput {
  audience: string;
  market: string;
  goal: string;
}

/**
 * Select sales strategy using deterministic rules
 * Phase 2: Rules-based selection with clear logic
 */
function selectStrategyDeterministic(input: StrategySelectionInput): StrategySelection | null {
  const { audience, market, goal } = input;
  const audienceLower = audience.toLowerCase();
  const marketLower = market.toLowerCase();
  const goalLower = goal.toLowerCase();

  // Rule 1: ROI strategy for conversion-focused goals in B2B/SaaS markets
  if (
    (goalLower.includes('conversion') || goalLower.includes('upsell')) &&
    (marketLower.includes('b2b') || marketLower.includes('saas') || marketLower.includes('enterprise'))
  ) {
    return {
      strategy: 'roi',
      reason: 'ROI-focused approach for conversion goals in B2B markets',
    };
  }

  // Rule 2: Pain strategy for retention goals or when pain points are mentioned
  if (
    goalLower.includes('retention') ||
    audienceLower.includes('problem') ||
    audienceLower.includes('challenge') ||
    audienceLower.includes('pain') ||
    audienceLower.includes('struggle') ||
    audienceLower.includes('issue')
  ) {
    return {
      strategy: 'pain',
      reason: 'Pain-focused approach for retention goals or when pain points are evident',
    };
  }

  // Rule 3: Authority strategy for regulated industries or formal contexts
  if (
    marketLower.includes('finance') ||
    marketLower.includes('healthcare') ||
    marketLower.includes('legal') ||
    marketLower.includes('government') ||
    marketLower.includes('compliance')
  ) {
    return {
      strategy: 'authority',
      reason: 'Authority-based approach for regulated or formal industries',
    };
  }

  // Rule 4: Curiosity strategy for awareness/engagement goals in B2C markets
  if (
    (goalLower.includes('awareness') || goalLower.includes('engagement')) &&
    (marketLower.includes('b2c') || marketLower.includes('consumer') || marketLower.includes('retail'))
  ) {
    return {
      strategy: 'curiosity',
      reason: 'Curiosity-driven approach for awareness goals in consumer markets',
    };
  }

  // Rule 5: ROI strategy for lead generation in B2B
  if (
    goalLower.includes('lead') &&
    (marketLower.includes('b2b') || marketLower.includes('saas'))
  ) {
    return {
      strategy: 'roi',
      reason: 'ROI-focused approach for lead generation in B2B markets',
    };
  }

  // Rule 6: Pain strategy for B2B when no specific goal match
  if (marketLower.includes('b2b') || marketLower.includes('saas')) {
    return {
      strategy: 'pain',
      reason: 'Pain-focused approach for B2B markets',
    };
  }

  // Rule 7: Curiosity strategy for B2C when no specific goal match
  if (marketLower.includes('b2c') || marketLower.includes('consumer') || marketLower.includes('retail')) {
    return {
      strategy: 'curiosity',
      reason: 'Curiosity-driven approach for consumer markets',
    };
  }

  // If no rules match, return null to trigger LLM fallback
  return null;
}

/**
 * Select strategy using LLM fallback
 * Phase 2: Only used when deterministic rules are inconclusive
 */
async function selectStrategyLLM(input: StrategySelectionInput): Promise<StrategySelection> {
  const openai = getOpenAIClient();

  const prompt = `You are a sales strategy selector. Based on the following inputs, select ONE sales strategy:

Target Audience: ${input.audience}
Market: ${input.market}
Goal: ${input.goal}

Available strategies:
- "pain": Focus on problems and pain points the audience faces
- "roi": Focus on return on investment and measurable benefits
- "curiosity": Focus on intriguing questions and engaging hooks
- "authority": Focus on expertise, credentials, and trust signals

Return ONLY a JSON object with this exact structure:
{
  "strategy": "pain" | "roi" | "curiosity" | "authority",
  "reason": "Brief one-line explanation for why this strategy was chosen"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a sales strategy selector. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more deterministic selection
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from LLM');
    }

    const parsed = JSON.parse(content);
    
    // Validate strategy is one of the allowed values
    const validStrategies: SalesStrategy[] = ['pain', 'roi', 'curiosity', 'authority'];
    const strategy = validStrategies.includes(parsed.strategy) 
      ? parsed.strategy 
      : 'roi'; // Default fallback

    return {
      strategy,
      reason: String(parsed.reason || 'LLM-selected strategy based on input context').trim(),
    };
  } catch (error) {
    console.error('[Sally] Error in LLM strategy selection:', error);
    // Fallback to ROI if LLM fails
    return {
      strategy: 'roi',
      reason: 'Default ROI strategy (LLM selection failed)',
    };
  }
}

/**
 * Select sales strategy for a run
 * Phase 2: Deterministic first, LLM fallback only if inconclusive
 * 
 * This is the main entry point for strategy selection.
 * It ensures exactly one strategy is selected per run.
 */
export async function selectStrategy(
  input: StrategySelectionInput
): Promise<StrategySelection> {
  // Try deterministic selection first
  const deterministicResult = selectStrategyDeterministic(input);
  
  if (deterministicResult) {
    return deterministicResult;
  }

  // Fall back to LLM only if deterministic rules are inconclusive
  return await selectStrategyLLM(input);
}

