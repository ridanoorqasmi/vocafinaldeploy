/**
 * Phase 0: Sales Agent "Sally" - Foundational Types
 * 
 * ⚠️ PHASE 0 ONLY - NO BUSINESS LOGIC
 * ⚠️ Types are explicit, typed, and extendable for future phases
 * ⚠️ No opinionated or restrictive constraints yet
 * 
 * These types define the foundational contracts for Sally's input/output
 * and configuration. They will be extended in future phases.
 */

/**
 * Input structure for Sally's sales generation process
 * Phase 0: Placeholder structure - will be populated in Phase 1+
 */
export interface SallyInput {
  /** Target audience description or profile */
  audience?: AudienceProfile;
  
  /** Product or service being sold */
  product?: string;
  
  /** Desired tone for the sales content */
  tone?: Tone;
  
  /** Primary sales goal */
  goal?: Goal;
  
  /** Target market or industry */
  market?: Market;
  
  /** Additional context or requirements */
  context?: string;
  
  /** Custom parameters (extensible for future phases) */
  customParams?: Record<string, unknown>;
}

/**
 * Output structure from Sally's sales generation
 * Phase 0: Placeholder structure - will be populated in Phase 1+
 */
export interface SallyOutput {
  /** Generated sales content (type TBD in Phase 1+) */
  content?: unknown;
  
  /** Metadata about the generation process */
  metadata?: {
    /** Timestamp of generation */
    generatedAt?: string;
    
    /** Version or iteration identifier */
    version?: string;
    
    /** Additional metadata (extensible) */
    [key: string]: unknown;
  };
  
  /** Status of the generation */
  status?: 'pending' | 'completed' | 'error';
  
  /** Error information if status is 'error' */
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Tone options for sales content
 * Phase 0: Basic enumeration - will be extended in Phase 1+
 */
export type Tone =
  | 'professional'
  | 'friendly'
  | 'casual'
  | 'formal'
  | 'persuasive'
  | 'informative'
  | 'urgent'
  | 'empathetic'
  | 'custom';

/**
 * Sales goal types
 * Phase 0: Basic enumeration - will be extended in Phase 1+
 */
export type Goal =
  | 'lead_generation'
  | 'conversion'
  | 'upsell'
  | 'retention'
  | 'awareness'
  | 'engagement'
  | 'custom';

/**
 * Market or industry categories
 * Phase 0: Basic enumeration - will be extended in Phase 1+
 */
export type Market =
  | 'b2b'
  | 'b2c'
  | 'saas'
  | 'ecommerce'
  | 'healthcare'
  | 'finance'
  | 'education'
  | 'real_estate'
  | 'technology'
  | 'retail'
  | 'custom';

/**
 * Audience profile structure
 * Phase 0: Basic structure - will be extended in Phase 1+
 */
export interface AudienceProfile {
  /** Demographic information */
  demographics?: {
    ageRange?: string;
    gender?: string;
    location?: string;
    income?: string;
    [key: string]: unknown;
  };
  
  /** Psychographic information */
  psychographics?: {
    interests?: string[];
    values?: string[];
    lifestyle?: string;
    [key: string]: unknown;
  };
  
  /** Behavioral information */
  behavior?: {
    buyingPatterns?: string;
    painPoints?: string[];
    goals?: string[];
    [key: string]: unknown;
  };
  
  /** Custom audience attributes */
  customAttributes?: Record<string, unknown>;
}

/**
 * Tenant context for Sally operations
 * Reuses existing tenant resolution patterns
 */
export interface SallyTenantContext {
  /** Tenant/business identifier */
  tenantId: string;
  
  /** Business name (if available) */
  businessName?: string;
  
  /** User identifier (if authenticated) */
  userId?: string;
  
  /** Authentication type used */
  authType?: 'jwt' | 'api_key' | 'session';
}

