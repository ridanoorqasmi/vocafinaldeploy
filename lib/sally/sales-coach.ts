/**
 * Sales Coach Mode - Post-Generation Guidance Layer
 * 
 * ⚠️ READ-ONLY ANALYSIS ONLY
 * ⚠️ Does not modify or regenerate content
 * ⚠️ Interprets final generated content to provide usage guidance
 * 
 * This module analyzes generated sales content and provides practical,
 * actionable guidance on how to use it effectively.
 */

import type { AdvancedNormalizedInput } from './advanced-generator';

export interface SalesCoachOutput {
  coldCall?: ColdCallCoaching;
  coldEmail?: ColdEmailCoaching;
  pitch?: PitchCoaching;
}

export interface ColdCallCoaching {
  howToStart: string[];
  whyThisWorks: string[];
  whatToExpectNext: string[];
  howToRespond: string[];
  whatNotToDo: string[];
}

export interface ColdEmailCoaching {
  howToUseThisEmail: string[];
  whatMattersMost: string[];
  ifTheyDontReply: string[];
  whatToAvoid: string[];
}

export interface PitchCoaching {
  howToDeliver: string[];
  whatToEmphasize: string[];
  whereToPause: string[];
  nextStep: string[];
}

interface CoachingContext {
  generatedContent: any;
  input: AdvancedNormalizedInput & { industry_id?: string | null };
  generationMeta: {
    pain_source?: 'user' | 'inferred';
    delivery_style_used?: string;
    mode: 'quick' | 'advanced';
  };
  selectedAssets: {
    coldCall: boolean;
    coldEmail: boolean;
    pitch: boolean;
  };
}

/**
 * Generate coaching guidance for all selected assets
 */
export function generateSalesCoaching(context: CoachingContext): SalesCoachOutput {
  const output: SalesCoachOutput = {};

  if (context.selectedAssets.coldCall && context.generatedContent.coldCallScript) {
    output.coldCall = coachColdCall(
      context.generatedContent.coldCallScript,
      context.input,
      context.generationMeta
    );
  }

  if (context.selectedAssets.coldEmail && context.generatedContent.coldEmail) {
    output.coldEmail = coachColdEmail(
      context.generatedContent.coldEmail,
      context.input,
      context.generationMeta
    );
  }

  if (context.selectedAssets.pitch && context.generatedContent.salesPitch) {
    output.pitch = coachPitch(
      context.generatedContent.salesPitch,
      context.input,
      context.generationMeta
    );
  }

  return output;
}

/**
 * Generate coaching for cold call script
 */
