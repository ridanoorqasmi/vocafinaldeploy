/**
 * SALLY — SALES AGENT (V1)
 *
 * Responsibilities:
 * - Generate sales content inside workspaces
 * - Coach and refine sales messaging
 * - Guide manual sales execution via Playbooks
 *
 * Explicitly excluded:
 * - Lead analysis
 * - CRM behavior
 * - Automation
 * - Data enrichment
 *
 * Sally is a human-in-the-loop sales assistant,
 * not an autonomous sales agent.
 *
 * Execution Mode: CONTENT_AND_GUIDED_EXECUTION_V1
 * 
 * Content Generation Service
 * 
 * Generates sales content using a fixed prompt template that strictly
 * enforces the chosen strategy across all output sections.
 */

import OpenAI from 'openai';
import { getOpenAIClient } from '@/lib/openai-client';
import type { SalesStrategy } from './strategy-selector';

export interface SallyGenerationInput {
  companyName: string;
  productDesc: string;
  targetAudience: string;
  goal: string;
  tone: string;
  market: string;
  strategy: SalesStrategy; // Phase 2: Required strategy
}

export interface SallyGenerationOutput {
  coldCallScript: {
    opening: string;
    problem: string;
    value: string;
    cta: string;
  };
  coldEmail: {
    subjectVariants: string[];
    body: string;
    cta: string;
  };
  salesPitch: {
    pitch30s: string;
    pitch2min: string;
    bullets: string[];
  };
}

/**
 * Get strategy-specific instructions for prompt
 * Phase 2: Enforces strategy without exposing logic to user
 */
function getStrategyInstructions(strategy: SalesStrategy): string {
  switch (strategy) {
    case 'pain':
      return `STRATEGY: Pain-focused approach. Emphasize problems, challenges, and pain points the audience faces. Frame the solution as addressing specific pain points. Use language that highlights struggles, frustrations, and difficulties.`;
    
    case 'roi':
      return `STRATEGY: ROI-focused approach. Emphasize return on investment, measurable benefits, cost savings, and quantifiable results. Use numbers, percentages, and concrete value propositions. Focus on business outcomes and financial impact.`;
    
    case 'curiosity':
      return `STRATEGY: Curiosity-driven approach. Use intriguing questions, surprising insights, and engaging hooks. Create interest through thought-provoking statements. Avoid being too direct; instead, spark curiosity and engagement.`;
    
    case 'authority':
      return `STRATEGY: Authority-based approach. Emphasize expertise, credentials, trust signals, and proven track record. Use professional language, cite credentials, and build credibility. Focus on trust, reliability, and expertise.`;
    
    default:
      return `STRATEGY: Professional approach. Focus on value and benefits.`;
  }
}

/**
 * Generate sales content using fixed prompt template with strategy enforcement
 * Phase 2: Strategy is locked and enforced across all sections
 */
