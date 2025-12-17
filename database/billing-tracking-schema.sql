-- Billing Tracking Schema
-- Creates tables for tracking API calls, voice minutes, and other usage metrics

-- Usage events tracking for metered billing
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,                    -- 'api_call', 'voice_minute', 'storage_mb', 'ai_query'
  quantity DECIMAL(10,4) NOT NULL,                    -- Usage quantity (calls, minutes, MB, etc.)
  unit_price_cents INTEGER NOT NULL,                  -- Price per unit in cents
  total_cost_cents INTEGER NOT NULL,                  -- Total cost for this event
  metadata JSONB DEFAULT '{}',                        -- Additional event data
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_usage_events_business_id ON usage_events(business_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_business_created ON usage_events(business_id, created_at);

-- Usage aggregation by billing cycle
CREATE TABLE IF NOT EXISTS usage_aggregation (
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

-- Indexes for usage aggregation
CREATE INDEX IF NOT EXISTS idx_usage_aggregation_business_id ON usage_aggregation(business_id);
CREATE INDEX IF NOT EXISTS idx_usage_aggregation_period ON usage_aggregation(billing_period_start, billing_period_end);

-- Usage quotas and limits per plan
CREATE TABLE IF NOT EXISTS usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  quota_limit DECIMAL(10,4) NOT NULL,                -- Monthly quota limit
  overage_price_cents INTEGER NOT NULL,              -- Price per unit over quota
  included_quantity DECIMAL(10,4) DEFAULT 0,         -- Included quantity in base price
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(plan_id, event_type)
);

-- Insert default pricing for usage types
INSERT INTO usage_quotas (plan_id, event_type, quota_limit, overage_price_cents, included_quantity) VALUES
('basic', 'api_call', 1000, 1, 1000),              -- 1000 API calls included, $0.01 per call over
('basic', 'voice_minute', 60, 2, 60),              -- 60 voice minutes included, $0.02 per minute over
('basic', 'ai_query', 100, 5, 100),                -- 100 AI queries included, $0.05 per query over
('basic', 'storage_mb', 1000, 1, 1000),           -- 1GB storage included, $0.001 per MB over
('pro', 'api_call', 10000, 1, 10000),             -- 10K API calls included
('pro', 'voice_minute', 600, 2, 600),              -- 10 hours voice minutes included
('pro', 'ai_query', 1000, 5, 1000),                -- 1K AI queries included
('pro', 'storage_mb', 10000, 1, 10000),           -- 10GB storage included
('enterprise', 'api_call', 100000, 1, 100000),     -- 100K API calls included
('enterprise', 'voice_minute', 6000, 2, 6000),     -- 100 hours voice minutes included
('enterprise', 'ai_query', 10000, 5, 10000),       -- 10K AI queries included
('enterprise', 'storage_mb', 100000, 1, 100000)    -- 100GB storage included
ON CONFLICT (plan_id, event_type) DO NOTHING;

-- Create a view for easy billing overview queries
CREATE OR REPLACE VIEW billing_overview AS
SELECT 
  b.id as business_id,
  b.name as business_name,
  COALESCE(api_usage.total_calls, 0) as api_calls,
  COALESCE(voice_usage.total_minutes, 0) as voice_minutes,
  COALESCE(ai_usage.total_queries, 0) as ai_queries,
  COALESCE(storage_usage.total_mb, 0) as storage_mb,
  COALESCE(api_usage.total_cost, 0) + 
  COALESCE(voice_usage.total_cost, 0) + 
  COALESCE(ai_usage.total_cost, 0) + 
  COALESCE(storage_usage.total_cost, 0) as total_cost
FROM businesses b
LEFT JOIN (
  SELECT 
    business_id,
    SUM(quantity) as total_calls,
    SUM(total_cost_cents) / 100.0 as total_cost
  FROM usage_events 
  WHERE event_type = 'api_call' 
    AND created_at >= date_trunc('month', CURRENT_DATE)
  GROUP BY business_id
) api_usage ON b.id = api_usage.business_id
LEFT JOIN (
  SELECT 
    business_id,
    SUM(quantity) as total_minutes,
    SUM(total_cost_cents) / 100.0 as total_cost
  FROM usage_events 
  WHERE event_type = 'voice_minute' 
    AND created_at >= date_trunc('month', CURRENT_DATE)
  GROUP BY business_id
) voice_usage ON b.id = voice_usage.business_id
LEFT JOIN (
  SELECT 
    business_id,
    SUM(quantity) as total_queries,
    SUM(total_cost_cents) / 100.0 as total_cost
  FROM usage_events 
  WHERE event_type = 'ai_query' 
    AND created_at >= date_trunc('month', CURRENT_DATE)
  GROUP BY business_id
) ai_usage ON b.id = ai_usage.business_id
LEFT JOIN (
  SELECT 
    business_id,
    SUM(quantity) as total_mb,
    SUM(total_cost_cents) / 100.0 as total_cost
  FROM usage_events 
  WHERE event_type = 'storage_mb' 
    AND created_at >= date_trunc('month', CURRENT_DATE)
  GROUP BY business_id
) storage_usage ON b.id = storage_usage.business_id;




