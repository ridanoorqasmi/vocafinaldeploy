-- Phase 4D: Growth & Retention Features
-- Database Schema for Freemium Funnel Optimization, Smart Upgrades, Referrals, Discounts, and Win-Back Campaigns

-- ==============================================
-- ONBOARDING PROGRESS TRACKING
-- ==============================================

-- Onboarding progress tracking for new free-tier tenants
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  current_step VARCHAR(50) NOT NULL,                    -- 'welcome', 'first_agent', 'first_call', 'integration', 'complete'
  completion_percentage INTEGER DEFAULT 0,              -- 0-100
  steps_completed JSONB DEFAULT '[]',                   -- Array of completed steps
  activation_events JSONB DEFAULT '{}',                 -- Tracked activation events
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id)
);

-- Onboarding step definitions and requirements
CREATE TABLE onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key VARCHAR(50) NOT NULL UNIQUE,
  step_name VARCHAR(100) NOT NULL,
  step_description TEXT,
  required_for_activation BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL,
  estimated_duration_minutes INTEGER DEFAULT 5,
  success_criteria JSONB DEFAULT '{}',                 -- Criteria for step completion
  nudge_config JSONB DEFAULT '{}',                     -- Nudge timing and content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Onboarding nudges and contextual prompts
CREATE TABLE onboarding_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  nudge_type VARCHAR(50) NOT NULL,                     -- 'tooltip', 'banner', 'email', 'in_app'
  nudge_content JSONB NOT NULL,                        -- Title, message, CTA
  target_step VARCHAR(50) NOT NULL,
  trigger_condition JSONB DEFAULT '{}',                -- When to show nudge
  shown_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  action_taken_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- SMART UPGRADE RECOMMENDATIONS
-- ==============================================

-- Upgrade recommendation rules and thresholds
CREATE TABLE upgrade_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(100) NOT NULL,
  rule_description TEXT,
  current_plan_filter JSONB NOT NULL,                  -- Which plans this applies to
  trigger_conditions JSONB NOT NULL,                   -- Usage patterns, limits, etc.
  recommended_plan_id VARCHAR(50) NOT NULL,
  recommendation_message TEXT NOT NULL,
  priority_score INTEGER DEFAULT 50,                    -- 0-100, higher = more important
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Smart upgrade recommendations for businesses
CREATE TABLE upgrade_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES upgrade_rules(id) ON DELETE CASCADE,
  current_plan_id VARCHAR(50) NOT NULL,
  recommended_plan_id VARCHAR(50) NOT NULL,
  recommendation_reason TEXT NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,          -- 0.00 to 1.00
  potential_revenue_increase_cents INTEGER DEFAULT 0,
  urgency_level VARCHAR(20) DEFAULT 'medium',          -- 'low', 'medium', 'high', 'critical'
  shown_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage pattern analysis for upgrade recommendations
CREATE TABLE usage_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  api_calls_count INTEGER DEFAULT 0,
  active_seats INTEGER DEFAULT 0,
  storage_used_mb INTEGER DEFAULT 0,
  billing_limit_utilization DECIMAL(5,2) DEFAULT 0.0, -- Percentage of plan limits used
  usage_trend VARCHAR(20) DEFAULT 'stable',            -- 'increasing', 'stable', 'declining'
  growth_rate DECIMAL(5,4) DEFAULT 0.0,               -- Month-over-month growth
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, analysis_date)
);

-- ==============================================
-- REFERRAL PROGRAM
-- ==============================================

-- Referral program configuration
CREATE TABLE referral_program (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  referral_credit_cents INTEGER NOT NULL,              -- Credit amount for referrer
  referred_credit_cents INTEGER DEFAULT 0,             -- Credit amount for referred user
  minimum_payment_required_cents INTEGER DEFAULT 0,    -- Minimum payment before credit
  credit_conditions JSONB DEFAULT '{}',                -- Additional conditions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral tracking
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referred_business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL,
  referral_link VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',                -- 'pending', 'completed', 'credited', 'expired'
  referral_credit_cents INTEGER DEFAULT 0,
  referred_credit_cents INTEGER DEFAULT 0,
  first_payment_date DATE,
  credit_issued_at TIMESTAMP WITH TIME ZONE,
  credit_conditions_met_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(referred_business_id)
);

-- Referral dashboard data
CREATE TABLE referral_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  total_credits_earned_cents INTEGER DEFAULT 0,
  pending_credits_cents INTEGER DEFAULT 0,
  last_referral_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id)
);

-- ==============================================
-- ANNUAL DISCOUNT INCENTIVES
-- ==============================================