export async function generateSalesContent(
  input: SallyGenerationInput
): Promise<SallyGenerationOutput> {
  const openai = getOpenAIClient();

  // Phase 2: Get strategy-specific instructions
  const strategyInstructions = getStrategyInstructions(input.strategy);

  // Phase 2: Fixed prompt template with strategy enforcement
  const systemPrompt = `You are a professional sales content generator. Generate sales content based on the provided business context and strategy. Return ONLY valid JSON in the exact structure specified.`;

  const userPrompt = `Generate sales content for the following business:

Company Name: ${input.companyName}
Product/Service: ${input.productDesc}
Target Audience: ${input.targetAudience}
Sales Goal: ${input.goal}
Tone: ${input.tone}
Market: ${input.market}

${strategyInstructions}

CRITICAL: All sections (cold call script, email, and pitch) MUST consistently follow the strategy above. Do not mix strategies. The opening, problem, value, CTA, subject lines, body, and pitch bullets must all align with the same strategy.

Return a JSON object with this EXACT structure:
{
  "coldCallScript": {
    "opening": "Opening line for cold call (1-2 sentences)",
    "problem": "Problem statement (2-3 sentences)",
    "value": "Value proposition (2-3 sentences)",
    "cta": "Call-to-action (1-2 sentences)"
  },
  "coldEmail": {
    "subjectVariants": ["Subject line 1", "Subject line 2", "Subject line 3"],
    "body": "Email body text (3-4 paragraphs)",
    "cta": "Email call-to-action (1-2 sentences)"
  },
  "salesPitch": {
    "pitch30s": "30-second pitch (2-3 sentences)",
    "pitch2min": "2-minute pitch (4-6 sentences)",
    "bullets": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"]
  }
}

Ensure all fields are strings (except bullets which is an array of strings). Be concise, professional, and aligned with the specified tone.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }, // Force JSON output
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

    // Normalize and validate output structure
    return normalizeOutput(parsed);
  } catch (error) {
    console.error('[Sally] Error generating sales content:', error);
    throw error;
  }
}

/**
 * Normalize LLM output to exact required structure
 * Phase 1: Sanitize and correct any deviations
 */
function normalizeOutput(raw: any): SallyGenerationOutput {
  // Normalize coldCallScript
  const coldCallScript = {
    opening: String(raw.coldCallScript?.opening || raw.coldCallScript?.opening || 'Hello, I hope this call finds you well.').trim(),
    problem: String(raw.coldCallScript?.problem || raw.coldCallScript?.problem || 'Many businesses face challenges in this area.').trim(),
    value: String(raw.coldCallScript?.value || raw.coldCallScript?.value || 'Our solution addresses these challenges effectively.').trim(),
    cta: String(raw.coldCallScript?.cta || raw.coldCallScript?.cta || 'Would you be open to a brief conversation?').trim(),
  };

  // Normalize coldEmail
  const subjectVariants = Array.isArray(raw.coldEmail?.subjectVariants)
    ? raw.coldEmail.subjectVariants.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0).slice(0, 3)
    : raw.coldEmail?.subjectVariants
    ? [String(raw.coldEmail.subjectVariants).trim()]
    : ['Re: Quick question', 'Following up', 'Partnership opportunity'];

  const coldEmail = {
    subjectVariants: subjectVariants.length >= 3 ? subjectVariants : [
      ...subjectVariants,
      ...Array(3 - subjectVariants.length).fill('').map((_, i) => `Subject ${i + 1}`)
    ].slice(0, 3),
    body: String(raw.coldEmail?.body || raw.coldEmail?.body || 'I wanted to reach out regarding our solution.').trim(),
    cta: String(raw.coldEmail?.cta || raw.coldEmail?.cta || 'I would love to schedule a brief call.').trim(),
  };

  // Normalize salesPitch
  const bullets = Array.isArray(raw.salesPitch?.bullets)
    ? raw.salesPitch.bullets.map((b: any) => String(b).trim()).filter((b: string) => b.length > 0).slice(0, 5)
    : raw.salesPitch?.bullets
    ? [String(raw.salesPitch.bullets).trim()]
    : ['Key benefit 1', 'Key benefit 2', 'Key benefit 3'];

  const salesPitch = {
    pitch30s: String(raw.salesPitch?.pitch30s || raw.salesPitch?.pitch30s || 'Our solution helps businesses achieve their goals.').trim(),
    pitch2min: String(raw.salesPitch?.pitch2min || raw.salesPitch?.pitch2min || 'Our comprehensive solution addresses key business challenges and delivers measurable results.').trim(),
    bullets: bullets.length >= 3 ? bullets : [
      ...bullets,
      ...Array(Math.max(0, 3 - bullets.length)).fill('').map((_, i) => `Key point ${bullets.length + i + 1}`)
    ],
  };

  return {
    coldCallScript,
    coldEmail,
    salesPitch,
  };
}

