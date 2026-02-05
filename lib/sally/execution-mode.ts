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
 */

/**
 * Execution mode constant for Sally V1
 * 
 * This constant enforces the current execution model:
 * - Content generation within workspaces
 * - Content coaching and refinement
 * - Manual playbook execution guidance
 * 
 * Use this constant to:
 * - Gate agent behavior
 * - Prevent accidental feature expansion
 * - Make scope explicit in code reviews
 */
export const SALLY_EXECUTION_MODE = 'CONTENT_AND_GUIDED_EXECUTION_V1' as const;

/**
 * Validate that a requested feature is within Sally's scope
 */
export function validateSallyScope(feature: string): void {
  const excludedFeatures = [
    'lead_analysis',
    'icp_analysis',
    'lead_scoring',
    'lead_qualification',
    'crm_integration',
    'contact_enrichment',
    'automated_outreach',
    'automated_sending',
    'scheduling',
    'calendar_coordination',
    'analytics',
    'reporting',
    'kpis',
    'autonomous_agent',
    'cross_workspace_intelligence',
  ];

  if (excludedFeatures.includes(feature.toLowerCase())) {
    throw new Error(
      `Feature "${feature}" is not supported in Sally V1. ` +
      `Sally is limited to content generation, coaching, and manual playbook execution.`
    );
  }
}

/**
 * Check if a feature is explicitly excluded
 */
export function isExcludedFeature(feature: string): boolean {
  const excludedFeatures = [
    'lead_analysis',
    'icp_analysis',
    'lead_scoring',
    'lead_qualification',
    'crm_integration',
    'contact_enrichment',
    'automated_outreach',
    'automated_sending',
    'scheduling',
    'calendar_coordination',
    'analytics',
    'reporting',
    'kpis',
    'autonomous_agent',
    'cross_workspace_intelligence',
  ];

  return excludedFeatures.includes(feature.toLowerCase());
}
