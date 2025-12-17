-- Phase 4B: Advanced Plan Management & Usage Enforcement
-- Database Schema for Comprehensive Plan Architecture and Usage Tracking

-- ==============================================
-- PLAN ARCHITECTURE SYSTEM
-- ==============================================

-- Master plan definitions table
CREATE TABLE plan_definitions (
  id VARCHAR(50) PRIMARY KEY,                    -- 'free', 'starter', 'pro', 'business', 'enterprise'
  name VARCHAR(100) NOT NULL,                    -- 'Professional Plan'
  description TEXT,
  price_cents INTEGER NOT NULL,                   -- Monthly price in cents
  currency VARCHAR(3) DEFAULT 'usd',
  billing_interval VARCHAR(20) DEFAULT 'month',   -- 'month' or 'year'
  trial_days INTEGER DEFAULT 0,
  stripe_price_id VARCHAR(255),                  -- Stripe price object ID
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plan features and limits configuration
CREATE TABLE plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id VARCHAR(50) NOT NULL REFERENCES plan_definitions(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,             -- 'queries_per_month', 'locations_max', 'analytics_advanced'
  feature_type VARCHAR(20) NOT NULL,             -- 'limit', 'boolean', 'enum'
  limit_value INTEGER,                           -- For numeric limits
  boolean_value BOOLEAN,                         -- For yes/no features  
  enum_value VARCHAR(100),                       -- For categorical features
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(plan_id, feature_key)
);

-- Usage quotas and tracking per business
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL REFERENCES plan_definitions(id),
  quota_type VARCHAR(50) NOT NULL,               -- 'queries', 'embeddings', 'api_calls'
  quota_limit INTEGER NOT NULL,                 -- Monthly limit
  quota_used INTEGER DEFAULT 0,                 -- Current usage
  quota_overage INTEGER DEFAULT 0,               -- Usage beyond limit
  reset_date DATE NOT NULL,                      -- When quota resets
  last_reset_date DATE,
  overage_rate_cents INTEGER DEFAULT 0,          -- Cost per overage unit in cents
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, quota_type)
);

-- Real-time usage tracking events
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,               -- 'query', 'embedding', 'api_call'
  quantity INTEGER DEFAULT 1,
  tokens_consumed INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage alerts and notifications
CREATE TABLE usage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,               -- 'approaching_limit', 'limit_exceeded', 'overage_charges'
  quota_type VARCHAR(50) NOT NULL,
  threshold_percentage INTEGER,                  -- 75, 90, 100
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  notification_sent BOOLEAN DEFAULT FALSE
);

-- ==============================================
-- PLAN CHANGE MANAGEMENT
-- ==============================================

-- Plan change requests and history
CREATE TABLE plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  from_plan_id VARCHAR(50) REFERENCES plan_definitions(id),
  to_plan_id VARCHAR(50) NOT NULL REFERENCES plan_definitions(id),
  change_type VARCHAR(20) NOT NULL,               -- 'upgrade', 'downgrade', 'sidegrade'
  change_timing VARCHAR(20) NOT NULL,            -- 'immediate', 'end_of_period'
  status VARCHAR(20) DEFAULT 'pending',         -- 'pending', 'approved', 'rejected', 'completed'
  proration_credit INTEGER DEFAULT 0,           -- Credit for unused time
  proration_charge INTEGER DEFAULT 0,           -- Charge for new plan
  net_charge INTEGER DEFAULT 0,                 -- Net amount to charge
  effective_date TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency usage pools for critical operations
CREATE TABLE emergency_usage_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pool_type VARCHAR(50) NOT NULL,                -- 'queries', 'api_calls'
  total_allocated INTEGER NOT NULL,              -- Total emergency quota
  used_amount INTEGER DEFAULT 0,                -- Amount used from pool
  cost_per_unit INTEGER NOT NULL,               -- Cost per unit in cents
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  justification TEXT,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- FEATURE FLAG SYSTEM
-- ==============================================

