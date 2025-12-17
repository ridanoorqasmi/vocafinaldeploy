// ===== BUSINESS RULES ENGINE TYPES =====

export type BusinessRuleCategory = 
  | 'response_behavior'
  | 'content_restrictions' 
  | 'business_logic'
  | 'quality_controls';

export type ResponseBehaviorType = 
  | 'tone'
  | 'length'
  | 'personality'
  | 'language_style';

export type ContentRestrictionType =
  | 'topics_to_avoid'
  | 'required_disclaimers'
  | 'escalation_triggers'
  | 'response_boundaries';

export type BusinessLogicType =
  | 'operating_hours_behavior'
  | 'inventory_handling'
  | 'appointment_scheduling'
  | 'price_disclosure';

export type QualityControlType =
  | 'response_validation'
  | 'hallucination_tolerance'
  | 'confidence_threshold'
  | 'fallback_behavior';

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  case_sensitive?: boolean;
}

export interface RuleAction {
  type: 'set_response_style' | 'add_disclaimer' | 'escalate' | 'modify_content' | 'apply_template' | 'block_response';
  parameters: Record<string, any>;
  priority?: number;
}

export interface BusinessRuleConfig {
  rule_id: string;
  business_id: string;
  category: BusinessRuleCategory;
  rule_type: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number; // 1-100, higher = more important
  active: boolean;
  created_at: Date;
  updated_at: Date;
  version: number;
  created_by?: string;
  tags?: string[];
}

export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: RuleConflict[];
}

export interface RuleConflict {
  conflicting_rule_id: string;
  conflict_type: 'condition_overlap' | 'action_contradiction' | 'priority_conflict';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RuleTestResult {
  test_case: string;
  input: any;
  expected_output: any;
  actual_output: any;
  passed: boolean;
  execution_time_ms: number;
}

export interface BusinessRuleContext {
  business_id: string;
  query_text: string;
  intent: string;
  customer_context?: {
    is_returning: boolean;
    preferences?: Record<string, any>;
    history?: any[];
  };
  conversation_context?: {
    session_id: string;
    turn_count: number;
    previous_topics: string[];
  };
  business_context?: {
    current_hours: string;
    inventory_status?: Record<string, any>;
    promotions?: any[];
  };
}

export interface RuleEvaluationResult {
  applicable_rules: BusinessRuleConfig[];
  applied_actions: RuleAction[];
  modified_context: any;
  execution_time_ms: number;
  conflicts_resolved: number;
}

// Template System Types
export type TemplateCategory = 
  | 'greeting_templates'
  | 'information_templates'
  | 'escalation_templates'
  | 'fallback_templates';

export interface ResponseTemplate {
  template_id: string;
  business_id: string;
  name: string;
  category: TemplateCategory;
  content: string; // Template with variable placeholders
  conditions: TemplateCondition[];
  variables: TemplateVariable[];
  fallback_template_id?: string;
  active: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
  usage_count: number;
  success_rate: number;
}

export interface TemplateCondition {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than';
  value: any;
  case_sensitive?: boolean;
}

export interface TemplateVariable {
  name: string;
  type: 'business_var' | 'temporal_var' | 'customer_var' | 'context_var' | 'dynamic_var';
  required: boolean;
  default_value?: any;
  validation_regex?: string;
}

export interface TemplateTestScenario {
  scenario_name: string;
  input_context: Record<string, any>;
  expected_output: string;
  variables: Record<string, any>;
}

export interface TemplateTestResult {
  scenario_name: string;
  passed: boolean;
  actual_output: string;
  execution_time_ms: number;
  variable_errors: string[];
}

// Batch Processing Types
export type BatchJobType = 
  | 'bulk_queries'
  | 'content_analysis'
  | 'conversation_export'
  | 'knowledge_base_update'
  | 'performance_testing';

export interface BatchJob {
  job_id: string;
  business_id: string;
  job_type: BatchJobType;
  input_data: BatchInput[];
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total_items: number;
    processed_items: number;
    failed_items: number;
    estimated_completion: Date;
  };
  results: BatchResult[];
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  error_details?: string;
  processing_options: BatchProcessingOptions;
  created_by?: string;
}

export interface BatchInput {
  input_id: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface BatchResult {
  input_id: string;
  success: boolean;
  result?: any;
  error?: string;
  processing_time_ms: number;
  tokens_used?: number;
  cost?: number;
}

export interface BatchProcessingOptions {
  parallel_processing: boolean;
  priority: 'low' | 'normal' | 'high';
  timeout_ms: number;
  callback_url?: string;
  max_concurrent_workers?: number;
  retry_failed_items?: boolean;
  max_retries?: number;
}

export interface BatchJobSummary {
  total_tokens_used: number;
  total_cost: number;
  average_response_time: number;
  success_rate: number;
  total_processing_time_ms: number;
  cost_per_query: number;
}

// Cache System Types
export interface CacheStrategy {
  cache_levels: {
    exact_match: boolean;
    semantic_similarity: boolean;
    template_based: boolean;
    business_specific: boolean;
  };
  invalidation_rules: {
    business_updates: boolean;
    time_sensitive: boolean;
    usage_patterns: boolean;
    quality_feedback: boolean;
  };
  ttl_seconds: number;
  max_size_mb: number;
}

export interface CacheEntry {
  key: string;
  value: any;
  created_at: Date;
  expires_at: Date;
  access_count: number;
  last_accessed: Date;
  business_id: string;
  cache_level: 'exact_match' | 'semantic_similarity' | 'template_based' | 'business_specific';
  metadata: Record<string, any>;
}

// Quality Monitoring Types
export interface ResponseQualityMetrics {
  response_id: string;
  business_id: string;
  quality_score: number; // 0-1
  factors: {
    relevance: number;
    accuracy: number;
    completeness: number;
    tone_appropriateness: number;
    response_time: number;
  };
  customer_feedback?: {
    rating: number;
    feedback_text?: string;
    timestamp: Date;
  };
  ai_confidence: number;
  human_review_required: boolean;
  created_at: Date;
}

export interface ConversationAnalytics {
  session_id: string;
  business_id: string;
  conversation_metrics: {
    total_turns: number;
    average_response_time: number;
    customer_satisfaction_score: number;
    escalation_count: number;
    topic_changes: number;
    completion_rate: number;
  };
  insights: {
    common_topics: string[];
    frequent_escalations: string[];
    peak_usage_times: string[];
    customer_preferences: Record<string, any>;
  };
  created_at: Date;
}