-- Annual discount campaigns
CREATE TABLE annual_discount_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(100) NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL,           -- e.g., 15.00 for 15%
  discount_amount_cents INTEGER DEFAULT 0,             -- Fixed discount amount
  minimum_plan_price_cents INTEGER DEFAULT 0,          -- Minimum plan price to qualify
  maximum_discount_cents INTEGER DEFAULT 0,             -- Maximum discount cap
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  target_plans JSONB DEFAULT '[]',                     -- Which plans are eligible
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Annual subscription tracking
CREATE TABLE annual_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  original_plan_id VARCHAR(50) NOT NULL,
  annual_plan_id VARCHAR(50) NOT NULL,
  discount_campaign_id UUID REFERENCES annual_discount_campaigns(id),
  discount_applied_cents INTEGER DEFAULT 0,
  original_price_cents INTEGER NOT NULL,
  discounted_price_cents INTEGER NOT NULL,
  savings_cents INTEGER NOT NULL,
  subscription_start_date DATE NOT NULL,
  subscription_end_date DATE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Annual upgrade offers shown to users
CREATE TABLE annual_upgrade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES annual_discount_campaigns(id),
  current_plan_id VARCHAR(50) NOT NULL,
  offer_message TEXT NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL,
  savings_amount_cents INTEGER NOT NULL,
  shown_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- WIN-BACK CAMPAIGNS
-- ==============================================

-- Win-back campaign definitions
CREATE TABLE winback_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(100) NOT NULL,
  campaign_type VARCHAR(50) NOT NULL,                  -- 'email', 'dashboard', 'in_app'
  trigger_conditions JSONB NOT NULL,                   -- When to trigger campaign
  incentive_type VARCHAR(50) NOT NULL,                 -- 'discount', 'credit', 'free_months'
  incentive_value JSONB NOT NULL,                     -- Discount %, credit amount, etc.
  message_template TEXT NOT NULL,
  cta_text VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Churn detection and tracking
CREATE TABLE churn_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  churn_date DATE NOT NULL,
  churn_reason VARCHAR(100),                           -- 'cancelled', 'payment_failed', 'inactive'
  last_payment_date DATE,
  days_since_last_payment INTEGER,
  total_revenue_lost_cents INTEGER DEFAULT 0,
  winback_campaign_id UUID REFERENCES winback_campaigns(id),
  winback_attempted_at TIMESTAMP WITH TIME ZONE,
  winback_successful_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Win-back campaign interactions
CREATE TABLE winback_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES winback_campaigns(id),
  interaction_type VARCHAR(50) NOT NULL,               -- 'email_sent', 'dashboard_shown', 'cta_clicked'
  interaction_data JSONB DEFAULT '{}',
  incentive_offered JSONB NOT NULL,
  user_response VARCHAR(50),                           -- 'accepted', 'dismissed', 'ignored'
  response_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- FEATURE FLAGS & CONFIGURATION
-- ==============================================

-- Feature flags for gradual rollout
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(100) NOT NULL UNIQUE,
  flag_description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0,                -- 0-100
  target_plans JSONB DEFAULT '[]',                     -- Which plans see this feature
  target_businesses JSONB DEFAULT '[]',                -- Specific business targeting
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign configuration and settings
CREATE TABLE campaign_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  setting_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- PERFORMANCE INDEXES
-- ==============================================

-- Onboarding progress indexes
CREATE INDEX idx_onboarding_progress_business_id ON onboarding_progress(business_id);
CREATE INDEX idx_onboarding_progress_step ON onboarding_progress(current_step);
CREATE INDEX idx_onboarding_progress_created_at ON onboarding_progress(created_at);

-- Upgrade recommendations indexes
CREATE INDEX idx_upgrade_recommendations_business_id ON upgrade_recommendations(business_id);
CREATE INDEX idx_upgrade_recommendations_urgency ON upgrade_recommendations(urgency_level);
CREATE INDEX idx_upgrade_recommendations_created_at ON upgrade_recommendations(created_at);

-- Usage analysis indexes
CREATE INDEX idx_usage_analysis_business_id ON usage_analysis(business_id);
CREATE INDEX idx_usage_analysis_date ON usage_analysis(analysis_date);
CREATE INDEX idx_usage_analysis_trend ON usage_analysis(usage_trend);

