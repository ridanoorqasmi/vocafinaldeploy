/**
 * Step Intelligence Generation Service
 * 
 * ⚠️ STRICT ISOLATION: Uses only playbook context, NO workspace dependencies
 * 
 * Generates contextual guidance for playbook steps using:
 * - Playbook goal (pipeline stage)
 * - Target persona
 * - Step title
 * - Step objective
 * 
 * Excludes: workspace configuration, lead analysis, past performance
 */

import OpenAI from 'openai';
import { getOpenAIClient } from '@/lib/openai-client';

export interface StepIntelligenceInput {
  pipelineStage: string;
  targetPersona: string;
  stepTitle: string;
  stepObjective: string;
  coreMessage?: string; // Optional: playbook's core message for context
}

export interface StepIntelligenceOutput {
  step_rationale: string;
  success_signals: string[];
  failure_signals: string[];
  coach_notes: string;
}

/**
 * Generate Step Intelligence for a playbook step
 * Uses only playbook context - no workspace or lead analysis data
 */
export async function generateStepIntelligence(
  input: StepIntelligenceInput
): Promise<StepIntelligenceOutput> {
  const openai = getOpenAIClient();

  const systemPrompt = `You are a senior sales coach generating execution guidance for sales playbook steps. Provide clear, actionable guidance that helps sales reps understand why a step exists, what success looks like, what to watch for, and how to execute effectively.`;

  const userPrompt = `Generate step intelligence for a sales playbook step with the following context:

Pipeline Stage: ${input.pipelineStage}
Target Persona: ${input.targetPersona}
Step Title: ${input.stepTitle}
Step Objective: ${input.stepObjective}
${input.coreMessage ? `Playbook Core Message: ${input.coreMessage}` : ''}

Generate structured guidance that includes:

1. **Step Rationale**: A clear explanation (2-3 sentences) of why this step exists in the sales motion and its strategic purpose.

2. **Success Signals**: An array of 3-5 observable outcomes or customer behaviors that indicate the step is working and you should proceed. These should be specific, measurable indicators.

3. **Failure Signals**: An array of 3-5 warning signs or red flags that indicate friction, misalignment, or that you should slow down or adjust approach. These should help the rep recognize when things aren't going well.

4. **Coach Notes**: Practical advice (3-4 sentences) from a senior sales perspective on how to execute this step effectively, what to emphasize, and common pitfalls to avoid.

Return a JSON object with this EXACT structure:
{
  "step_rationale": "Clear explanation of why this step exists (2-3 sentences)",
  "success_signals": ["Signal 1", "Signal 2", "Signal 3", "Signal 4"],
  "failure_signals": ["Warning 1", "Warning 2", "Warning 3", "Warning 4"],
  "coach_notes": "Practical execution advice (3-4 sentences)"
}

Be specific, actionable, and focused on execution guidance.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
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

    // Validate and normalize output
    const intelligence: StepIntelligenceOutput = {
      step_rationale: typeof parsed.step_rationale === 'string' ? parsed.step_rationale.trim() : '',
      success_signals: Array.isArray(parsed.success_signals) 
        ? parsed.success_signals.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0)
        : [],
      failure_signals: Array.isArray(parsed.failure_signals)
        ? parsed.failure_signals.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0)
        : [],
      coach_notes: typeof parsed.coach_notes === 'string' ? parsed.coach_notes.trim() : '',
    };

    // Validate required fields
    if (!intelligence.step_rationale || intelligence.step_rationale.length === 0) {
      throw new Error('Generated intelligence missing step_rationale');
    }
    if (intelligence.success_signals.length === 0) {
      throw new Error('Generated intelligence missing success_signals');
    }
    if (intelligence.failure_signals.length === 0) {
      throw new Error('Generated intelligence missing failure_signals');
    }
    if (!intelligence.coach_notes || intelligence.coach_notes.length === 0) {
      throw new Error('Generated intelligence missing coach_notes');
    }

    return intelligence;
  } catch (error) {
    console.error('[Sally] Error generating step intelligence:', error);
    throw error;
  }
}
