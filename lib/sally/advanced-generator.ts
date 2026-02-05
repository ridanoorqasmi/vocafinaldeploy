/**
 * Phase 2: Advanced Sales Mode Generator
 * 
 * ⚠️ PHASE 2 - Advanced Generation Engine
 * ⚠️ Separate from quick generator - does not modify existing logic
 * ⚠️ Flow-based, strategy-aware outputs with branching paths
 * 
 * Generates advanced sales content with:
 * - Buying trigger awareness
 * - Persona/KPI alignment
 * - Positioning and proof handling
 * - Objection handling
 * - CTA hierarchy
 * - Branching paths (especially for cold call)
 * - No fabricated proof or metrics
 */

import { getOpenAIClient } from '@/lib/openai-client';
import type { SalesStrategy } from './strategy-selector';

export interface AdvancedNormalizedInput {
  company_name: string;
  product_or_service: string;
  one_line_value: string;
  goal: string;
  market: string;
  tone: string;
  target_audience: string;
  persona_role?: string;
  persona_role_custom?: string;
  primary_kpi?: string;
  primary_kpi_custom?: string;
  top_pain?: string;
  sales_motion?: string;
  primary_cta?: string;
  fallback_cta?: string;
  buying_trigger?: string;
  buying_trigger_note?: string;
  competitor_or_alternative?: string;
  differentiator_angle?: string;
  proof_types?: string[];
  proof_snippet?: string;
  objections?: string[];
  objections_custom?: string;
  strategy: SalesStrategy;
  industry_id?: string | null;
}

export interface AdvancedColdCallOutput {
  opener: string; // Pattern interrupt + relevance hook
  value_teaser: string; // 1 sentence
  permission_check: string; // Short
  discovery_questions: string[]; // 2-3, persona-aware
  primary_cta: string; // Short, low-friction
  fallback_cta: string; // Short
  objection_handling: Array<{
    objection_label: string;
    response: string; // 1-2 lines
    re_ask_cta: string;
  }>;
  branches: {
    if_not_interested: string; // 2-step: acknowledge + reframe + exit
    if_send_info: string; // Ask 1 qualifier + confirm next step
    if_wrong_person: string; // Ask for referral + confirm
  };
  voicemail?: string; // Optional, 20-30 sec variant
}

export interface AdvancedColdEmailOutput {
  subject_lines: string[]; // 2 variants, <= 6-8 words each
  opening_lines: string[]; // 2 variants, <= 2 lines each
  body: string; // 3-6 short lines max; scannable
  personalization_slot: string; // Placeholder if no enrichment data
  cta_primary: string; // Single sentence
  cta_fallback: string; // Single sentence
  ps?: string; // Optional; only if it adds credibility without proof
}

export interface AdvancedPitchOutput {
  pitch_30s: string; // Tight
  pitch_60s: string; // Adds 1 differentiator + 1 proof mention if available
  one_liner: string; // Ultra short, memorisable
  qualifier: string; // 1 question to transition to discovery
}

export interface AdvancedGenerationOutput {
  coldCallScript?: AdvancedColdCallOutput;
  coldEmail?: AdvancedColdEmailOutput;
  salesPitch?: AdvancedPitchOutput;
}

/**
 * Get strategy-specific instructions for advanced mode
 */
function getAdvancedStrategyInstructions(strategy: SalesStrategy): string {
  switch (strategy) {
    case 'pain':
      return `STRATEGY: Pain-focused approach. Lead with specific pain points the persona faces. Frame every value statement around eliminating pain. Use empathetic language that shows understanding of their struggles.`;
    
    case 'roi':
      return `STRATEGY: ROI-focused approach. Emphasize measurable outcomes and business impact. Use concrete value propositions tied to the primary KPI. Focus on efficiency, cost savings, or revenue impact.`;
    
    case 'curiosity':
      return `STRATEGY: Curiosity-driven approach. Use intriguing hooks and thought-provoking questions. Create interest through surprising insights. Avoid being too direct initially.`;
    
    case 'authority':
      return `STRATEGY: Authority-based approach. Emphasize expertise and credibility. Use professional language and trust signals. Build confidence through demonstrated knowledge.`;
    
    default:
      return `STRATEGY: Professional approach. Focus on value and benefits.`;
  }
}

/**
 * Build proof constraints for prompt
 */
function buildProofConstraints(input: AdvancedNormalizedInput): string {
  if (!input.proof_types || input.proof_types.length === 0) {
    return `CRITICAL PROOF CONSTRAINT: No proof provided. You MUST NOT invent any metrics, percentages, customer names, logos, certifications, or case study details. Use soft credibility language like "teams typically see improvements" or "organizations often experience" - never specific numbers or customer names.`;
  }
  
  if (input.proof_snippet) {
    return `PROOF AVAILABLE: You may reference the provided proof snippet once: "${input.proof_snippet}". Do not exaggerate or expand on it. Do not invent additional proof.`;
  }
  
  return `PROOF TYPES AVAILABLE: ${input.proof_types.join(', ')}. However, no specific proof snippet was provided. You may mention that proof exists but do NOT invent specific metrics, customer names, or details. Use soft language like "we've helped similar organizations" without specifics.`;
}

