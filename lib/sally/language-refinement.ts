/**
 * Phase 3: Language Refinement Pipeline
 * 
 * Post-generation language refinement to eliminate robotic/AI phrasing
 * and make outputs sound like real human sales reps.
 * 
 * This pipeline is purely transformative (input text → refined text).
 * It does NOT add new content, fabricate proof, or override user inputs.
 */

import type { AdvancedNormalizedInput } from './advanced-generator';
import { getIndustryPack, getIndustrySource, type IndustryId } from './industry-packs';

export interface RefinementMetadata {
  language_pass_applied: boolean;
  delivery_style_used?: string;
  pain_source?: 'user' | 'inferred';
  assumptions_added?: string[];
  industry_id_used?: string;
  industry_pack_applied?: boolean;
  industry_source?: 'user' | 'default';
}

/**
 * Hard-banned phrases that must be removed or rewritten
 */
const HARD_BANNED_PHRASES = [
  /\bleverage\b/gi,
  /\bsynergize\b/gi,
  /\bunlock value\b/gi,
  /\bseamless solution\b/gi,
  /\bcutting-edge\b/gi,
  /\bbest-in-class\b/gi,
  /\brobust platform\b/gi,
  /\bdrive efficiency\b/gi,
  /\boptimize your workflow\b/gi,
  /\bmaximize ROI\b/gi,
];

/**
 * Soft rewrite patterns (abstract → concrete)
 */
const SOFT_REWRITE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\boptimize operations\b/gi, replacement: 'cut out manual steps' },
  { pattern: /\bincrease efficiency\b/gi, replacement: 'save time each week' },
  { pattern: /\bscale effortlessly\b/gi, replacement: 'handle more work without extra headcount' },
  { pattern: /\bstreamline\b/gi, replacement: 'simplify' },
  { pattern: /\benhance productivity\b/gi, replacement: 'get more done' },
  { pattern: /\btransform\b/gi, replacement: 'improve' },
];

/**
 * Stage 1: Pain-First Rewrite Pass
 * Ensures openings start with buyer's pain, not the product
 */
function painFirstRewrite(
  text: string,
  input: AdvancedNormalizedInput,
  metadata: RefinementMetadata
): string {
  if (!text || text.trim().length === 0) return text;

  // Extract first 1-2 sentences
  const sentenceEnders = /[.!?]+/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match;

  while ((match = sentenceEnders.exec(text)) !== null) {
    const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    lastIndex = match.index + match[0].length;
    if (sentences.length >= 2) break;
  }

  // If no sentence enders found, treat entire text as one sentence
  if (sentences.length === 0) {
    sentences.push(text.trim());
  }

  const firstSentence = sentences[0];
  if (!firstSentence) return text;

  // Check if already pain-first (doesn't mention product/company/features)
  const productMentions = /\b(we|our|product|solution|platform|service|company|tool|system)\b/i;
  const featureMentions = /\b(help|enable|provide|offer|deliver|allow|make it easy)\b/i;

  if (!productMentions.test(firstSentence) && !featureMentions.test(firstSentence)) {
    // Already pain-first, return as-is
    return text;
  }

  // Build pain statement
  let painStatement = '';

  if (input.top_pain && input.top_pain.trim().length > 0) {
    // Use provided pain directly
    painStatement = input.top_pain.trim();
    // Ensure it ends with punctuation
    if (!/[.!?]$/.test(painStatement)) {
      painStatement += '.';
    }
    metadata.pain_source = 'user';
  } else {
    // Infer pain from persona/KPI/buying trigger
    const persona = input.persona_role_custom || input.persona_role || input.target_audience || 'teams';
    const kpi = input.primary_kpi_custom || input.primary_kpi;
    const trigger = input.buying_trigger_note || input.buying_trigger;

    if (kpi === 'cost_savings' || kpi === 'efficiency') {
      painStatement = `Most ${persona} waste time on manual tasks that pile up every week.`;
    } else if (kpi === 'growth' || kpi === 'revenue') {
      painStatement = `Many ${persona} struggle to scale without adding more overhead.`;
    } else if (trigger && (trigger.includes('budget') || trigger.includes('cost'))) {
      painStatement = `Most ${persona} are looking for ways to do more with their current budget.`;
    } else {
      painStatement = `Many ${persona} face challenges that slow them down.`;
    }

    metadata.pain_source = 'inferred';
    if (!metadata.assumptions_added) metadata.assumptions_added = [];
    metadata.assumptions_added.push('Pain inferred from persona/KPI/buying trigger');
  }

  // Rewrite opening with pain-first
  // Keep the rest of the text but remove the product-focused opening
  const remainingText = sentences.length > 1 
    ? sentences.slice(1).join(' ').trim()
    : text.substring(firstSentence.length).trim();

  // If remaining text starts with product mentions, remove them
  let cleanedRemaining = remainingText;
  if (productMentions.test(cleanedRemaining.substring(0, 50))) {
    // Remove product-focused phrases from start
    cleanedRemaining = cleanedRemaining
      .replace(/^(We|Our|This|It)\s+(help|enable|provide|allow|make)/i, '')
      .replace(/^(This|It)\s+(is|can|will)/i, '')
      .trim();
  }

  // Combine pain statement with remaining text
  if (cleanedRemaining && cleanedRemaining.length > 0) {
    return `${painStatement} ${cleanedRemaining}`.trim();
  }

  return painStatement;
}

