-- Phase 4D-2: Monetization Enhancements
-- Database Schema for Usage-Based Billing, Add-Ons, Custom Plans, Flexible Invoicing, and Billing Insights

-- ==============================================
-- USAGE-BASED BILLING
-- ==============================================

-- Usage events tracking for metered billing
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,                    -- 'api_call', 'voice_minute', 'storage_mb', 'ai_query'
  quantity DECIMAL(10,4) NOT NULL,                    -- Usage quantity (calls, minutes, MB, etc.)
  unit_price_cents INTEGER NOT NULL,                  -- Price per unit in cents
  total_cost_cents INTEGER NOT NULL,                  -- Total cost for this event
  metadata JSONB DEFAULT '{}',                        -- Additional event data
  stripe_usage_record_id VARCHAR(255),               -- Stripe usage record ID
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage aggregation by billing cycle
CREATE TABLE usage_aggregation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  total_quantity DECIMAL(10,4) NOT NULL,
  total_cost_cents INTEGER NOT NULL,
  stripe_subscription_item_id VARCHAR(255),          -- Stripe subscription item ID
  synced_to_stripe_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, billing_period_start, billing_period_end, event_type)
);

-- Usage quotas and limits per plan
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  quota_limit DECIMAL(10,4) NOT NULL,                -- Monthly quota limit
  overage_price_cents INTEGER NOT NULL,              -- Price per unit over quota
  included_quantity DECIMAL(10,4) DEFAULT 0,         -- Included quantity in base price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(plan_id, event_type)
);

-- ==============================================
-- ADD-ONS & UPSELLS
-- ==============================================

-- Add-on definitions
CREATE TABLE add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  billing_period VARCHAR(20) NOT NULL,               -- 'monthly', 'yearly', 'one_time'
  event_type VARCHAR(50),                            -- Associated usage type
  quantity_included DECIMAL(10,4),                   -- Quantity included in add-on
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',                       -- Additional add-on configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business add-on subscriptions
CREATE TABLE business_add_ons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  add_on_id UUID NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
  stripe_subscription_item_id VARCHAR(255),          -- Stripe subscription item ID
  status VARCHAR(20) DEFAULT 'active',               -- 'active', 'cancelled', 'paused'
  quantity INTEGER DEFAULT 1,                        -- Number of add-on units
  price_cents INTEGER NOT NULL,                      -- Price at time of purchase
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, add_on_id)
);

-- Upsell campaigns and CTAs
CREATE TABLE upsell_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  trigger_conditions JSONB NOT NULL,                 -- When to show upsell
  target_add_on_id UUID REFERENCES add_ons(id),
  cta_text VARCHAR(100) NOT NULL,
  cta_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Upsell campaign interactions
CREATE TABLE upsell_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES upsell_campaigns(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL,             -- 'shown', 'clicked', 'purchased', 'dismissed'
  interaction_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- CUSTOM PLANS (ENTERPRISE)
-- ==============================================

-- Custom plans for enterprise customers
CREATE TABLE custom_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_name VARCHAR(100) NOT NULL,
  base_price_cents INTEGER NOT NULL,
  billing_period VARCHAR(20) NOT NULL,               -- 'monthly', 'yearly'
  limits JSONB NOT NULL,                             -- Usage limits and quotas
  discounts JSONB DEFAULT '{}',                     -- Discount configuration
  features JSONB DEFAULT '{}',                       -- Custom features
  status VARCHAR(20) DEFAULT 'active',              -- 'active', 'inactive', 'expired'
  stripe_price_id VARCHAR(255),                      -- Stripe price ID
  created_by UUID REFERENCES users(id),             -- Admin who created the plan
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id)
);

-- Custom plan usage tracking
CREATE TABLE custom_plan_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_plan_id UUID NOT NULL REFERENCES custom_plans(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  current_usage DECIMAL(10,4) DEFAULT 0,
  usage_limit DECIMAL(10,4) NOT NULL,
  overage_charges_cents INTEGER DEFAULT 0,
  last_reset_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- FLEXIBLE INVOICING
-- ==============================================

-- Invoice records
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE,             -- Stripe invoice ID
  invoice_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,                       -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  amount_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'usd',
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice line items
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,4) DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  line_type VARCHAR(20) DEFAULT 'subscription',     -- 'subscription', 'usage', 'addon', 'discount', 'tax'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business billing information
CREATE TABLE business_billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  tax_id VARCHAR(50),                               -- VAT/Tax ID
  billing_address JSONB DEFAULT '{}',               -- Billing address
  shipping_address JSONB DEFAULT '{}',              -- Shipping address (if different)
  po_number VARCHAR(100),                           -- Purchase order number
  notes TEXT,                                       -- Additional billing notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id)
);