-- Feature access control per plan
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id VARCHAR(50) NOT NULL REFERENCES plan_definitions(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,            -- 'advanced_analytics', 'api_access'
  feature_category VARCHAR(50) NOT NULL,        -- 'query_features', 'integration_features'
  is_enabled BOOLEAN DEFAULT false,
  access_level VARCHAR(20) DEFAULT 'restricted', -- 'full', 'limited', 'restricted'
  usage_limit INTEGER,                          -- Optional usage limit for feature
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(plan_id, feature_key)
);

-- Business-specific feature overrides
CREATE TABLE business_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- USAGE ANALYTICS & REPORTING
-- ==============================================

-- Daily usage rollups for performance
CREATE TABLE usage_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quota_type VARCHAR(50) NOT NULL,
  usage_date DATE NOT NULL,
  total_usage INTEGER NOT NULL,
  unique_users INTEGER DEFAULT 0,
  peak_hourly_usage INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, quota_type, usage_date)
);

-- Usage forecasting data
CREATE TABLE usage_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quota_type VARCHAR(50) NOT NULL,
  forecast_date DATE NOT NULL,
  predicted_usage INTEGER NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,     -- 0.00 to 1.00
  model_version VARCHAR(20) DEFAULT 'v1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- BILLING INTEGRATION
-- ==============================================

-- Overage charges and billing
CREATE TABLE overage_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quota_type VARCHAR(50) NOT NULL,
  overage_amount INTEGER NOT NULL,               -- Amount over limit
  rate_per_unit INTEGER NOT NULL,               -- Rate per overage unit in cents
  total_charge_cents INTEGER NOT NULL,          -- Total overage charge
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  stripe_invoice_item_id VARCHAR(255),          -- Stripe invoice item ID
  status VARCHAR(20) DEFAULT 'pending',        -- 'pending', 'billed', 'paid'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plan recommendation engine data
CREATE TABLE plan_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  current_plan_id VARCHAR(50) NOT NULL REFERENCES plan_definitions(id),
  recommended_plan_id VARCHAR(50) NOT NULL REFERENCES plan_definitions(id),
  confidence_score DECIMAL(3,2) NOT NULL,        -- 0.00 to 1.00
  savings_potential INTEGER,                   -- Potential savings in cents
  upgrade_cost INTEGER,                         -- Cost to upgrade in cents
  reasoning JSONB NOT NULL,                     -- AI reasoning for recommendation
  is_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Plan definitions indexes
CREATE INDEX idx_plan_definitions_active ON plan_definitions(is_active);
CREATE INDEX idx_plan_definitions_display_order ON plan_definitions(display_order);

-- Plan features indexes
CREATE INDEX idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX idx_plan_features_feature_key ON plan_features(feature_key);

-- Usage quotas indexes
CREATE INDEX idx_usage_quotas_business_id ON usage_quotas(business_id);
CREATE INDEX idx_usage_quotas_plan_id ON usage_quotas(plan_id);
CREATE INDEX idx_usage_quotas_quota_type ON usage_quotas(quota_type);
CREATE INDEX idx_usage_quotas_reset_date ON usage_quotas(reset_date);

-- Usage events indexes
CREATE INDEX idx_usage_events_business_id ON usage_events(business_id);
CREATE INDEX idx_usage_events_event_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_business_created ON usage_events(business_id, created_at);

-- Usage alerts indexes
CREATE INDEX idx_usage_alerts_business_id ON usage_alerts(business_id);
CREATE INDEX idx_usage_alerts_alert_type ON usage_alerts(alert_type);
CREATE INDEX idx_usage_alerts_triggered_at ON usage_alerts(triggered_at);

-- Plan changes indexes
CREATE INDEX idx_plan_changes_business_id ON plan_changes(business_id);
CREATE INDEX idx_plan_changes_status ON plan_changes(status);
CREATE INDEX idx_plan_changes_effective_date ON plan_changes(effective_date);

