/**
 * Phase 2: Input Normalization and Assumptions Builder
 * 
 * Normalizes request inputs and builds assumptions_used and inputs_used lists
 */

import type { SalesStrategy } from './strategy-selector';
import type { AdvancedNormalizedInput } from './advanced-generator';

export interface NormalizedInputResult {
  normalized: AdvancedNormalizedInput;
  inputs_used: string[];
  assumptions_used: string[];
}

/**
 * Normalize request input to advanced generator format
 */
export function normalizeInput(
  requestInput: any,
  strategy: SalesStrategy
): NormalizedInputResult {
  const inputs_used: string[] = [];
  const assumptions_used: string[] = [];

  // Track which fields were provided
  if (requestInput.companyName) inputs_used.push('company_name');
  if (requestInput.productDesc) inputs_used.push('product_or_service');
  if (requestInput.oneLineValue) inputs_used.push('one_line_value');
  if (requestInput.goal) inputs_used.push('goal');
  if (requestInput.market) inputs_used.push('market');
  if (requestInput.tone) inputs_used.push('tone');
  if (requestInput.targetAudience) inputs_used.push('target_audience');
  if (requestInput.personaRole || requestInput.personaRoleCustom) inputs_used.push('persona_role');
  if (requestInput.primaryKPI || requestInput.primaryKPICustom) inputs_used.push('primary_kpi');
  if (requestInput.topPain) inputs_used.push('top_pain');
  if (requestInput.salesMotion) inputs_used.push('sales_motion');
  if (requestInput.primaryCTA) inputs_used.push('primary_cta');
  if (requestInput.fallbackCTA) inputs_used.push('fallback_cta');
  if (requestInput.buyingTrigger || requestInput.buyingTriggerNote) inputs_used.push('buying_trigger');
  if (requestInput.competitorAlternative) inputs_used.push('competitor_or_alternative');
  if (requestInput.differentiatorAngle) inputs_used.push('differentiator_angle');
  if (requestInput.proofTypes && requestInput.proofTypes.length > 0) inputs_used.push('proof_types');
  if (requestInput.proofSnippet) inputs_used.push('proof_snippet');
  if (requestInput.topObjections && requestInput.topObjections.length > 0) inputs_used.push('objections');
  if (requestInput.industry_id) inputs_used.push('industry_id');

  // Build assumptions for missing strategic fields
  if (!requestInput.competitorAlternative) {
    assumptions_used.push('Competitor: status quo/manual process');
  }

  if (!requestInput.topObjections || requestInput.topObjections.length === 0) {
    assumptions_used.push('Objections: "too busy" and "already using something"');
  }

  if (!requestInput.buyingTrigger && !requestInput.buyingTriggerNote) {
    assumptions_used.push('Buying trigger: efficiency/scale');
  }

  if (!requestInput.primaryKPI && !requestInput.primaryKPICustom) {
    assumptions_used.push('Primary KPI: generic category (speed, cost, risk reduction)');
  }

  // Check proof availability
  if (!requestInput.proofTypes || requestInput.proofTypes.length === 0) {
    assumptions_used.push('No proof provided; using soft claims only');
  } else if (!requestInput.proofSnippet) {
    assumptions_used.push('Proof types available but no specific snippet provided');
  }

  const normalized: AdvancedNormalizedInput = {
    company_name: requestInput.companyName || '',
    product_or_service: requestInput.productDesc || '',
    one_line_value: requestInput.oneLineValue || '',
    goal: requestInput.goal || '',
    market: requestInput.market || '',
    tone: requestInput.tone || '',
    target_audience: requestInput.targetAudience || '',
    persona_role: requestInput.personaRole,
    persona_role_custom: requestInput.personaRoleCustom,
    primary_kpi: requestInput.primaryKPI,
    primary_kpi_custom: requestInput.primaryKPICustom,
    top_pain: requestInput.topPain,
    sales_motion: requestInput.salesMotion,
    primary_cta: requestInput.primaryCTA,
    fallback_cta: requestInput.fallbackCTA,
    buying_trigger: requestInput.buyingTrigger,
    buying_trigger_note: requestInput.buyingTriggerNote,
    competitor_or_alternative: requestInput.competitorAlternative,
    differentiator_angle: requestInput.differentiatorAngle,
    proof_types: requestInput.proofTypes,
    proof_snippet: requestInput.proofSnippet,
    objections: requestInput.topObjections,
    objections_custom: requestInput.topObjectionsCustom,
    strategy,
    industry_id: requestInput.industry_id || null, // Add industry_id to normalized input
  };

  return {
    normalized,
    inputs_used,
    assumptions_used,
  };
}