/**
 * Build competitor positioning instructions
 */
function buildCompetitorInstructions(input: AdvancedNormalizedInput): string {
  if (input.competitor_or_alternative) {
    return `COMPETITOR/ALTERNATIVE: ${input.competitor_or_alternative}. Include ONE contrast line that highlights your differentiator (${input.differentiator_angle || 'value'}) without bashing the competitor. Be professional and respectful.`;
  }
  
  return `COMPETITOR/ALTERNATIVE: Status quo/manual process. Contrast against the inefficiencies of current approach.`;
}

/**
 * Build objection handling instructions
 */
function buildObjectionInstructions(input: AdvancedNormalizedInput): string {
  const objections = input.objections || [];
  if (objections.length === 0) {
    return `OBJECTIONS: Assume "too busy" and "already using something". Provide responses for both.`;
  }
  
  const objectionList = objections.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n');
  return `OBJECTIONS TO HANDLE:\n${objectionList}\n${input.objections_custom ? `Custom: ${input.objections_custom}` : ''}\nProvide a 1-2 line response for each, plus a re-ask CTA.`;
}

/**
 * Generate advanced sales content
 */
export async function generateAdvancedSalesContent(
  input: AdvancedNormalizedInput,
  selectedAssets: { coldCall: boolean; coldEmail: boolean; pitch: boolean }
): Promise<AdvancedGenerationOutput> {
  const openai = getOpenAIClient();
  
  const strategyInstructions = getAdvancedStrategyInstructions(input.strategy);
  const proofConstraints = buildProofConstraints(input);
  const competitorInstructions = buildCompetitorInstructions(input);
  const objectionInstructions = buildObjectionInstructions(input);
  
  // Build persona context
  const personaContext = input.persona_role_custom || input.persona_role || input.target_audience;
  const kpiContext = input.primary_kpi_custom || input.primary_kpi || 'business outcomes';
  const buyingContext = input.buying_trigger_note || input.buying_trigger || 'efficiency/scale';
  
  const systemPrompt = `You are an expert sales content generator specializing in flow-based, strategy-aware sales scripts. You generate realistic, concise, skimmable sales content that respects constraints and never fabricates proof.

CRITICAL RULES:
1. NEVER invent metrics, percentages, customer names, logos, or certifications
2. If proof is missing, use soft credibility language only
3. Keep all outputs concise and sales-floor realistic
4. Respect the selected strategy throughout
5. Include all required structural elements (permission checks, CTAs, objection handling)
6. Make content persona-aware and buying-trigger aware`;

  const assetsToGenerate: string[] = [];
  if (selectedAssets.coldCall) assetsToGenerate.push('coldCallScript');
  if (selectedAssets.coldEmail) assetsToGenerate.push('coldEmail');
  if (selectedAssets.pitch) assetsToGenerate.push('salesPitch');

  const userPrompt = `Generate advanced sales content for:

Company: ${input.company_name}
Product/Service: ${input.product_or_service}
One-line Value: ${input.one_line_value}
Target Persona: ${personaContext}
Primary KPI Focus: ${kpiContext}
Top Pain: ${input.top_pain || 'operational challenges'}
Sales Motion: ${input.sales_motion || 'outbound cold'}
Buying Trigger: ${buyingContext}
Goal: ${input.goal}
Market: ${input.market}
Tone: ${input.tone}

${strategyInstructions}

${proofConstraints}

${competitorInstructions}

${objectionInstructions}

CTA HIERARCHY:
- Primary CTA: ${input.primary_cta || 'Schedule a brief call'}
- Fallback CTA: ${input.fallback_cta || 'Receive more information'}

Generate ONLY these assets: ${assetsToGenerate.join(', ')}

Return a JSON object with this EXACT structure:
{
  ${selectedAssets.coldCall ? `"coldCallScript": {
    "opener": "Pattern interrupt + relevance hook (1-2 sentences, persona-aware)",
    "value_teaser": "One sentence value proposition",
    "permission_check": "Short permission question",
    "discovery_questions": ["Question 1 (persona-aware)", "Question 2", "Question 3"],
    "primary_cta": "Short, low-friction primary CTA",
    "fallback_cta": "Short fallback CTA",
    "objection_handling": [
      {
        "objection_label": "Objection name",
        "response": "1-2 line response",
        "re_ask_cta": "Re-ask CTA line"
      }
    ],
    "branches": {
      "if_not_interested": "Acknowledge + reframe + exit (2 steps)",
      "if_send_info": "Ask 1 qualifier + confirm next step",
      "if_wrong_person": "Ask for referral + confirm"
    },
    "voicemail": "20-30 second voicemail variant (optional)"
  },` : ''}
  ${selectedAssets.coldEmail ? `"coldEmail": {
    "subject_lines": ["Subject variant 1 (6-8 words)", "Subject variant 2 (6-8 words)"],
    "opening_lines": ["Opening variant 1 (<=2 lines)", "Opening variant 2 (<=2 lines)"],
    "body": "3-6 short, scannable lines. Reference buying trigger early if provided. Include proof snippet once if provided, otherwise use soft credibility language.",
    "personalization_slot": "{{recent_trigger_or_observation}} or specific placeholder",
    "cta_primary": "Single sentence primary CTA",
    "cta_fallback": "Single sentence fallback CTA",
    "ps": "Optional PS if it adds credibility without proof"
  },` : ''}
  ${selectedAssets.pitch ? `"salesPitch": {
    "pitch_30s": "Tight 30-second pitch (persona-aware)",
    "pitch_60s": "60-second pitch adding 1 differentiator + 1 proof mention if available",
    "one_liner": "Ultra short, memorisable one-liner",
    "qualifier": "1 question to transition to discovery"
  }` : ''}
}

CRITICAL: 
- Keep all text concise and realistic
- No fluff or filler
- Respect tone: ${input.tone === 'direct' ? 'reduce pleasantries' : input.tone === 'friendly' ? 'add warmth but keep tight' : 'professional'}
- Tie hooks to persona + pain + buying trigger
- Never invent proof details`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from LLM');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw new Error(`Failed to parse LLM response as JSON: ${parseError}`);
    }

    return normalizeAdvancedOutput(parsed, selectedAssets);
  } catch (error) {
    console.error('[Sally Advanced] Error generating content:', error);
    throw error;
  }
}