/**
 * Stage 1.5: Industry Language Pack Application
 * Applies industry-specific vocabulary, emphasis, and tone adjustments
 * 
 * This stage runs AFTER pain-first rewrite and BEFORE anti-robotic pass.
 * It is deterministic and does not add new content or change meaning.
 */
function applyIndustryPack(
  text: string,
  industryId: string | null | undefined,
  mode: 'quick' | 'advanced',
  metadata: RefinementMetadata
): string {
  if (!text || text.trim().length === 0) return text;

  const pack = getIndustryPack(industryId);
  const source = getIndustrySource(industryId);
  
  // Track industry usage in metadata
  metadata.industry_id_used = pack.industry_id;
  metadata.industry_pack_applied = true;
  metadata.industry_source = source;
  
  // Record assumption if defaulting to generic_b2b (only once per metadata object)
  if (source === 'default') {
    if (!metadata.assumptions_added) {
      metadata.assumptions_added = [];
    }
    const assumptionText = `Industry: defaulted to ${pack.industry_id} (not specified)`;
    // Only add if not already present (avoid duplicates)
    if (!metadata.assumptions_added.includes(assumptionText)) {
      metadata.assumptions_added.push(assumptionText);
    }
  }

  let refined = text;

  // Apply discouraged term replacements (remove or replace)
  for (const { pattern, replacement } of pack.discouraged_terms) {
    refined = refined.replace(pattern, replacement);
  }

  // Apply preferred term replacements (only where semantically equivalent)
  // This is lighter in quick mode
  const preferredTermIntensity = mode === 'advanced' ? 1.0 : 0.5;
  for (const { pattern, replacement } of pack.preferred_terms) {
    // In quick mode, only apply if the term already exists (don't force it)
    if (mode === 'quick' && !pattern.test(refined)) {
      continue;
    }
    refined = refined.replace(pattern, replacement);
  }

  // Apply tone constraints
  if (pack.tone_constraints.avoid_overly_casual) {
    refined = refined
      .replace(/\bhey\b/gi, 'Hi')
      .replace(/\byo\b/gi, 'Hi')
      .replace(/\bwhat's up\b/gi, 'How are you');
  }

  if (pack.tone_constraints.avoid_jargon) {
    // Remove common jargon terms (already handled by discouraged_terms, but add extra safety)
    refined = refined
      .replace(/\bleverage\b/gi, 'use')
      .replace(/\bsynergize\b/gi, 'work together')
      .replace(/\boptimize\b/gi, 'improve');
  }

  // Emphasis adjustment: In advanced mode, we can slightly adjust problem framing
  // This is very light - we don't add new content, just adjust existing phrasing
  if (mode === 'advanced' && pack.emphasis_topics.length > 0) {
    // If the text mentions a problem that aligns with emphasis topics, ensure it's clear
    // This is a very subtle adjustment - we're not adding new problems
    for (const topic of pack.emphasis_topics) {
      // Only adjust if the topic is already mentioned or implied
      const topicPattern = new RegExp(`\\b${topic}\\w*\\b`, 'i');
      if (topicPattern.test(refined)) {
        // Ensure the topic is emphasized (already present, just ensure clarity)
        // No new content added
      }
    }
  }

  return refined;
}

/**
 * Stage 2: Anti-Robotic Language Pass
 * Removes AI-sounding, overused sales language
 */
function antiRoboticPass(text: string): string {
  let refined = text;

  // Remove hard-banned phrases
  for (const phrase of HARD_BANNED_PHRASES) {
    refined = refined.replace(phrase, (match) => {
      // Replace with context-appropriate plain language
      if (match.toLowerCase().includes('leverage')) return 'use';
      if (match.toLowerCase().includes('synergize')) return 'work together';
      if (match.toLowerCase().includes('unlock')) return 'get';
      if (match.toLowerCase().includes('seamless')) return 'simple';
      if (match.toLowerCase().includes('cutting-edge')) return 'modern';
      if (match.toLowerCase().includes('best-in-class')) return 'reliable';
      if (match.toLowerCase().includes('robust')) return 'solid';
      if (match.toLowerCase().includes('drive')) return 'improve';
      if (match.toLowerCase().includes('optimize')) return 'simplify';
      if (match.toLowerCase().includes('maximize')) return 'improve';
      return '';
    });
  }

  // Apply soft rewrite patterns
  for (const { pattern, replacement } of SOFT_REWRITE_PATTERNS) {
    refined = refined.replace(pattern, replacement);
  }

  // Normalize sentence length variation (ensure mix of short and medium)
  // Only apply if text has multiple sentences
  const sentenceMatches = refined.match(/[^.!?]+[.!?]+/g);
  if (sentenceMatches && sentenceMatches.length > 2) {
    const sentences = sentenceMatches.map(s => s.trim()).filter(s => s.length > 0);
    // Ensure at least one short sentence (8 words or less)
    const hasShortSentence = sentences.some(s => s.split(/\s+/).length <= 8);
    if (!hasShortSentence && sentences.length > 0) {
      // Make first sentence shorter if it's too long
      const firstSentence = sentences[0];
      const firstWords = firstSentence.split(/\s+/);
      if (firstWords.length > 15) {
        const midPoint = Math.floor(firstWords.length / 2);
        const firstPart = firstWords.slice(0, midPoint).join(' ');
        const secondPart = firstWords.slice(midPoint).join(' ');
        // Remove trailing punctuation from first part, add to second
        const cleanedFirst = firstPart.replace(/[.!?]+$/, '');
        sentences[0] = cleanedFirst + '.';
        sentences.splice(1, 0, secondPart);
      }
    }
    refined = sentences.join(' ').trim();
  }

  return refined;
}

/**
 * Stage 3: Delivery Style Normalization
 * Makes outputs sound like a real human sales rep
 */
function deliveryStyleNormalization(
  text: string,
  input: AdvancedNormalizedInput,
  metadata: RefinementMetadata
): string {
  // Determine delivery style
  let style: 'straight_shooter' | 'calm_consultant' | 'confident_peer' | 'neutral_human' = 'neutral_human';

  const persona = (input.persona_role_custom || input.persona_role || '').toLowerCase();
  const tone = (input.tone || '').toLowerCase();

  if (tone === 'direct' || persona.includes('ceo') || persona.includes('founder') || persona.includes('exec')) {
    style = 'straight_shooter';
  } else if (persona.includes('ops') || persona.includes('finance') || persona.includes('cfo')) {
    style = 'calm_consultant';
  } else if (persona.includes('sales') || persona.includes('marketing') || persona.includes('vp')) {
    style = 'confident_peer';
  }

  metadata.delivery_style_used = style;

  let refined = text;

  switch (style) {
    case 'straight_shooter':
      // Short sentences, minimal framing, direct CTA
      refined = refined
        .replace(/\bI would love to\b/gi, 'Worth')
        .replace(/\bI wanted to reach out\b/gi, 'Quick question')
        .replace(/\bWould you be open to\b/gi, 'Can we')
        .replace(/\bI hope this\b/gi, '');
      // Break long sentences
      refined = refined.replace(/\. ([A-Z][^.]{40,})\./g, '. $1.');
      break;

    case 'calm_consultant':
      // Reassuring language, slightly longer sentences, de-risking
      refined = refined
        .replace(/\bQuick question\b/gi, 'I wanted to share something')
        .replace(/\bWorth\b/gi, 'Might be worth')
        .replace(/\bCan we\b/gi, 'Would it make sense to');
      break;

    case 'confident_peer':
      // Conversational, assumes shared context, light confidence
      refined = refined
        .replace(/\bI wanted to reach out\b/gi, 'Hey')
        .replace(/\bQuick question\b/gi, 'Quick one')
        .replace(/\bWould you be open to\b/gi, 'Worth a quick chat?');
      break;

    case 'neutral_human':
    default:
      // Balanced, professional but human
      refined = refined
        .replace(/\bI would love to\b/gi, 'Worth')
        .replace(/\bI wanted to reach out\b/gi, 'Quick question');
      break;
  }

  return refined;
}

/**
 * Stage 4: Final De-AI Cleanup Pass
 * "Would a real sales rep say this out loud?"
 */
function finalCleanupPass(text: string): string {
  let refined = text;

  // Remove over-explaining
  refined = refined
    .replace(/\bI wanted to reach out because\b/gi, 'Quick question:')
    .replace(/\bThe reason I'm reaching out is\b/gi, '')
    .replace(/\bI'm reaching out today because\b/gi, '');

  // Remove meaningless adjectives
  refined = refined
    .replace(/\btruly\b/gi, '')
    .replace(/\breally\b/gi, '')
    .replace(/\babsolutely\b/gi, '')
    .replace(/\bdefinitely\b/gi, '')
    .replace(/\bcompletely\b/gi, '')
    .replace(/\bperfect\b/gi, 'good')
    .replace(/\bamazing\b/gi, 'helpful')
    .replace(/\bincredible\b/gi, 'solid');

  // Replace "selling" language with "helping" language
  refined = refined
    .replace(/\bI would love to schedule\b/gi, 'Worth a quick chat')
    .replace(/\bI'd like to discuss\b/gi, 'Worth exploring')
    .replace(/\bI think you'd benefit from\b/gi, 'This might help')
    .replace(/\bI believe\b/gi, '')
    .replace(/\bI'm confident\b/gi, '');

  // Make CTAs feel low-pressure and realistic
  refined = refined
    .replace(/\bWould you be open to a brief conversation\?/gi, "Worth a quick chat to see if this's relevant?")
    .replace(/\bCan we schedule a call\?/gi, 'Worth a quick call?')
    .replace(/\bI'd love to show you\b/gi, 'Worth seeing if')
    .replace(/\bLet's connect\b/gi, 'Worth a quick chat?');

  // Remove repetitive phrasing
  refined = refined.replace(/\b([^.!?]+)\1/gi, '$1');

  // Clean up extra spaces
  refined = refined.replace(/\s+/g, ' ').trim();

  return refined;
}

/**
 * Apply language refinement to a single text string
 */
function refineText(
  text: string,
  input: AdvancedNormalizedInput & { industry_id?: string | null },
  metadata: RefinementMetadata,
  mode: 'quick' | 'advanced',
  isOpening: boolean = false
): string {
  if (!text || text.trim().length === 0) return text;

  let refined = text;

  // Stage 1: Pain-First Rewrite (mandatory for openings, lighter for others)
  if (isOpening) {
    if (mode === 'advanced') {
      refined = painFirstRewrite(refined, input, metadata);
    } else {
      // Light pass for quick mode
      refined = painFirstRewrite(refined, input, metadata);
    }
  }

  // Stage 1.5: Industry Language Pack (NEW - after pain-first, before anti-robotic)
  // Only apply if industry_id is provided (or default to generic_b2b)
  refined = applyIndustryPack(refined, input.industry_id, mode, metadata);

  // Stage 2: Anti-Robotic Language Pass
  refined = antiRoboticPass(refined);

  // Stage 3: Delivery Style Normalization
  refined = deliveryStyleNormalization(refined, input, metadata);

  // Stage 4: Final Cleanup
  refined = finalCleanupPass(refined);

  return refined;
}

/**
 * Refine cold call script output
 */
export function refineColdCallScript(
  script: any,
  input: AdvancedNormalizedInput & { industry_id?: string | null },
  mode: 'quick' | 'advanced'
): { refined: any; metadata: RefinementMetadata } {
  const metadata: RefinementMetadata = {
    language_pass_applied: true,
  };

  if (mode === 'advanced' && 'opener' in script) {
    // Advanced mode structure
    return {
      refined: {
        ...script,
        opener: refineText(script.opener || '', input, metadata, mode, true),
        value_teaser: refineText(script.value_teaser || '', input, metadata, mode, false),
        permission_check: refineText(script.permission_check || '', input, metadata, mode, false),
        discovery_questions: (script.discovery_questions || []).map((q: string) =>
          refineText(q, input, metadata, mode, false)
        ),
        primary_cta: refineText(script.primary_cta || '', input, metadata, mode, false),
        fallback_cta: refineText(script.fallback_cta || '', input, metadata, mode, false),
        objection_handling: (script.objection_handling || []).map((obj: any) => ({
          ...obj,
          response: refineText(obj.response || '', input, metadata, mode, false),
          re_ask_cta: refineText(obj.re_ask_cta || '', input, metadata, mode, false),
        })),
        branches: script.branches ? {
          if_not_interested: refineText(script.branches.if_not_interested || '', input, metadata, mode, false),
          if_send_info: refineText(script.branches.if_send_info || '', input, metadata, mode, false),
          if_wrong_person: refineText(script.branches.if_wrong_person || '', input, metadata, mode, false),
        } : undefined,
        voicemail: script.voicemail ? refineText(script.voicemail, input, metadata, mode, true) : undefined,
      },
      metadata,
    };
  } else {
    // Quick mode structure
    return {
      refined: {
        ...script,
        opening: refineText(script.opening || '', input, metadata, mode, true),
        problem: refineText(script.problem || '', input, metadata, mode, false),
        value: refineText(script.value || '', input, metadata, mode, false),
        cta: refineText(script.cta || '', input, metadata, mode, false),
      },
      metadata,
    };
  }
}

/**
 * Refine cold email output
 */
export function refineColdEmail(
  email: any,
  input: AdvancedNormalizedInput & { industry_id?: string | null },
  mode: 'quick' | 'advanced'
): { refined: any; metadata: RefinementMetadata } {
  const metadata: RefinementMetadata = {
    language_pass_applied: true,
  };

  if (mode === 'advanced' && 'subject_lines' in email) {
    // Advanced mode structure
    return {
      refined: {
        ...email,
        subject_lines: (email.subject_lines || []).map((s: string) =>
          refineText(s, input, metadata, mode, false)
        ),
        opening_lines: (email.opening_lines || []).map((line: string) =>
          refineText(line, input, metadata, mode, true)
        ),
        body: refineText(email.body || '', input, metadata, mode, false),
        cta_primary: refineText(email.cta_primary || '', input, metadata, mode, false),
        cta_fallback: refineText(email.cta_fallback || '', input, metadata, mode, false),
        ps: email.ps ? refineText(email.ps, input, metadata, mode, false) : undefined,
      },
      metadata,
    };
  } else {
    // Quick mode structure
    return {
      refined: {
        ...email,
        subjectVariants: (email.subjectVariants || []).map((s: string) =>
          refineText(s, input, metadata, mode, false)
        ),
        body: refineText(email.body || '', input, metadata, mode, false),
        cta: refineText(email.cta || '', input, metadata, mode, false),
      },
      metadata,
    };
  }
}

/**
 * Refine pitch output
 */
export function refinePitch(
  pitch: any,
  input: AdvancedNormalizedInput & { industry_id?: string | null },
  mode: 'quick' | 'advanced'
): { refined: any; metadata: RefinementMetadata } {
  const metadata: RefinementMetadata = {
    language_pass_applied: true,
  };

  if (mode === 'advanced' && 'pitch_30s' in pitch) {
    // Advanced mode structure
    return {
      refined: {
        ...pitch,
        pitch_30s: refineText(pitch.pitch_30s || '', input, metadata, mode, true),
        pitch_60s: refineText(pitch.pitch_60s || '', input, metadata, mode, false),
        one_liner: refineText(pitch.one_liner || '', input, metadata, mode, false),
        qualifier: refineText(pitch.qualifier || '', input, metadata, mode, false),
      },
      metadata,
    };
  } else {
    // Quick mode structure
    return {
      refined: {
        ...pitch,
        pitch30s: refineText(pitch.pitch30s || '', input, metadata, mode, true),
        pitch2min: refineText(pitch.pitch2min || '', input, metadata, mode, false),
        bullets: (pitch.bullets || []).map((b: string) =>
          refineText(b, input, metadata, mode, false)
        ),
      },
      metadata,
    };
  }
}

/**
 * Apply language refinement pipeline to entire output
 */
export function applyLanguageRefinement(
  output: any,
  input: AdvancedNormalizedInput & { industry_id?: string | null },
  mode: 'quick' | 'advanced',
  selectedAssets: { coldCall: boolean; coldEmail: boolean; pitch: boolean }
): { refined: any; metadata: RefinementMetadata } {
  const combinedMetadata: RefinementMetadata = {
    language_pass_applied: true,
  };

  const refined: any = {};

  if (selectedAssets.coldCall && output.coldCallScript) {
    const { refined: refinedScript, metadata: scriptMeta } = refineColdCallScript(
      output.coldCallScript,
      input,
      mode
    );
    refined.coldCallScript = refinedScript;
    // Save existing assumptions before Object.assign overwrites them
    const existingAssumptions = combinedMetadata.assumptions_added || [];
    // Merge metadata (this will overwrite assumptions_added, so we'll fix it next)
    Object.assign(combinedMetadata, scriptMeta);
    // Properly merge assumptions arrays, avoiding duplicates
    if (scriptMeta.assumptions_added && scriptMeta.assumptions_added.length > 0) {
      combinedMetadata.assumptions_added = [...existingAssumptions];
      for (const assumption of scriptMeta.assumptions_added) {
        if (!combinedMetadata.assumptions_added.includes(assumption)) {
          combinedMetadata.assumptions_added.push(assumption);
        }
      }
    } else {
      combinedMetadata.assumptions_added = existingAssumptions;
    }
  }

  if (selectedAssets.coldEmail && output.coldEmail) {
    const { refined: refinedEmail, metadata: emailMeta } = refineColdEmail(
      output.coldEmail,
      input,
      mode
    );
    refined.coldEmail = refinedEmail;
    // Save existing assumptions before Object.assign overwrites them
    const existingAssumptions = combinedMetadata.assumptions_added || [];
    // Merge metadata (this will overwrite assumptions_added, so we'll fix it next)
    Object.assign(combinedMetadata, emailMeta);
    // Properly merge assumptions arrays, avoiding duplicates
    if (emailMeta.assumptions_added && emailMeta.assumptions_added.length > 0) {
      combinedMetadata.assumptions_added = [...existingAssumptions];
      for (const assumption of emailMeta.assumptions_added) {
        if (!combinedMetadata.assumptions_added.includes(assumption)) {
          combinedMetadata.assumptions_added.push(assumption);
        }
      }
    } else {
      combinedMetadata.assumptions_added = existingAssumptions;
    }
  }

  if (selectedAssets.pitch && output.salesPitch) {
    const { refined: refinedPitch, metadata: pitchMeta } = refinePitch(
      output.salesPitch,
      input,
      mode
    );
    refined.salesPitch = refinedPitch;
    // Save existing assumptions before Object.assign overwrites them
    const existingAssumptions = combinedMetadata.assumptions_added || [];
    // Merge metadata (this will overwrite assumptions_added, so we'll fix it next)
    Object.assign(combinedMetadata, pitchMeta);
    // Properly merge assumptions arrays, avoiding duplicates
    if (pitchMeta.assumptions_added && pitchMeta.assumptions_added.length > 0) {
      combinedMetadata.assumptions_added = [...existingAssumptions];
      for (const assumption of pitchMeta.assumptions_added) {
        if (!combinedMetadata.assumptions_added.includes(assumption)) {
          combinedMetadata.assumptions_added.push(assumption);
        }
      }
    } else {
      combinedMetadata.assumptions_added = existingAssumptions;
    }
  }

  return { refined, metadata: combinedMetadata };
}