function coachColdCall(
  script: any,
  input: AdvancedNormalizedInput & { industry_id?: string | null },
  meta: { pain_source?: 'user' | 'inferred'; delivery_style_used?: string; mode: 'quick' | 'advanced' }
): ColdCallCoaching {
  const isAdvanced = meta.mode === 'advanced' && 'opener' in script;
  
  // How to Start
  const howToStart: string[] = [];
  if (isAdvanced && script.opener) {
    howToStart.push(`Start with: "${script.opener.substring(0, 100)}${script.opener.length > 100 ? '...' : ''}"`);
    howToStart.push('Pause immediately after the opener and wait for their response.');
  } else if (script.opening) {
    howToStart.push(`Start with: "${script.opening.substring(0, 100)}${script.opening.length > 100 ? '...' : ''}"`);
    howToStart.push('Pause after the opening line and listen for their reaction.');
  }

  // Why This Works
  const whyThisWorks: string[] = [];
  if (input.top_pain && meta.pain_source === 'user') {
    whyThisWorks.push(`This opener directly addresses their pain: ${input.top_pain.substring(0, 80)}${input.top_pain.length > 80 ? '...' : ''}`);
  } else if (input.persona_role || input.persona_role_custom) {
    const persona = input.persona_role_custom || input.persona_role || 'decision maker';
    whyThisWorks.push(`The language matches how ${persona.replace('_', ' ')}s typically communicate.`);
  } else {
    whyThisWorks.push('The opener is designed to interrupt their current thinking and create curiosity.');
  }

  // What to Expect Next
  const whatToExpectNext: string[] = [];
  if (isAdvanced && script.objection_handling && script.objection_handling.length > 0) {
    const firstObjection = script.objection_handling[0];
    whatToExpectNext.push(`Most likely response: "${firstObjection.objection_label}"`);
  } else {
    whatToExpectNext.push('Common responses: "I\'m busy" or "Not interested right now"');
  }

  // How to Respond
  const howToRespond: string[] = [];
  if (isAdvanced && script.objection_handling && script.objection_handling.length > 0) {
    const objection = script.objection_handling[0];
    howToRespond.push(`If they say "${objection.objection_label}", use the objection response provided.`);
    if (script.fallback_cta) {
      howToRespond.push(`If they're still hesitant, move to the fallback CTA: "${script.fallback_cta.substring(0, 60)}${script.fallback_cta.length > 60 ? '...' : ''}"`);
    }
  } else if (script.cta) {
    howToRespond.push(`If they show interest, use the CTA: "${script.cta.substring(0, 60)}${script.cta.length > 60 ? '...' : ''}"`);
  }

  // What Not to Do
  const whatNotToDo: string[] = [];
  if (isAdvanced && script.value_teaser) {
    whatNotToDo.push('Don\'t explain the full product or service yet. Save that for after they show interest.');
  } else if (script.problem && script.value) {
    whatNotToDo.push('Don\'t jump to the solution before they acknowledge the problem.');
  } else {
    whatNotToDo.push('Don\'t rush through the script. Let them respond naturally.');
  }

  return {
    howToStart,
    whyThisWorks,
    whatToExpectNext,
    howToRespond,
    whatNotToDo,
  };
}

/**
 * Generate coaching for cold email
 */
function coachColdEmail(
  email: any,
  input: AdvancedNormalizedInput & { industry_id?: string | null },
  meta: { pain_source?: 'user' | 'inferred'; delivery_style_used?: string; mode: 'quick' | 'advanced' }
): ColdEmailCoaching {
  const isAdvanced = meta.mode === 'advanced' && 'subject_lines' in email;

  // How to Use This Email
  const howToUseThisEmail: string[] = [];
  if (input.sales_motion) {
    const motion = input.sales_motion.replace('_', ' ');
    howToUseThisEmail.push(`Best for: ${motion} outreach`);
  } else {
    howToUseThisEmail.push('Use for: Cold outbound to new prospects');
  }
  if (isAdvanced && email.opening_lines && email.opening_lines.length > 0) {
    howToUseThisEmail.push('Personalize the opening line based on what you know about the prospect.');
  }

  // What Matters Most
  const whatMattersMost: string[] = [];
  if (isAdvanced && email.subject_lines && email.subject_lines.length > 0) {
    whatMattersMost.push(`Subject line is critical. Use: "${email.subject_lines[0].substring(0, 60)}${email.subject_lines[0].length > 60 ? '...' : ''}"`);
  } else if (email.subjectVariants && email.subjectVariants.length > 0) {
    whatMattersMost.push(`Subject line is critical. Use: "${email.subjectVariants[0].substring(0, 60)}${email.subjectVariants[0].length > 60 ? '...' : ''}"`);
  }
  if (isAdvanced && email.opening_lines && email.opening_lines.length > 0) {
    whatMattersMost.push(`The first sentence sets the tone. Start with: "${email.opening_lines[0].substring(0, 80)}${email.opening_lines[0].length > 80 ? '...' : ''}"`);
  } else if (email.body) {
    const firstSentence = email.body.split('.')[0];
    whatMattersMost.push(`The first sentence sets the tone. It starts: "${firstSentence.substring(0, 80)}${firstSentence.length > 80 ? '...' : ''}"`);
  }

  // If They Don't Reply
  const ifTheyDontReply: string[] = [];
  if (input.sales_motion === 'reengagement') {
    ifTheyDontReply.push('For re-engagement, wait 3-5 days before following up with a different angle.');
  } else {
    ifTheyDontReply.push('If no reply after 5-7 days, send a brief follow-up with a different value angle.');
  }
  if (isAdvanced && email.cta_fallback) {
    ifTheyDontReply.push('In the follow-up, try the fallback CTA instead of the primary one.');
  }

  // What to Avoid
  const whatToAvoid: string[] = [];
  if (email.body && email.body.length > 200) {
    whatToAvoid.push('Don\'t make the email longer. Keep it concise and scannable.');
  } else {
    whatToAvoid.push('Don\'t add lengthy explanations or product details. The current length is optimal.');
  }
  if (isAdvanced && email.ps) {
    whatToAvoid.push('The P.S. is already included. Don\'t add another one.');
  }

  return {
    howToUseThisEmail,
    whatMattersMost,
    ifTheyDontReply,
    whatToAvoid,
  };
}