-- Emergency usage pools indexes
CREATE INDEX idx_emergency_pools_business_id ON emergency_usage_pools(business_id);
CREATE INDEX idx_emergency_pools_expires_at ON emergency_usage_pools(expires_at);

-- Feature flags indexes
CREATE INDEX idx_feature_flags_plan_id ON feature_flags(plan_id);
CREATE INDEX idx_feature_flags_feature_key ON feature_flags(feature_key);
CREATE INDEX idx_feature_flags_category ON feature_flags(feature_category);

-- Business feature overrides indexes
CREATE INDEX idx_business_overrides_business_id ON business_feature_overrides(business_id);
CREATE INDEX idx_business_overrides_feature_key ON business_feature_overrides(feature_key);
CREATE INDEX idx_business_overrides_expires_at ON business_feature_overrides(expires_at);

-- Usage rollups indexes
CREATE INDEX idx_usage_rollups_business_id ON usage_rollups(business_id);
CREATE INDEX idx_usage_rollups_usage_date ON usage_rollups(usage_date);
CREATE INDEX idx_usage_rollups_quota_type ON usage_rollups(quota_type);

-- Usage forecasts indexes
CREATE INDEX idx_usage_forecasts_business_id ON usage_forecasts(business_id);
CREATE INDEX idx_usage_forecasts_forecast_date ON usage_forecasts(forecast_date);

-- Overage charges indexes
CREATE INDEX idx_overage_charges_business_id ON overage_charges(business_id);
CREATE INDEX idx_overage_charges_billing_period ON overage_charges(billing_period_start, billing_period_end);
CREATE INDEX idx_overage_charges_status ON overage_charges(status);

-- Plan recommendations indexes
CREATE INDEX idx_plan_recommendations_business_id ON plan_recommendations(business_id);
CREATE INDEX idx_plan_recommendations_current_plan ON plan_recommendations(current_plan_id);
CREATE INDEX idx_plan_recommendations_recommended_plan ON plan_recommendations(recommended_plan_id);

-- ==============================================
-- ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS for all new tables
ALTER TABLE plan_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_usage_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE overage_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies for business isolation
CREATE POLICY "plan_definitions_public_read" ON plan_definitions FOR SELECT USING (true);
CREATE POLICY "plan_features_public_read" ON plan_features FOR SELECT USING (true);
CREATE POLICY "feature_flags_public_read" ON feature_flags FOR SELECT USING (true);

CREATE POLICY "usage_quotas_business_isolation" ON usage_quotas
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "usage_events_business_isolation" ON usage_events
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "usage_alerts_business_isolation" ON usage_alerts
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "plan_changes_business_isolation" ON plan_changes
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "emergency_pools_business_isolation" ON emergency_usage_pools
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "business_overrides_business_isolation" ON business_feature_overrides
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "usage_rollups_business_isolation" ON usage_rollups
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "usage_forecasts_business_isolation" ON usage_forecasts
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "overage_charges_business_isolation" ON overage_charges
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "plan_recommendations_business_isolation" ON plan_recommendations
  USING (business_id = current_setting('app.current_business_id')::UUID);

-- ==============================================
-- UPDATE TRIGGERS
-- ==============================================

-- Update triggers for updated_at columns
CREATE TRIGGER update_plan_definitions_updated_at BEFORE UPDATE ON plan_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_quotas_updated_at BEFORE UPDATE ON usage_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_changes_updated_at BEFORE UPDATE ON plan_changes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emergency_pools_updated_at BEFORE UPDATE ON emergency_usage_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_overrides_updated_at BEFORE UPDATE ON business_feature_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- INITIAL DATA SEEDING
-- ==============================================

-- Insert default plan definitions
INSERT INTO plan_definitions (id, name, description, price_cents, currency, billing_interval, trial_days, display_order) VALUES
('free', 'Free Plan', 'Perfect for small businesses getting started', 0, 'usd', 'month', 14, 1),
('starter', 'Starter Plan', 'Ideal for growing businesses', 2900, 'usd', 'month', 14, 2),
('pro', 'Professional Plan', 'Advanced features for established businesses', 9900, 'usd', 'month', 14, 3),
('business', 'Business Plan', 'Comprehensive solution for large businesses', 29900, 'usd', 'month', 14, 4),
('enterprise', 'Enterprise Plan', 'Custom solutions for enterprise needs', 0, 'usd', 'month', 0, 5);