-- Referral indexes
CREATE INDEX idx_referrals_referrer ON referrals(referrer_business_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_business_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_code ON referrals(referral_code);

-- Annual discount indexes
CREATE INDEX idx_annual_subscriptions_business_id ON annual_subscriptions(business_id);
CREATE INDEX idx_annual_subscriptions_campaign ON annual_subscriptions(discount_campaign_id);
CREATE INDEX idx_annual_upgrade_offers_business_id ON annual_upgrade_offers(business_id);

-- Win-back indexes
CREATE INDEX idx_churn_events_business_id ON churn_events(business_id);
CREATE INDEX idx_churn_events_date ON churn_events(churn_date);
CREATE INDEX idx_winback_interactions_business_id ON winback_interactions(business_id);
CREATE INDEX idx_winback_interactions_campaign ON winback_interactions(campaign_id);

-- ==============================================
-- ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS for all growth & retention tables
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE upgrade_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_upgrade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE winback_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for business isolation
CREATE POLICY "onboarding_progress_business_isolation" ON onboarding_progress
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "onboarding_nudges_business_isolation" ON onboarding_nudges
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "upgrade_recommendations_business_isolation" ON upgrade_recommendations
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "usage_analysis_business_isolation" ON usage_analysis
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "referrals_business_isolation" ON referrals
  USING (referrer_business_id = current_setting('app.current_business_id')::UUID OR 
         referred_business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "referral_stats_business_isolation" ON referral_stats
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "annual_subscriptions_business_isolation" ON annual_subscriptions
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "annual_upgrade_offers_business_isolation" ON annual_upgrade_offers
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "churn_events_business_isolation" ON churn_events
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "winback_interactions_business_isolation" ON winback_interactions
  USING (business_id = current_setting('app.current_business_id')::UUID);

-- ==============================================
-- ANALYTICS FUNCTIONS
-- ==============================================

-- Function to calculate onboarding completion rate
CREATE OR REPLACE FUNCTION calculate_onboarding_completion_rate()
RETURNS TABLE (
  total_signups INTEGER,
  completed_onboarding INTEGER,
  completion_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_signups,
    COUNT(CASE WHEN op.completed_at IS NOT NULL THEN 1 END)::INTEGER as completed_onboarding,
    ROUND(
      COUNT(CASE WHEN op.completed_at IS NOT NULL THEN 1 END)::DECIMAL / 
      NULLIF(COUNT(*), 0) * 100, 2
    ) as completion_rate
  FROM businesses b
  LEFT JOIN onboarding_progress op ON b.id = op.business_id
  WHERE b.created_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate referral program performance
CREATE OR REPLACE FUNCTION calculate_referral_performance()
RETURNS TABLE (
  total_referrals INTEGER,
  successful_referrals INTEGER,
  conversion_rate DECIMAL(5,2),
  total_credits_issued_cents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_referrals,
    COUNT(CASE WHEN r.status = 'credited' THEN 1 END)::INTEGER as successful_referrals,
    ROUND(
      COUNT(CASE WHEN r.status = 'credited' THEN 1 END)::DECIMAL / 
      NULLIF(COUNT(*), 0) * 100, 2
    ) as conversion_rate,
    COALESCE(SUM(CASE WHEN r.status = 'credited' THEN r.referral_credit_cents ELSE 0 END), 0)::INTEGER as total_credits_issued_cents
  FROM referrals r
  WHERE r.created_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to identify churn risk customers
CREATE OR REPLACE FUNCTION identify_churn_risk_customers()
RETURNS TABLE (
  business_id UUID,
  churn_risk_score INTEGER,
  risk_factors JSONB,
  recommended_actions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as business_id,
    CASE 
      WHEN s.status = 'past_due' THEN 90
      WHEN s.status = 'canceled' THEN 100
      WHEN ua.billing_limit_utilization > 0.9 THEN 80
      WHEN ua.usage_trend = 'declining' THEN 70
      WHEN ua.growth_rate < -0.1 THEN 60
      ELSE 30
    END as churn_risk_score,
    jsonb_build_object(
      'subscription_status', s.status,
      'billing_utilization', ua.billing_limit_utilization,
      'usage_trend', ua.usage_trend,
      'growth_rate', ua.growth_rate
    ) as risk_factors,
    jsonb_build_object(
      'immediate_actions', CASE 
        WHEN s.status = 'past_due' THEN '["contact_support", "update_payment_method"]'
        WHEN ua.billing_limit_utilization > 0.9 THEN '["upgrade_plan", "optimize_usage"]'
        ELSE '["engagement_campaign", "feature_training"]'
      END,
      'priority', CASE 
        WHEN s.status = 'past_due' THEN 'critical'
        WHEN ua.billing_limit_utilization > 0.9 THEN 'high'
        ELSE 'medium'
      END
    ) as recommended_actions
  FROM businesses b
  LEFT JOIN subscriptions s ON b.id = s.business_id
  LEFT JOIN usage_analysis ua ON b.id = ua.business_id
  WHERE s.status IN ('active', 'past_due', 'canceled')
    AND ua.analysis_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- INITIAL DATA SEEDING
-- ==============================================

-- Insert default onboarding steps
INSERT INTO onboarding_steps (step_key, step_name, step_description, required_for_activation, order_index, estimated_duration_minutes, success_criteria, nudge_config) VALUES
('welcome', 'Welcome to VOCA', 'Complete your account setup and explore the dashboard', true, 1, 2, '{"login_count": 1}', '{"delay_hours": 0, "type": "tooltip"}'),
('first_agent', 'Create Your First Agent', 'Set up your first AI agent to handle customer queries', true, 2, 10, '{"agent_created": true}', '{"delay_hours": 1, "type": "banner"}'),
('first_call', 'Make Your First Call', 'Test your agent with a real customer interaction', true, 3, 5, '{"call_completed": true}', '{"delay_hours": 24, "type": "email"}'),
('integration', 'Connect Integrations', 'Connect your business systems and data sources', false, 4, 15, '{"integration_connected": true}', '{"delay_hours": 72, "type": "in_app"}'),
('optimization', 'Optimize Performance', 'Review analytics and optimize your agent performance', false, 5, 10, '{"analytics_viewed": true}', '{"delay_hours": 168, "type": "dashboard"}');

-- Insert default upgrade rules
INSERT INTO upgrade_rules (rule_name, rule_description, current_plan_filter, trigger_conditions, recommended_plan_id, recommendation_message, priority_score) VALUES
('high_usage_upgrade', 'High API Usage Detected', '{"plans": ["free", "starter"]}', '{"api_calls": {"min": 1000}, "utilization": {"min": 0.8}}', 'pro', 'You are using 80%+ of your API calls. Upgrade to Pro for unlimited usage and advanced features.', 90),
('team_growth_upgrade', 'Team Size Growth', '{"plans": ["starter"]}', '{"active_seats": {"min": 3}, "growth_rate": {"min": 0.2}}', 'team', 'Your team is growing! Upgrade to Team plan for more seats and collaboration features.', 80),
('storage_limit_upgrade', 'Storage Limit Reached', '{"plans": ["free", "starter"]}', '{"storage_used": {"min": 0.9}}', 'pro', 'You are approaching your storage limit. Upgrade to Pro for 10x more storage.', 85),
('feature_usage_upgrade', 'Advanced Features Needed', '{"plans": ["free"]}', '{"feature_requests": {"min": 3}}', 'starter', 'You are requesting advanced features. Upgrade to Starter to unlock them.', 70);

-- Insert default referral program
INSERT INTO referral_program (program_name, is_active, referral_credit_cents, referred_credit_cents, minimum_payment_required_cents, credit_conditions) VALUES
('Default Referral Program', true, 1000, 500, 2000, '{"first_payment_required": true, "minimum_subscription_duration_days": 30}');

-- Insert default annual discount campaign
INSERT INTO annual_discount_campaigns (campaign_name, discount_percentage, minimum_plan_price_cents, start_date, end_date, is_active, target_plans) VALUES
('Holiday Annual Discount', 15.00, 2000, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', true, '["starter", "pro", "team"]');

-- Insert default win-back campaign
INSERT INTO winback_campaigns (campaign_name, campaign_type, trigger_conditions, incentive_type, incentive_value, message_template, cta_text) VALUES
('Churn Recovery Campaign', 'email', '{"days_since_churn": {"min": 7, "max": 30}}', 'discount', '{"percentage": 20, "duration_months": 3}', 'We miss you! Come back with 20% off for 3 months.', 'Restore My Account');

-- Insert default feature flags
INSERT INTO feature_flags (flag_name, flag_description, is_enabled, rollout_percentage) VALUES
('onboarding_optimization', 'Enhanced onboarding flow with progress tracking', true, 100),
('smart_upgrades', 'AI-powered upgrade recommendations', true, 100),
('referral_program', 'Customer referral program with credits', true, 100),
('annual_discounts', 'Annual subscription discounts', true, 100),
('winback_campaigns', 'Automated win-back campaigns for churned customers', true, 100);

-- Insert default campaign settings
INSERT INTO campaign_settings (setting_key, setting_value, setting_description) VALUES
('onboarding_nudge_delay_hours', '24', 'Hours to wait before showing onboarding nudges'),
('upgrade_recommendation_threshold', '0.8', 'Usage threshold for showing upgrade recommendations'),
('referral_credit_amount_cents', '1000', 'Default referral credit amount in cents'),
('annual_discount_percentage', '15.0', 'Default annual discount percentage'),
('winback_campaign_delay_days', '7', 'Days to wait before starting win-back campaigns');