/**
 * Generate coaching for pitch
 */
function coachPitch(
  pitch: any,
  input: AdvancedNormalizedInput & { industry_id?: string | null },
  meta: { pain_source?: 'user' | 'inferred'; delivery_style_used?: string; mode: 'quick' | 'advanced' }
): PitchCoaching {
  const isAdvanced = meta.mode === 'advanced' && 'pitch_30s' in pitch;

  // How to Deliver
  const howToDeliver: string[] = [];
  if (isAdvanced && pitch.pitch_30s && pitch.pitch_60s) {
    howToDeliver.push('Use the 30-second pitch when you have limited time or in a quick introduction.');
    howToDeliver.push('Use the 60-second pitch when you have their full attention or in a scheduled meeting.');
  } else if (pitch.pitch30s && pitch.pitch2min) {
    howToDeliver.push('Use the 30-second pitch for quick introductions or elevator conversations.');
    howToDeliver.push('Use the 2-minute pitch when you have more time to explain the value.');
  }

  // What to Emphasize
  const whatToEmphasize: string[] = [];
  if (input.top_pain && meta.pain_source === 'user') {
    whatToEmphasize.push(`Emphasize how you address: ${input.top_pain.substring(0, 70)}${input.top_pain.length > 70 ? '...' : ''}`);
  } else if (input.one_line_value) {
    whatToEmphasize.push(`The core value is: ${input.one_line_value.substring(0, 70)}${input.one_line_value.length > 70 ? '...' : ''}`);
  }
  if (input.primary_kpi || input.primary_kpi_custom) {
    const kpi = input.primary_kpi_custom || input.primary_kpi?.replace('_', ' ') || 'results';
    whatToEmphasize.push(`Connect the pitch to their primary KPI: ${kpi}`);
  }

  // Where to Pause
  const whereToPause: string[] = [];
  if (isAdvanced && pitch.pitch_30s) {
    const sentences = pitch.pitch_30s.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
    if (sentences.length >= 2) {
      whereToPause.push(`After the second sentence, pause and ask: "${pitch.qualifier || 'Does this sound relevant?'}"`);
    } else {
      whereToPause.push('After stating the main value, pause and check if this is relevant to them.');
    }
  } else if (pitch.pitch30s) {
    const sentences = pitch.pitch30s.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
    if (sentences.length >= 2) {
      whereToPause.push('After the second sentence, pause and ask if this is relevant to their situation.');
    } else {
      whereToPause.push('After stating the main value, pause and check for their reaction.');
    }
  }

  // Next Step
  const nextStep: string[] = [];
  if (isAdvanced && pitch.qualifier) {
    nextStep.push(`After they respond to the qualifier, use: "${pitch.qualifier.substring(0, 60)}${pitch.qualifier.length > 60 ? '...' : ''}"`);
  }
  if (input.primary_cta) {
    const cta = input.primary_cta.replace('_', ' ');
    nextStep.push(`Primary next step: ${cta}`);
    if (input.fallback_cta) {
      const fallback = input.fallback_cta.replace('_', ' ');
      nextStep.push(`If they're not ready, offer: ${fallback}`);
    }
  } else if (pitch.bullets && pitch.bullets.length > 0) {
    nextStep.push('After the pitch, ask if they\'d like to learn more about how this applies to their situation.');
  }

  return {
    howToDeliver,
    whatToEmphasize,
    whereToPause,
    nextStep,
  };
}