/**
 * Normalize advanced output to exact required structure
 */
function normalizeAdvancedOutput(
  raw: any,
  selectedAssets: { coldCall: boolean; coldEmail: boolean; pitch: boolean }
): AdvancedGenerationOutput {
  const output: AdvancedGenerationOutput = {};

  if (selectedAssets.coldCall && raw.coldCallScript) {
    const cc = raw.coldCallScript;
    output.coldCallScript = {
      opener: String(cc.opener || 'Hi [Name], quick question - are you the right person to talk to about [topic]?').trim(),
      value_teaser: String(cc.value_teaser || 'We help companies like yours [value].').trim(),
      permission_check: String(cc.permission_check || 'Do you have 30 seconds?').trim(),
      discovery_questions: Array.isArray(cc.discovery_questions)
        ? cc.discovery_questions.map((q: any) => String(q).trim()).slice(0, 3)
        : ['What challenges are you facing?', 'What would success look like?'],
      primary_cta: String(cc.primary_cta || 'Would you be open to a brief conversation?').trim(),
      fallback_cta: String(cc.fallback_cta || 'Can I send you some information?').trim(),
      objection_handling: Array.isArray(cc.objection_handling)
        ? cc.objection_handling.map((obj: any) => ({
            objection_label: String(obj.objection_label || 'Objection').trim(),
            response: String(obj.response || 'I understand.').trim(),
            re_ask_cta: String(obj.re_ask_cta || 'Would you be open to...').trim(),
          })).slice(0, 2)
        : [],
      branches: {
        if_not_interested: String(cc.branches?.if_not_interested || 'I understand. If things change, feel free to reach out.').trim(),
        if_send_info: String(cc.branches?.if_send_info || 'What would be most helpful to send?').trim(),
        if_wrong_person: String(cc.branches?.if_wrong_person || 'Who would be the right person to talk to?').trim(),
      },
      voicemail: cc.voicemail ? String(cc.voicemail).trim() : undefined,
    };
  }

  if (selectedAssets.coldEmail && raw.coldEmail) {
    const ce = raw.coldEmail;
    output.coldEmail = {
      subject_lines: Array.isArray(ce.subject_lines)
        ? ce.subject_lines.map((s: any) => String(s).trim()).slice(0, 2)
        : ['Quick question', 'Following up'],
      opening_lines: Array.isArray(ce.opening_lines)
        ? ce.opening_lines.map((o: any) => String(o).trim()).slice(0, 2)
        : ['Hi [Name],', 'I noticed...'],
      body: String(ce.body || 'I wanted to reach out...').trim(),
      personalization_slot: String(ce.personalization_slot || '{{recent_trigger_or_observation}}').trim(),
      cta_primary: String(ce.cta_primary || 'Would you be open to a brief call?').trim(),
      cta_fallback: String(ce.cta_fallback || 'Can I send you more information?').trim(),
      ps: ce.ps ? String(ce.ps).trim() : undefined,
    };
  }

  if (selectedAssets.pitch && raw.salesPitch) {
    const sp = raw.salesPitch;
    output.salesPitch = {
      pitch_30s: String(sp.pitch_30s || 'Our solution helps...').trim(),
      pitch_60s: String(sp.pitch_60s || 'Our solution helps...').trim(),
      one_liner: String(sp.one_liner || 'We help [target] achieve [outcome].').trim(),
      qualifier: String(sp.qualifier || 'What challenges are you facing?').trim(),
    };
  }

  return output;
}