-- ==============================================
-- BILLING INSIGHTS & ANALYTICS
-- ==============================================

-- Monthly billing snapshots
CREATE TABLE billing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_spend_cents INTEGER NOT NULL,
  subscription_cost_cents INTEGER DEFAULT 0,
  usage_cost_cents INTEGER DEFAULT 0,
  addon_cost_cents INTEGER DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  referral_credits_cents INTEGER DEFAULT 0,
  annual_savings_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, snapshot_date)
);

-- Usage vs quota tracking
CREATE TABLE usage_vs_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  current_usage DECIMAL(10,4) NOT NULL,
  quota_limit DECIMAL(10,4) NOT NULL,
  usage_percentage DECIMAL(5,2) NOT NULL,
  overage_quantity DECIMAL(10,4) DEFAULT 0,
  overage_cost_cents INTEGER DEFAULT 0,
  tracking_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, event_type, tracking_date)
);

-- Billing alerts and notifications
CREATE TABLE billing_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,                   -- 'quota_warning', 'quota_exceeded', 'payment_failed', 'invoice_due'
  alert_data JSONB NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',             -- 'low', 'medium', 'high', 'critical'
  is_read BOOLEAN DEFAULT false,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- FEATURE FLAGS & CONFIGURATION
-- ==============================================