-- Insert plan features for each tier
INSERT INTO plan_features (plan_id, feature_key, feature_type, limit_value, boolean_value, enum_value) VALUES
-- Free Plan Features
('free', 'queries_per_month', 'limit', 100, NULL, NULL),
('free', 'locations_max', 'limit', 1, NULL, NULL),
('free', 'conversations_stored_days', 'limit', 7, NULL, NULL),
('free', 'api_calls_per_day', 'limit', 50, NULL, NULL),
('free', 'team_members_max', 'limit', 1, NULL, NULL),
('free', 'custom_templates', 'limit', 0, NULL, NULL),
('free', 'integrations_max', 'limit', 0, NULL, NULL),
('free', 'advanced_analytics', 'boolean', NULL, false, NULL),
('free', 'api_access', 'boolean', NULL, false, NULL),
('free', 'priority_support', 'boolean', NULL, false, NULL),

-- Starter Plan Features
('starter', 'queries_per_month', 'limit', 2000, NULL, NULL),
('starter', 'locations_max', 'limit', 1, NULL, NULL),
('starter', 'conversations_stored_days', 'limit', 30, NULL, NULL),
('starter', 'api_calls_per_day', 'limit', 500, NULL, NULL),
('starter', 'team_members_max', 'limit', 3, NULL, NULL),
('starter', 'custom_templates', 'limit', 5, NULL, NULL),
('starter', 'integrations_max', 'limit', 2, NULL, NULL),
('starter', 'advanced_analytics', 'boolean', NULL, true, NULL),
('starter', 'api_access', 'boolean', NULL, false, NULL),
('starter', 'priority_support', 'boolean', NULL, false, NULL),

-- Pro Plan Features
('pro', 'queries_per_month', 'limit', 10000, NULL, NULL),
('pro', 'locations_max', 'limit', 5, NULL, NULL),
('pro', 'conversations_stored_days', 'limit', 90, NULL, NULL),
('pro', 'api_calls_per_day', 'limit', 2000, NULL, NULL),
('pro', 'team_members_max', 'limit', 10, NULL, NULL),
('pro', 'custom_templates', 'limit', 25, NULL, NULL),
('pro', 'integrations_max', 'limit', 10, NULL, NULL),
('pro', 'advanced_analytics', 'boolean', NULL, true, NULL),
('pro', 'api_access', 'boolean', NULL, true, NULL),
('pro', 'priority_support', 'boolean', NULL, true, NULL),

-- Business Plan Features
('business', 'queries_per_month', 'limit', 50000, NULL, NULL),
('business', 'locations_max', 'limit', 25, NULL, NULL),
('business', 'conversations_stored_days', 'limit', 365, NULL, NULL),
('business', 'api_calls_per_day', 'limit', 10000, NULL, NULL),
('business', 'team_members_max', 'limit', 50, NULL, NULL),
('business', 'custom_templates', 'limit', 100, NULL, NULL),
('business', 'integrations_max', 'limit', 50, NULL, NULL),
('business', 'advanced_analytics', 'boolean', NULL, true, NULL),
('business', 'api_access', 'boolean', NULL, true, NULL),
('business', 'priority_support', 'boolean', NULL, true, NULL),
('business', 'white_label_branding', 'boolean', NULL, true, NULL),

