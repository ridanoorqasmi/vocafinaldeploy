/**
 * Industry Language Packs Configuration
 * 
 * Industry Language Packs are rule-based language configurations that adjust
 * vocabulary, emphasis, and tone to make sales content sound native to specific industries.
 * 
 * These packs operate as deterministic text transformations - they do NOT:
 * - Add new content or sentences
 * - Change meaning or structure
 * - Introduce new claims or proof
 * - Override user inputs
 * 
 * They ONLY:
 * - Replace discouraged terms with preferred alternatives
 * - Adjust emphasis on problem framing
 * - Apply tone constraints
 */

export type IndustryId = 
  | 'generic_b2b'
  | 'saas'
  | 'fintech'
  | 'agency'
  | 'local_business'
  | 'enterprise';

export interface IndustryPack {
  industry_id: IndustryId;
  discouraged_terms: Array<{ pattern: RegExp; replacement: string }>;
  preferred_terms: Array<{ pattern: RegExp; replacement: string }>;
  emphasis_topics: string[];
  tone_constraints: {
    avoid_overly_casual?: boolean;
    avoid_jargon?: boolean;
    prefer_concrete?: boolean;
    prefer_metrics_language?: boolean;
  };
}

/**
 * Industry Language Pack Definitions
 */
export const INDUSTRY_PACKS: Record<IndustryId, IndustryPack> = {
  generic_b2b: {
    industry_id: 'generic_b2b',
    discouraged_terms: [
      // Generic B2B avoids overly technical jargon
      { pattern: /\bdisrupt\b/gi, replacement: 'improve' },
      { pattern: /\bparadigm shift\b/gi, replacement: 'change' },
    ],
    preferred_terms: [
      { pattern: /\bhelp\b/gi, replacement: 'help' }, // Keep as-is
      { pattern: /\bsolution\b/gi, replacement: 'solution' }, // Keep as-is
    ],
    emphasis_topics: ['efficiency', 'cost savings', 'scalability'],
    tone_constraints: {
      avoid_overly_casual: true,
      avoid_jargon: false,
      prefer_concrete: true,
      prefer_metrics_language: false,
    },
  },

  saas: {
    industry_id: 'saas',
    discouraged_terms: [
      // SaaS avoids enterprise-heavy language
      { pattern: /\benterprise-grade\b/gi, replacement: 'reliable' },
      { pattern: /\bmission-critical\b/gi, replacement: 'important' },
      { pattern: /\bscalable infrastructure\b/gi, replacement: 'handles growth' },
      { pattern: /\benterprise solution\b/gi, replacement: 'platform' },
    ],
    preferred_terms: [
      { pattern: /\bplatform\b/gi, replacement: 'platform' },
      { pattern: /\bautomation\b/gi, replacement: 'automation' },
      { pattern: /\bintegration\b/gi, replacement: 'integration' },
      { pattern: /\bworkflow\b/gi, replacement: 'workflow' },
    ],
    emphasis_topics: ['time savings', 'automation', 'integration', 'user experience'],
    tone_constraints: {
      avoid_overly_casual: false,
      avoid_jargon: false,
      prefer_concrete: true,
      prefer_metrics_language: true, // SaaS buyers expect metrics
    },
  },

  fintech: {
    industry_id: 'fintech',
    discouraged_terms: [
      // Fintech avoids casual language and unproven claims
      { pattern: /\bgame-changer\b/gi, replacement: 'improvement' },
      { pattern: /\brevolutionary\b/gi, replacement: 'new approach' },
      { pattern: /\bcutting-edge\b/gi, replacement: 'modern' },
      { pattern: /\bdisrupt\b/gi, replacement: 'improve' },
    ],
    preferred_terms: [
      { pattern: /\bcompliance\b/gi, replacement: 'compliance' },
      { pattern: /\bsecurity\b/gi, replacement: 'security' },
      { pattern: /\befficiency\b/gi, replacement: 'efficiency' },
      { pattern: /\baccuracy\b/gi, replacement: 'accuracy' },
      { pattern: /\brisk\b/gi, replacement: 'risk' },
    ],
    emphasis_topics: ['security', 'compliance', 'accuracy', 'risk reduction', 'regulatory'],
    tone_constraints: {
      avoid_overly_casual: true,
      avoid_jargon: true, // Fintech has strict compliance language
      prefer_concrete: true,
      prefer_metrics_language: true,
    },
  },

  agency: {
    industry_id: 'agency',
    discouraged_terms: [
      // Agencies avoid corporate-speak
      { pattern: /\benterprise\b/gi, replacement: 'business' },
      { pattern: /\bmission-critical\b/gi, replacement: 'important' },
      { pattern: /\bscalable infrastructure\b/gi, replacement: 'tools that grow with you' },
    ],
    preferred_terms: [
      { pattern: /\bclient\b/gi, replacement: 'client' },
      { pattern: /\bproject\b/gi, replacement: 'project' },
      { pattern: /\bdeliverable\b/gi, replacement: 'deliverable' },
      { pattern: /\bworkflow\b/gi, replacement: 'workflow' },
    ],
    emphasis_topics: ['client satisfaction', 'project delivery', 'team efficiency', 'profitability'],
    tone_constraints: {
      avoid_overly_casual: false,
      avoid_jargon: false,
      prefer_concrete: true,
      prefer_metrics_language: false,
    },
  },

  local_business: {
    industry_id: 'local_business',
    discouraged_terms: [
      // Local businesses avoid tech jargon
      { pattern: /\bplatform\b/gi, replacement: 'tool' },
      { pattern: /\benterprise\b/gi, replacement: 'business' },
      { pattern: /\bscalable\b/gi, replacement: 'grows with you' },
      { pattern: /\bintegration\b/gi, replacement: 'works with' },
      { pattern: /\bautomation\b/gi, replacement: 'saves time' },
    ],
    preferred_terms: [
      { pattern: /\btool\b/gi, replacement: 'tool' },
      { pattern: /\bsimple\b/gi, replacement: 'simple' },
      { pattern: /\beasy\b/gi, replacement: 'easy' },
      { pattern: /\baffordable\b/gi, replacement: 'affordable' },
    ],
    emphasis_topics: ['simplicity', 'cost', 'time savings', 'local customers'],
    tone_constraints: {
      avoid_overly_casual: false,
      avoid_jargon: true, // Local businesses prefer plain language
      prefer_concrete: true,
      prefer_metrics_language: false,
    },
  },

  enterprise: {
    industry_id: 'enterprise',
    discouraged_terms: [
      // Enterprise avoids casual language
      { pattern: /\bquick fix\b/gi, replacement: 'solution' },
      { pattern: /\beasy\b/gi, replacement: 'straightforward' },
      { pattern: /\bsimple\b/gi, replacement: 'streamlined' },
    ],
    preferred_terms: [
      { pattern: /\benterprise\b/gi, replacement: 'enterprise' },
      { pattern: /\bscalable\b/gi, replacement: 'scalable' },
      { pattern: /\bcompliance\b/gi, replacement: 'compliance' },
      { pattern: /\bgovernance\b/gi, replacement: 'governance' },
      { pattern: /\bsecurity\b/gi, replacement: 'security' },
    ],
    emphasis_topics: ['scalability', 'security', 'compliance', 'ROI', 'governance'],
    tone_constraints: {
      avoid_overly_casual: true,
      avoid_jargon: false,
      prefer_concrete: true,
      prefer_metrics_language: true,
    },
  },
};

/**
 * Get industry pack by ID, defaulting to generic_b2b
 */
export function getIndustryPack(industryId: string | null | undefined): IndustryPack {
  const id = (industryId || 'generic_b2b') as IndustryId;
  return INDUSTRY_PACKS[id] || INDUSTRY_PACKS.generic_b2b;
}

/**
 * Determine industry source (user-provided or default)
 */
export function getIndustrySource(industryId: string | null | undefined): 'user' | 'default' {
  return industryId ? 'user' : 'default';
}