-- Billing feature flags
CREATE TABLE billing_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(100) NOT NULL UNIQUE,
  flag_description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0,              -- 0-100
  target_plans JSONB DEFAULT '[]',                   -- Which plans see this feature
  target_businesses JSONB DEFAULT '[]',             -- Specific business targeting
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing configuration settings
CREATE TABLE billing_settings (
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

-- Usage events indexes
CREATE INDEX idx_usage_events_business_id ON usage_events(business_id);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_processed ON usage_events(processed_at);

-- Usage aggregation indexes
CREATE INDEX idx_usage_aggregation_business_id ON usage_aggregation(business_id);
CREATE INDEX idx_usage_aggregation_period ON usage_aggregation(billing_period_start, billing_period_end);
CREATE INDEX idx_usage_aggregation_synced ON usage_aggregation(synced_to_stripe_at);

-- Add-ons indexes
CREATE INDEX idx_business_add_ons_business_id ON business_add_ons(business_id);
CREATE INDEX idx_business_add_ons_status ON business_add_ons(status);
CREATE INDEX idx_upsell_interactions_business_id ON upsell_interactions(business_id);
CREATE INDEX idx_upsell_interactions_campaign ON upsell_interactions(campaign_id);

-- Custom plans indexes
CREATE INDEX idx_custom_plans_business_id ON custom_plans(business_id);
CREATE INDEX idx_custom_plans_status ON custom_plans(status);
CREATE INDEX idx_custom_plan_usage_plan_id ON custom_plan_usage(custom_plan_id);

-- Invoice indexes
CREATE INDEX idx_invoices_business_id ON invoices(business_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

-- Billing insights indexes
CREATE INDEX idx_billing_snapshots_business_id ON billing_snapshots(business_id);
CREATE INDEX idx_billing_snapshots_date ON billing_snapshots(snapshot_date);
CREATE INDEX idx_usage_vs_quota_business_id ON usage_vs_quota(business_id);
CREATE INDEX idx_usage_vs_quota_date ON usage_vs_quota(tracking_date);
CREATE INDEX idx_billing_alerts_business_id ON billing_alerts(business_id);
CREATE INDEX idx_billing_alerts_type ON billing_alerts(alert_type);

-- ==============================================
-- ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS for all monetization tables
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_aggregation ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsell_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsell_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_plan_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_vs_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for business isolation
CREATE POLICY "usage_events_business_isolation" ON usage_events
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "usage_aggregation_business_isolation" ON usage_aggregation
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "business_add_ons_business_isolation" ON business_add_ons
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "upsell_interactions_business_isolation" ON upsell_interactions
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "custom_plans_business_isolation" ON custom_plans
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "custom_plan_usage_business_isolation" ON custom_plan_usage
  USING (custom_plan_id IN (
    SELECT id FROM custom_plans 
    WHERE business_id = current_setting('app.current_business_id')::UUID
  ));

CREATE POLICY "invoices_business_isolation" ON invoices
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "invoice_line_items_business_isolation" ON invoice_line_items
  USING (invoice_id IN (
    SELECT id FROM invoices 
    WHERE business_id = current_setting('app.current_business_id')::UUID
  ));

CREATE POLICY "business_billing_info_business_isolation" ON business_billing_info
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "billing_snapshots_business_isolation" ON billing_snapshots
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "usage_vs_quota_business_isolation" ON usage_vs_quota
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "billing_alerts_business_isolation" ON billing_alerts
  USING (business_id = current_setting('app.current_business_id')::UUID);

-- Public read policies for add-ons and quotas
CREATE POLICY "add_ons_public_read" ON add_ons FOR SELECT USING (is_active = true);
CREATE POLICY "usage_quotas_public_read" ON usage_quotas FOR SELECT USING (true);

-- ==============================================
-- ANALYTICS FUNCTIONS
-- ==============================================

-- Function to calculate usage for a business in a period
CREATE OR REPLACE FUNCTION calculate_usage_for_period(
  business_uuid UUID,
  start_date DATE,
  end_date DATE,
  usage_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  event_type VARCHAR(50),
  total_quantity DECIMAL(10,4),
  total_cost_cents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.event_type,
    SUM(ue.quantity) as total_quantity,
    SUM(ue.total_cost_cents) as total_cost_cents
  FROM usage_events ue
  WHERE ue.business_id = business_uuid
    AND ue.created_at::DATE >= start_date
    AND ue.created_at::DATE <= end_date
    AND (usage_type IS NULL OR ue.event_type = usage_type)
  GROUP BY ue.event_type
  ORDER BY total_cost_cents DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate usage vs quota
CREATE OR REPLACE FUNCTION calculate_usage_vs_quota(business_uuid UUID, target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  event_type VARCHAR(50),
  current_usage DECIMAL(10,4),
  quota_limit DECIMAL(10,4),
  usage_percentage DECIMAL(5,2),
  overage_quantity DECIMAL(10,4),
  overage_cost_cents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH current_usage AS (
    SELECT 
      ue.event_type,
      SUM(ue.quantity) as total_usage
    FROM usage_events ue
    WHERE ue.business_id = business_uuid
      AND DATE_TRUNC('month', ue.created_at) = DATE_TRUNC('month', target_date)
    GROUP BY ue.event_type
  ),
  plan_quotas AS (
    SELECT 
      uq.event_type,
      uq.quota_limit,
      uq.overage_price_cents
    FROM usage_quotas uq
    JOIN subscriptions s ON uq.plan_id = s.plan_id
    WHERE s.business_id = business_uuid
      AND s.status = 'active'
  )
  SELECT 
    COALESCE(cu.event_type, pq.event_type) as event_type,
    COALESCE(cu.total_usage, 0) as current_usage,
    COALESCE(pq.quota_limit, 0) as quota_limit,
    CASE 
      WHEN pq.quota_limit > 0 THEN 
        ROUND((COALESCE(cu.total_usage, 0) / pq.quota_limit) * 100, 2)
      ELSE 0
    END as usage_percentage,
    GREATEST(COALESCE(cu.total_usage, 0) - COALESCE(pq.quota_limit, 0), 0) as overage_quantity,
    CASE 
      WHEN COALESCE(cu.total_usage, 0) > COALESCE(pq.quota_limit, 0) THEN
        (COALESCE(cu.total_usage, 0) - COALESCE(pq.quota_limit, 0)) * COALESCE(pq.overage_price_cents, 0)
      ELSE 0
    END as overage_cost_cents
  FROM current_usage cu
  FULL OUTER JOIN plan_quotas pq ON cu.event_type = pq.event_type;
END;
$$ LANGUAGE plpgsql;

-- Function to get billing insights for a business
CREATE OR REPLACE FUNCTION get_billing_insights(business_uuid UUID, months_back INTEGER DEFAULT 12)
RETURNS TABLE (
  month_date DATE,
  total_spend_cents INTEGER,
  subscription_cost_cents INTEGER,
  usage_cost_cents INTEGER,
  addon_cost_cents INTEGER,
  referral_credits_cents INTEGER,
  annual_savings_cents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bs.snapshot_date as month_date,
    bs.total_spend_cents,
    bs.subscription_cost_cents,
    bs.usage_cost_cents,
    bs.addon_cost_cents,
    bs.referral_credits_cents,
    bs.annual_savings_cents
  FROM billing_snapshots bs
  WHERE bs.business_id = business_uuid
    AND bs.snapshot_date >= CURRENT_DATE - INTERVAL '1 month' * months_back
  ORDER BY bs.snapshot_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- INITIAL DATA SEEDING
-- ==============================================

-- Insert default usage quotas for existing plans
INSERT INTO usage_quotas (plan_id, event_type, quota_limit, overage_price_cents, included_quantity) VALUES
('free', 'api_call', 1000, 0, 1000),
('free', 'voice_minute', 60, 0, 60),
('starter', 'api_call', 10000, 1, 10000),
('starter', 'voice_minute', 600, 2, 600),
('pro', 'api_call', 100000, 0, 100000),
('pro', 'voice_minute', 6000, 1, 6000),
('team', 'api_call', 500000, 0, 500000),
('team', 'voice_minute', 30000, 1, 30000);

-- Insert default add-ons
INSERT INTO add_ons (name, description, price_cents, billing_period, event_type, quantity_included, is_active, sort_order) VALUES
('Extra API Calls', 'Additional 10,000 API calls per month', 2000, 'monthly', 'api_call', 10000, true, 1),
('Extra Voice Minutes', 'Additional 1,000 voice minutes per month', 5000, 'monthly', 'voice_minute', 1000, true, 2),
('Priority Support', '24/7 priority customer support', 1000, 'monthly', NULL, NULL, true, 3),
('Advanced Analytics', 'Enhanced analytics and reporting', 1500, 'monthly', NULL, NULL, true, 4),
('White-label Solution', 'Remove VOCA branding and customize', 5000, 'monthly', NULL, NULL, true, 5);

-- Insert default upsell campaigns
INSERT INTO upsell_campaigns (name, description, trigger_conditions, target_add_on_id, cta_text, cta_url, is_active, priority) VALUES
('API Usage Warning', 'Show when approaching API quota', '{"usage_percentage": {"min": 80}}', (SELECT id FROM add_ons WHERE name = 'Extra API Calls'), 'Get More API Calls', '/billing/add-ons', true, 1),
('Voice Usage Warning', 'Show when approaching voice quota', '{"usage_percentage": {"min": 80}}', (SELECT id FROM add_ons WHERE name = 'Extra Voice Minutes'), 'Get More Voice Minutes', '/billing/add-ons', true, 2),
('High Usage Upsell', 'Show for high-usage businesses', '{"total_usage": {"min": 50000}}', (SELECT id FROM add_ons WHERE name = 'Advanced Analytics'), 'Upgrade to Pro', '/billing/upgrade', true, 3);

-- Insert default billing feature flags
INSERT INTO billing_feature_flags (flag_name, flag_description, is_enabled, rollout_percentage) VALUES
('usage_based_billing', 'Enable usage-based billing for metered plans', true, 100),
('add_ons', 'Enable add-on purchases and management', true, 100),
('custom_plans', 'Enable custom enterprise plans', true, 50),
('flexible_invoicing', 'Enable flexible invoicing with VAT support', true, 100),
('billing_insights', 'Enable billing insights dashboard', true, 100),
('upsell_campaigns', 'Enable contextual upsell campaigns', true, 100);

-- Insert default billing settings
INSERT INTO billing_settings (setting_key, setting_value, setting_description) VALUES
('usage_aggregation_frequency', '{"hours": 1}', 'How often to aggregate usage data'),
('quota_warning_threshold', '{"percentage": 80}', 'Usage percentage to trigger quota warnings'),
('overage_grace_period', '{"days": 3}', 'Grace period for overage charges'),
('invoice_generation_delay', '{"days": 1}', 'Delay before generating invoices'),
('usage_retention_days', '{"days": 365}', 'How long to retain usage data'),
('billing_alert_frequency', '{"hours": 24}', 'How often to check for billing alerts');