-- Enterprise Plan Features (unlimited)
('enterprise', 'queries_per_month', 'limit', -1, NULL, NULL),
('enterprise', 'locations_max', 'limit', -1, NULL, NULL),
('enterprise', 'conversations_stored_days', 'limit', -1, NULL, NULL),
('enterprise', 'api_calls_per_day', 'limit', -1, NULL, NULL),
('enterprise', 'team_members_max', 'limit', -1, NULL, NULL),
('enterprise', 'custom_templates', 'limit', -1, NULL, NULL),
('enterprise', 'integrations_max', 'limit', -1, NULL, NULL),
('enterprise', 'advanced_analytics', 'boolean', NULL, true, NULL),
('enterprise', 'api_access', 'boolean', NULL, true, NULL),
('enterprise', 'priority_support', 'boolean', NULL, true, NULL),
('enterprise', 'white_label_branding', 'boolean', NULL, true, NULL),
('enterprise', 'dedicated_manager', 'boolean', NULL, true, NULL),
('enterprise', 'sla_guarantees', 'boolean', NULL, true, NULL);

-- Insert feature flags for each plan
INSERT INTO feature_flags (plan_id, feature_key, feature_category, is_enabled, access_level) VALUES
-- Free Plan Feature Flags
('free', 'basic_queries', 'query_features', true, 'limited'),
('free', 'email_support', 'support_features', true, 'limited'),
('free', 'basic_dashboard', 'analytics_features', true, 'limited'),

-- Starter Plan Feature Flags
('starter', 'basic_queries', 'query_features', true, 'full'),
('starter', 'conversation_history', 'query_features', true, 'full'),
('starter', 'email_support', 'support_features', true, 'full'),
('starter', 'basic_dashboard', 'analytics_features', true, 'full'),

-- Pro Plan Feature Flags
('pro', 'basic_queries', 'query_features', true, 'full'),
('pro', 'conversation_history', 'query_features', true, 'full'),
('pro', 'advanced_analytics', 'query_features', true, 'full'),
('pro', 'api_access', 'integration_features', true, 'full'),
('pro', 'phone_support', 'support_features', true, 'full'),
('pro', 'advanced_reports', 'analytics_features', true, 'full'),

-- Business Plan Feature Flags
('business', 'basic_queries', 'query_features', true, 'full'),
('business', 'conversation_history', 'query_features', true, 'full'),
('business', 'advanced_analytics', 'query_features', true, 'full'),
('business', 'batch_processing', 'query_features', true, 'full'),
('business', 'api_access', 'integration_features', true, 'full'),
('business', 'webhook_support', 'integration_features', true, 'full'),
('business', 'crm_integrations', 'integration_features', true, 'full'),
('business', 'phone_support', 'support_features', true, 'full'),
('business', 'priority_support', 'support_features', true, 'full'),
('business', 'advanced_reports', 'analytics_features', true, 'full'),
('business', 'custom_reports', 'analytics_features', true, 'full'),
('business', 'data_export', 'analytics_features', true, 'full'),
('business', 'white_label_branding', 'integration_features', true, 'full'),

-- Enterprise Plan Feature Flags
('enterprise', 'basic_queries', 'query_features', true, 'full'),
('enterprise', 'conversation_history', 'query_features', true, 'full'),
('enterprise', 'advanced_analytics', 'query_features', true, 'full'),
('enterprise', 'batch_processing', 'query_features', true, 'full'),
('enterprise', 'custom_ai_training', 'query_features', true, 'full'),
('enterprise', 'api_access', 'integration_features', true, 'full'),
('enterprise', 'webhook_support', 'integration_features', true, 'full'),
('enterprise', 'crm_integrations', 'integration_features', true, 'full'),
('enterprise', 'white_label_branding', 'integration_features', true, 'full'),
('enterprise', 'custom_domains', 'integration_features', true, 'full'),
('enterprise', 'phone_support', 'support_features', true, 'full'),
('enterprise', 'priority_support', 'support_features', true, 'full'),
('enterprise', 'dedicated_manager', 'support_features', true, 'full'),
('enterprise', 'sla_guarantees', 'support_features', true, 'full'),
('enterprise', 'advanced_reports', 'analytics_features', true, 'full'),
('enterprise', 'custom_reports', 'analytics_features', true, 'full'),
('enterprise', 'data_export', 'analytics_features', true, 'full'),
('enterprise', 'api_analytics', 'analytics_features', true, 'full');
