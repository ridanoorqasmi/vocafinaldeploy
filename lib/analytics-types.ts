// lib/analytics-types.ts
export interface DailyConversationMetrics {
  id: string;
  business_id: string;
  date: Date;
  total_conversations: number;
  total_queries: number;
  avg_conversation_length: number;
  avg_response_time_ms: number;
  satisfaction_score: number;
  resolution_rate: number;
  escalation_rate: number;
  unique_customers: number;
  created_at: Date;
  updated_at: Date;
}

export interface HourlyPerformanceMetrics {
  id: string;
  business_id: string;
  hour_timestamp: Date;
  query_count: number;
  avg_response_time_ms: number;
  error_rate: number;
  cache_hit_rate: number;
  token_usage: number;
  estimated_cost: number;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationTopics {
  id: string;
  business_id: string;
  date: Date;
  topic_category: string;
  intent_type: string;
  frequency: number;
  avg_satisfaction: number;
  resolution_success_rate: number;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerPatterns {
  id: string;
  business_id: string;
  customer_identifier: string;
  first_interaction: Date;
  last_interaction: Date;
  total_conversations: number;
  avg_session_length: number;
  preferred_topics: string[];
  satisfaction_trend: number;
  created_at: Date;
  updated_at: Date;
}

export interface SystemHealthMetrics {
  id: string;
  metric_name: string;
  metric_value: number;
  timestamp: Date;
  severity_level: 'low' | 'medium' | 'high' | 'critical';
  service_component: string;
  alert_threshold: number;
  current_status: 'healthy' | 'warning' | 'critical';
  created_at: Date;
  updated_at: Date;
}

export interface UsageQuotas {
  id: string;
  business_id: string;
  quota_type: 'monthly_queries' | 'monthly_tokens' | 'monthly_cost' | 'concurrent_sessions';
  quota_limit: number;
  current_usage: number;
  reset_period: Date;
  overage_allowed: boolean;
  alert_thresholds: {
    warning: number;
    critical: number;
  };
  created_at: Date;
  updated_at: Date;
}

export interface AlertDefinition {
  id: string;
  business_id: string;
  metric_type: string;
  condition: string;
  threshold: number;
  notification_channels: string[];
  escalation_rules: {
    time_based: number;
    frequency_based: number;
    severity_based: string;
  };
  active_status: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AlertHistory {
  id: string;
  alert_id: string;
  triggered_at: Date;
  resolved_at?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  notification_sent: boolean;
  resolution_action?: string;
  acknowledged_by?: string;
  created_at: Date;
  updated_at: Date;
}

// Analytics Processing Types
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface ConversationFlow {
  step: number;
  action: string;
  frequency: number;
  success_rate: number;
  avg_time_spent: number;
}

export interface TopicSatisfaction {
  topic: string;
  satisfaction_score: number;
  conversation_count: number;
  trend_direction: 'up' | 'down' | 'stable';
}

export interface CostBreakdown {
  feature: string;
  cost: number;
  percentage: number;
  token_usage: number;
}

export interface TemplateMetrics {
  template_id: string;
  usage_count: number;
  success_rate: number;
  avg_satisfaction: number;
  cost_efficiency: number;
}

export interface RuleImpactAnalysis {
  rule_id: string;
  impact_score: number;
  conversations_affected: number;
  satisfaction_change: number;
  cost_impact: number;
}

// Dashboard Widget Types
export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'gauge' | 'alert';
  title: string;
  data: any;
  config: Record<string, any>;
  refresh_interval: number;
  last_updated: Date;
}

export interface DashboardConfig {
  id: string;
  user_id: string;
  business_id?: string;
  dashboard_type: 'tenant' | 'admin';
  layout: DashboardWidget[];
  created_at: Date;
  updated_at: Date;
}

// Report Types
export interface ReportConfig {
  report_type: 'conversation_summary' | 'performance_analysis' | 'cost_optimization' | 'custom';
  date_range: {
    start_date: Date;
    end_date: Date;
  };
  metrics_included: string[];
  grouping_dimensions: string[];
  comparison_periods?: Array<{
    start_date: Date;
    end_date: Date;
  }>;
  export_format: 'json' | 'csv' | 'pdf' | 'excel';
  filters?: Record<string, any>;
}

export interface GeneratedReport {
  id: string;
  business_id: string;
  report_config: ReportConfig;
  status: 'generating' | 'completed' | 'failed';
  download_url?: string;
  expires_at: Date;
  file_size_mb?: number;
  created_at: Date;
  completed_at?: Date;
}

// Analytics Context Types
export interface AnalyticsContext {
  business_id: string;
  date_range: {
    start_date: Date;
    end_date: Date;
  };
  filters?: {
    topic_categories?: string[];
    customer_segments?: string[];
    conversation_outcomes?: string[];
  };
  metrics: string[];
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface BusinessIntelligenceInsight {
  insight_type: 'trend' | 'anomaly' | 'opportunity' | 'warning';
  title: string;
  description: string;
  impact_score: number;
  confidence_level: number;
  recommended_action?: string;
  data_points: any[];
  created_at: Date;
}
