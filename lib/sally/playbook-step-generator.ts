/**
 * Playbook Step Generation Service
 * 
 * ⚠️ STRICT ISOLATION: Uses only playbook context, NO workspace dependencies
 * 
 * Generates content for individual playbook steps using:
 * - Playbook core message
 * - Step objective
 * - Target persona
 * 
 * Excludes: workspace configuration, prior workspace outputs, lead analysis
 */

import OpenAI from 'openai';
import { getOpenAIClient } from '@/lib/openai-client';

export interface PlaybookStepGenerationInput {
  coreMessage: string;
  stepObjective: string;
  targetPersona: string;
  talkTrack: string;
}

export interface PlaybookStepGenerationOutput {
  content: string;
  keyPoints: string[];
  nextSteps: string[];
}

/**
 * Generate content for a playbook step
 * Uses only playbook context - no workspace or lead analysis data
 */
export async function generatePlaybookStepContent(
  input: PlaybookStepGenerationInput
): Promise<PlaybookStepGenerationOutput> {
  const openai = getOpenAIClient();

  const systemPrompt = `You are a sales content generator for playbook steps. Generate concise, actionable content based on the playbook's core message, step objective, and target persona. Focus on practical execution guidance.`;

  const userPrompt = `Generate sales content for a playbook step with the following context:

Core Message: ${input.coreMessage}

Step Objective: ${input.stepObjective}

Target Persona: ${input.targetPersona}

Talk Track Guidance: ${input.talkTrack}

Generate:
1. Main content (3-5 sentences) that addresses the step objective while incorporating the core message
2. 3-4 key points to emphasize
3. 2-3 suggested next steps

Return a JSON object with this EXACT structure:
{
  "content": "Main content text (3-5 sentences)",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"],
  "nextSteps": ["Next step 1", "Next step 2", "Next step 3"]
}

Be concise, professional, and focused on execution.`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
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

    // Normalize output
    return {
      content: parsed.content || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    };
  } catch (error) {
    console.error('[Sally] Error generating playbook step content:', error);
    throw error;
  }
}
