-- Phase 4C: Revenue Analytics & Business Intelligence System
-- Database Schema for Comprehensive Revenue Analytics and Business Intelligence

-- ==============================================
-- REVENUE ANALYTICS TABLES
-- ==============================================

-- Monthly Recurring Revenue tracking
CREATE TABLE mrr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  total_mrr_cents INTEGER NOT NULL,
  new_business_mrr_cents INTEGER DEFAULT 0,    -- New customers
  expansion_mrr_cents INTEGER DEFAULT 0,       -- Upgrades/usage growth
  contraction_mrr_cents INTEGER DEFAULT 0,     -- Downgrades
  churned_mrr_cents INTEGER DEFAULT 0,         -- Lost customers
  net_new_mrr_cents INTEGER DEFAULT 0,         -- Net change
  total_customers INTEGER NOT NULL,
  paying_customers INTEGER NOT NULL,
  average_revenue_per_user_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(snapshot_date)
);

-- Customer Lifetime Value calculations
CREATE TABLE customer_ltv_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_subscription_date DATE NOT NULL,
  last_active_date DATE,
  total_revenue_cents INTEGER DEFAULT 0,
  total_months_active INTEGER DEFAULT 0,
  current_mrr_cents INTEGER DEFAULT 0,
  predicted_ltv_cents INTEGER DEFAULT 0,
  churn_probability DECIMAL(5,4) DEFAULT 0,    -- 0.0000 to 1.0000
  health_score INTEGER DEFAULT 100,            -- 0-100 scale
  segment VARCHAR(50),                         -- 'champion', 'at_risk', etc.
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue cohort analysis
CREATE TABLE revenue_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_month DATE NOT NULL,                  -- When customers first subscribed
  months_since_start INTEGER NOT NULL,         -- 1, 2, 3, etc.
  customers_remaining INTEGER NOT NULL,
  total_revenue_cents INTEGER NOT NULL,
  average_revenue_per_customer_cents INTEGER DEFAULT 0,
  retention_rate DECIMAL(5,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(cohort_month, months_since_start)
);

-- Churn analysis and predictions
CREATE TABLE churn_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  churn_probability DECIMAL(5,4) NOT NULL,
  churn_risk_factors JSONB DEFAULT '{}',       -- Usage decline, payment issues, etc.
  recommended_actions JSONB DEFAULT '{}',      -- Suggested interventions
  last_login_date DATE,
  usage_trend VARCHAR(20),                     -- 'increasing', 'stable', 'declining'
  support_tickets_count INTEGER DEFAULT 0,
  payment_failures_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- BUSINESS INTELLIGENCE TABLES
-- ==============================================

-- Customer acquisition cost tracking
CREATE TABLE cac_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_month DATE NOT NULL,
  acquisition_channel VARCHAR(100),            -- 'organic', 'paid_search', 'referral'
  customers_acquired INTEGER NOT NULL,
  total_acquisition_cost_cents INTEGER NOT NULL,
  cost_per_customer_cents INTEGER NOT NULL,
  ltv_to_cac_ratio DECIMAL(5,2) DEFAULT 0,
  payback_period_months INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plan performance analytics
CREATE TABLE plan_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id VARCHAR(50) NOT NULL,
  analysis_period_start DATE NOT NULL,
  analysis_period_end DATE NOT NULL,
  total_subscribers INTEGER NOT NULL,
  new_subscribers INTEGER DEFAULT 0,
  churned_subscribers INTEGER DEFAULT 0,
  upgrade_rate DECIMAL(5,4) DEFAULT 0,
  downgrade_rate DECIMAL(5,4) DEFAULT 0,
  average_usage_percentage DECIMAL(5,2) DEFAULT 0,
  overage_revenue_cents INTEGER DEFAULT 0,
  plan_satisfaction_score DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial reporting data
CREATE TABLE financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL,            -- 'monthly_revenue', 'tax_summary', etc.
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,
  total_revenue_cents INTEGER NOT NULL,
  recognized_revenue_cents INTEGER NOT NULL,
  deferred_revenue_cents INTEGER DEFAULT 0,
  refunds_issued_cents INTEGER DEFAULT 0,
  taxes_collected_cents INTEGER DEFAULT 0,
  net_revenue_cents INTEGER NOT NULL,
  report_data JSONB NOT NULL,                  -- Detailed breakdown
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- PREDICTIVE ANALYTICS TABLES
-- ==============================================

-- Revenue forecasting models
CREATE TABLE revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL,
  forecast_horizon_months INTEGER NOT NULL,   -- 1, 3, 6, 12
  predicted_mrr_cents INTEGER NOT NULL,
  predicted_arr_cents INTEGER NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,  -- 0.00 to 1.00
  model_version VARCHAR(20) DEFAULT 'v1.0',
  input_features JSONB NOT NULL,              -- Features used for prediction
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer behavior predictions
CREATE TABLE customer_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  prediction_type VARCHAR(50) NOT NULL,       -- 'churn', 'expansion', 'downgrade'
  prediction_horizon_days INTEGER NOT NULL,   -- 30, 60, 90
  probability DECIMAL(5,4) NOT NULL,          -- 0.0000 to 1.0000
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  predicted_date DATE,
  input_features JSONB NOT NULL,
  model_version VARCHAR(20) DEFAULT 'v1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expansion opportunity identification
CREATE TABLE expansion_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opportunity_type VARCHAR(50) NOT NULL,       -- 'upgrade', 'addon', 'usage_increase'
  current_plan_id VARCHAR(50) NOT NULL,
  recommended_plan_id VARCHAR(50),
  potential_revenue_increase_cents INTEGER NOT NULL,
  probability_of_conversion DECIMAL(5,4) NOT NULL,
  recommended_actions JSONB NOT NULL,
  urgency_score INTEGER DEFAULT 0,            -- 0-100 scale
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- CUSTOMER SUCCESS INTELLIGENCE
-- ==============================================

-- Customer health scoring
CREATE TABLE customer_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  health_score INTEGER NOT NULL,              -- 0-100 scale
  health_category VARCHAR(20) NOT NULL,        -- 'healthy', 'at_risk', 'critical'
  score_components JSONB NOT NULL,           -- Breakdown of score factors
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id)
);

-- Customer journey mapping
CREATE TABLE customer_journey_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,            -- 'signup', 'first_query', 'upgrade', 'churn'
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_data JSONB DEFAULT '{}',
  journey_stage VARCHAR(50) NOT NULL,         -- 'awareness', 'consideration', 'purchase', 'retention'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer satisfaction tracking
CREATE TABLE customer_satisfaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  satisfaction_score INTEGER NOT NULL,        -- 1-10 scale
  nps_score INTEGER,                          -- Net Promoter Score
  feedback_text TEXT,
  survey_type VARCHAR(50) NOT NULL,           -- 'onboarding', 'monthly', 'churn'
  survey_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- AUTOMATED INSIGHTS & ALERTS
-- ==============================================

-- Business insights generation
CREATE TABLE business_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type VARCHAR(50) NOT NULL,          -- 'revenue_growth', 'churn_risk', 'expansion_opportunity'
  insight_category VARCHAR(50) NOT NULL,      -- 'revenue', 'customer', 'operational'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  impact_score INTEGER DEFAULT 0,             -- 0-100 scale
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  actionable BOOLEAN DEFAULT true,
  recommended_actions JSONB DEFAULT '{}',
  insight_data JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Alert system
CREATE TABLE business_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL,            -- 'mrr_decline', 'churn_spike', 'expansion_opportunity'
  alert_category VARCHAR(50) NOT NULL,        -- 'revenue', 'customer', 'operational'
  severity VARCHAR(20) NOT NULL,              -- 'low', 'medium', 'high', 'critical'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  alert_data JSONB DEFAULT '{}',
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- PERFORMANCE INDEXES
-- ==============================================

-- MRR snapshots indexes
CREATE INDEX idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);
CREATE INDEX idx_mrr_snapshots_created_at ON mrr_snapshots(created_at);

-- Customer LTV indexes
CREATE INDEX idx_customer_ltv_business_id ON customer_ltv_metrics(business_id);
CREATE INDEX idx_customer_ltv_segment ON customer_ltv_metrics(segment);
CREATE INDEX idx_customer_ltv_health_score ON customer_ltv_metrics(health_score);
CREATE INDEX idx_customer_ltv_churn_prob ON customer_ltv_metrics(churn_probability);

-- Revenue cohorts indexes
CREATE INDEX idx_revenue_cohorts_cohort_month ON revenue_cohorts(cohort_month);
CREATE INDEX idx_revenue_cohorts_months_since_start ON revenue_cohorts(months_since_start);

-- Churn analysis indexes
CREATE INDEX idx_churn_analysis_business_id ON churn_analysis(business_id);
CREATE INDEX idx_churn_analysis_date ON churn_analysis(analysis_date);
CREATE INDEX idx_churn_analysis_probability ON churn_analysis(churn_probability);

-- CAC metrics indexes
CREATE INDEX idx_cac_metrics_month ON cac_metrics(acquisition_month);
CREATE INDEX idx_cac_metrics_channel ON cac_metrics(acquisition_channel);

-- Plan analytics indexes
CREATE INDEX idx_plan_analytics_plan_id ON plan_analytics(plan_id);
CREATE INDEX idx_plan_analytics_period ON plan_analytics(analysis_period_start, analysis_period_end);

-- Financial reports indexes
CREATE INDEX idx_financial_reports_type ON financial_reports(report_type);
CREATE INDEX idx_financial_reports_period ON financial_reports(reporting_period_start, reporting_period_end);

-- Revenue forecasts indexes
CREATE INDEX idx_revenue_forecasts_date ON revenue_forecasts(forecast_date);
CREATE INDEX idx_revenue_forecasts_horizon ON revenue_forecasts(forecast_horizon_months);

-- Customer predictions indexes
CREATE INDEX idx_customer_predictions_business_id ON customer_predictions(business_id);
CREATE INDEX idx_customer_predictions_type ON customer_predictions(prediction_type);
CREATE INDEX idx_customer_predictions_probability ON customer_predictions(probability);

-- Expansion opportunities indexes
CREATE INDEX idx_expansion_opportunities_business_id ON expansion_opportunities(business_id);
CREATE INDEX idx_expansion_opportunities_type ON expansion_opportunities(opportunity_type);
CREATE INDEX idx_expansion_opportunities_urgency ON expansion_opportunities(urgency_score);

-- Customer health indexes
CREATE INDEX idx_customer_health_business_id ON customer_health_scores(business_id);
CREATE INDEX idx_customer_health_category ON customer_health_scores(health_category);
CREATE INDEX idx_customer_health_score ON customer_health_scores(health_score);

-- Customer journey indexes
CREATE INDEX idx_customer_journey_business_id ON customer_journey_events(business_id);
CREATE INDEX idx_customer_journey_event_type ON customer_journey_events(event_type);
CREATE INDEX idx_customer_journey_date ON customer_journey_events(event_date);

-- Customer satisfaction indexes
CREATE INDEX idx_customer_satisfaction_business_id ON customer_satisfaction(business_id);
CREATE INDEX idx_customer_satisfaction_score ON customer_satisfaction(satisfaction_score);
CREATE INDEX idx_customer_satisfaction_survey_date ON customer_satisfaction(survey_date);

-- Business insights indexes
CREATE INDEX idx_business_insights_type ON business_insights(insight_type);
CREATE INDEX idx_business_insights_category ON business_insights(insight_category);
CREATE INDEX idx_business_insights_impact ON business_insights(impact_score);
CREATE INDEX idx_business_insights_generated_at ON business_insights(generated_at);

-- Business alerts indexes
CREATE INDEX idx_business_alerts_type ON business_alerts(alert_type);
CREATE INDEX idx_business_alerts_severity ON business_alerts(severity);
CREATE INDEX idx_business_alerts_business_id ON business_alerts(business_id);
CREATE INDEX idx_business_alerts_created_at ON business_alerts(created_at);

-- ==============================================
-- ROW LEVEL SECURITY
-- ==============================================

-- Enable RLS for all analytics tables
ALTER TABLE mrr_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ltv_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE cac_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expansion_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_journey_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_satisfaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for business isolation
CREATE POLICY "customer_ltv_business_isolation" ON customer_ltv_metrics
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "churn_analysis_business_isolation" ON churn_analysis
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "customer_predictions_business_isolation" ON customer_predictions
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "expansion_opportunities_business_isolation" ON expansion_opportunities
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "customer_health_business_isolation" ON customer_health_scores
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "customer_journey_business_isolation" ON customer_journey_events
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "customer_satisfaction_business_isolation" ON customer_satisfaction
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "business_alerts_business_isolation" ON business_alerts
  USING (business_id = current_setting('app.current_business_id')::UUID);

-- Public read policies for aggregated data
CREATE POLICY "mrr_snapshots_public_read" ON mrr_snapshots FOR SELECT USING (true);
CREATE POLICY "revenue_cohorts_public_read" ON revenue_cohorts FOR SELECT USING (true);
CREATE POLICY "cac_metrics_public_read" ON cac_metrics FOR SELECT USING (true);
CREATE POLICY "plan_analytics_public_read" ON plan_analytics FOR SELECT USING (true);
CREATE POLICY "financial_reports_public_read" ON financial_reports FOR SELECT USING (true);
CREATE POLICY "revenue_forecasts_public_read" ON revenue_forecasts FOR SELECT USING (true);
CREATE POLICY "business_insights_public_read" ON business_insights FOR SELECT USING (true);

-- ==============================================
-- ANALYTICS FUNCTIONS
-- ==============================================

-- Function to calculate MRR for a specific date
CREATE OR REPLACE FUNCTION calculate_mrr_for_date(target_date DATE)
RETURNS TABLE (
  total_mrr_cents INTEGER,
  new_business_mrr_cents INTEGER,
  expansion_mrr_cents INTEGER,
  contraction_mrr_cents INTEGER,
  churned_mrr_cents INTEGER,
  net_new_mrr_cents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH active_subscriptions AS (
    SELECT 
      s.business_id,
      pd.price_cents,
      s.created_at,
      s.current_period_start,
      s.current_period_end
    FROM subscriptions s
    JOIN plan_definitions pd ON s.plan_id = pd.id
    WHERE s.status = 'active'
      AND s.current_period_start <= target_date
      AND s.current_period_end > target_date
  ),
  previous_period AS (
    SELECT 
      s.business_id,
      pd.price_cents,
      s.created_at,
      s.current_period_start,
      s.current_period_end
    FROM subscriptions s
    JOIN plan_definitions pd ON s.plan_id = pd.id
    WHERE s.status = 'active'
      AND s.current_period_start <= (target_date - INTERVAL '1 month')
      AND s.current_period_end > (target_date - INTERVAL '1 month')
  )
  SELECT 
    COALESCE(SUM(active.price_cents), 0)::INTEGER as total_mrr_cents,
    COALESCE(SUM(CASE WHEN active.created_at >= (target_date - INTERVAL '1 month') THEN active.price_cents ELSE 0 END), 0)::INTEGER as new_business_mrr_cents,
    COALESCE(SUM(CASE WHEN active.price_cents > COALESCE(prev.price_cents, 0) THEN active.price_cents - COALESCE(prev.price_cents, 0) ELSE 0 END), 0)::INTEGER as expansion_mrr_cents,
    COALESCE(SUM(CASE WHEN active.price_cents < COALESCE(prev.price_cents, 0) THEN COALESCE(prev.price_cents, 0) - active.price_cents ELSE 0 END), 0)::INTEGER as contraction_mrr_cents,
    COALESCE(SUM(COALESCE(prev.price_cents, 0) - COALESCE(active.price_cents, 0)), 0)::INTEGER as churned_mrr_cents,
    COALESCE(SUM(active.price_cents) - SUM(COALESCE(prev.price_cents, 0)), 0)::INTEGER as net_new_mrr_cents
  FROM active_subscriptions active
  LEFT JOIN previous_period prev ON active.business_id = prev.business_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate customer health score
CREATE OR REPLACE FUNCTION calculate_customer_health_score(business_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  health_score INTEGER := 100;
  usage_trend_score INTEGER;
  payment_reliability_score INTEGER;
  engagement_score INTEGER;
  support_score INTEGER;
BEGIN
  -- Calculate usage trend score (0-25 points)
  SELECT CASE 
    WHEN usage_growth_rate > 0.1 THEN 25
    WHEN usage_growth_rate > 0 THEN 20
    WHEN usage_growth_rate > -0.1 THEN 15
    WHEN usage_growth_rate > -0.2 THEN 10
    ELSE 5
  END INTO usage_trend_score
  FROM (
    SELECT 
      (current_usage - previous_usage)::DECIMAL / NULLIF(previous_usage, 0) as usage_growth_rate
    FROM (
      SELECT 
        COALESCE(SUM(quantity), 0) as current_usage
      FROM usage_events 
      WHERE business_id = business_uuid 
        AND created_at >= NOW() - INTERVAL '30 days'
    ) current,
    (
      SELECT 
        COALESCE(SUM(quantity), 0) as previous_usage
      FROM usage_events 
      WHERE business_id = business_uuid 
        AND created_at >= NOW() - INTERVAL '60 days'
        AND created_at < NOW() - INTERVAL '30 days'
    ) previous
  ) usage_analysis;

  -- Calculate payment reliability score (0-25 points)
  SELECT CASE 
    WHEN payment_success_rate >= 0.95 THEN 25
    WHEN payment_success_rate >= 0.90 THEN 20
    WHEN payment_success_rate >= 0.80 THEN 15
    WHEN payment_success_rate >= 0.70 THEN 10
    ELSE 5
  END INTO payment_reliability_score
  FROM (
    SELECT 
      COUNT(CASE WHEN status = 'succeeded' THEN 1 END)::DECIMAL / 
      NULLIF(COUNT(*), 0) as payment_success_rate
    FROM payment_history 
    WHERE business_id = business_uuid 
      AND processed_at >= NOW() - INTERVAL '90 days'
  ) payment_analysis;

  -- Calculate engagement score (0-25 points)
  SELECT CASE 
    WHEN login_frequency >= 0.8 THEN 25
    WHEN login_frequency >= 0.6 THEN 20
    WHEN login_frequency >= 0.4 THEN 15
    WHEN login_frequency >= 0.2 THEN 10
    ELSE 5
  END INTO engagement_score
  FROM (
    SELECT 
      COUNT(DISTINCT DATE(created_at))::DECIMAL / 30 as login_frequency
    FROM query_logs 
    WHERE business_id = business_uuid 
      AND created_at >= NOW() - INTERVAL '30 days'
  ) engagement_analysis;

  -- Calculate support score (0-25 points)
  SELECT CASE 
    WHEN support_tickets = 0 THEN 25
    WHEN support_tickets <= 2 THEN 20
    WHEN support_tickets <= 5 THEN 15
    WHEN support_tickets <= 10 THEN 10
    ELSE 5
  END INTO support_score
  FROM (
    SELECT COUNT(*) as support_tickets
    FROM query_logs 
    WHERE business_id = business_uuid 
      AND status = 'ERROR'
      AND created_at >= NOW() - INTERVAL '30 days'
  ) support_analysis;

  -- Calculate final health score
  health_score := COALESCE(usage_trend_score, 0) + 
                  COALESCE(payment_reliability_score, 0) + 
                  COALESCE(engagement_score, 0) + 
                  COALESCE(support_score, 0);

  RETURN GREATEST(0, LEAST(100, health_score));
END;
$$ LANGUAGE plpgsql;

-- Function to generate business insights
CREATE OR REPLACE FUNCTION generate_business_insights()
RETURNS VOID AS $$
DECLARE
  insight_record RECORD;
BEGIN
  -- Revenue growth insights
  INSERT INTO business_insights (insight_type, insight_category, title, description, impact_score, confidence_score, actionable, insight_data)
  SELECT 
    'revenue_growth',
    'revenue',
    'Revenue Growth Analysis',
    'MRR has ' || CASE 
      WHEN growth_rate > 0.1 THEN 'grown significantly by ' || ROUND(growth_rate * 100, 1) || '%'
      WHEN growth_rate > 0 THEN 'grown by ' || ROUND(growth_rate * 100, 1) || '%'
      WHEN growth_rate > -0.05 THEN 'remained stable'
      ELSE 'declined by ' || ROUND(ABS(growth_rate) * 100, 1) || '%'
    END || ' compared to last month.',
    CASE 
      WHEN growth_rate > 0.1 THEN 90
      WHEN growth_rate > 0.05 THEN 70
      WHEN growth_rate > 0 THEN 50
      WHEN growth_rate > -0.05 THEN 30
      ELSE 80
    END,
    0.85,
    true,
    jsonb_build_object(
      'growth_rate', growth_rate,
      'current_mrr', current_mrr,
      'previous_mrr', previous_mrr
    )
  FROM (
    SELECT 
      (current.total_mrr_cents - previous.total_mrr_cents)::DECIMAL / NULLIF(previous.total_mrr_cents, 0) as growth_rate,
      current.total_mrr_cents as current_mrr,
      previous.total_mrr_cents as previous_mrr
    FROM mrr_snapshots current
    CROSS JOIN mrr_snapshots previous
    WHERE current.snapshot_date = CURRENT_DATE
      AND previous.snapshot_date = CURRENT_DATE - INTERVAL '1 month'
  ) growth_analysis
  WHERE growth_rate IS NOT NULL;

  -- Churn risk insights
  INSERT INTO business_insights (insight_type, insight_category, title, description, impact_score, confidence_score, actionable, insight_data)
  SELECT 
    'churn_risk',
    'customer',
    'High Churn Risk Detected',
    'There are ' || COUNT(*) || ' customers with high churn probability (>70%). Immediate attention recommended.',
    85,
    0.80,
    true,
    jsonb_build_object(
      'high_risk_customers', COUNT(*),
      'total_revenue_at_risk', SUM(current_mrr_cents)
    )
  FROM customer_ltv_metrics
  WHERE churn_probability > 0.7
    AND last_calculated_at >= NOW() - INTERVAL '1 day';

  -- Expansion opportunities
  INSERT INTO business_insights (insight_type, insight_category, title, description, impact_score, confidence_score, actionable, insight_data)
  SELECT 
    'expansion_opportunity',
    'revenue',
    'Expansion Revenue Opportunities',
    'Identified ' || COUNT(*) || ' customers with high expansion potential, representing $' || ROUND(SUM(potential_revenue_increase_cents) / 100.0, 2) || ' in potential additional revenue.',
    75,
    0.75,
    true,
    jsonb_build_object(
      'expansion_opportunities', COUNT(*),
      'potential_revenue', SUM(potential_revenue_increase_cents)
    )
  FROM expansion_opportunities
  WHERE probability_of_conversion > 0.6
    AND created_at >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- SCHEDULED ANALYTICS JOBS
-- ==============================================

-- Function to run daily analytics processing
CREATE OR REPLACE FUNCTION run_daily_analytics()
RETURNS VOID AS $$
BEGIN
  -- Calculate and store MRR snapshot for today
  INSERT INTO mrr_snapshots (
    snapshot_date,
    total_mrr_cents,
    new_business_mrr_cents,
    expansion_mrr_cents,
    contraction_mrr_cents,
    churned_mrr_cents,
    net_new_mrr_cents,
    total_customers,
    paying_customers,
    average_revenue_per_user_cents
  )
  SELECT 
    CURRENT_DATE,
    mrr_data.total_mrr_cents,
    mrr_data.new_business_mrr_cents,
    mrr_data.expansion_mrr_cents,
    mrr_data.contraction_mrr_cents,
    mrr_data.churned_mrr_cents,
    mrr_data.net_new_mrr_cents,
    customer_counts.total_customers,
    customer_counts.paying_customers,
    CASE 
      WHEN customer_counts.paying_customers > 0 
      THEN mrr_data.total_mrr_cents / customer_counts.paying_customers
      ELSE 0
    END
  FROM calculate_mrr_for_date(CURRENT_DATE) mrr_data
  CROSS JOIN (
    SELECT 
      COUNT(*) as total_customers,
      COUNT(CASE WHEN s.status = 'active' THEN 1 END) as paying_customers
    FROM businesses b
    LEFT JOIN subscriptions s ON b.id = s.business_id
  ) customer_counts
  WHERE NOT EXISTS (
    SELECT 1 FROM mrr_snapshots WHERE snapshot_date = CURRENT_DATE
  );

  -- Update customer LTV metrics
  INSERT INTO customer_ltv_metrics (
    business_id,
    first_subscription_date,
    last_active_date,
    total_revenue_cents,
    total_months_active,
    current_mrr_cents,
    predicted_ltv_cents,
    churn_probability,
    health_score,
    segment
  )
  SELECT 
    b.id,
    s.created_at::DATE,
    COALESCE(MAX(ql.created_at)::DATE, s.created_at::DATE),
    COALESCE(SUM(ph.amount), 0),
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, s.created_at::DATE)),
    pd.price_cents,
    pd.price_cents * 12, -- Simple LTV calculation
    0.1, -- Default churn probability
    calculate_customer_health_score(b.id),
    CASE 
      WHEN calculate_customer_health_score(b.id) >= 80 THEN 'champion'
      WHEN calculate_customer_health_score(b.id) >= 60 THEN 'loyal'
      WHEN calculate_customer_health_score(b.id) >= 40 THEN 'at_risk'
      ELSE 'critical'
    END
  FROM businesses b
  JOIN subscriptions s ON b.id = s.business_id
  JOIN plan_definitions pd ON s.plan_id = pd.id
  LEFT JOIN payment_history ph ON b.id = ph.business_id
  LEFT JOIN query_logs ql ON b.id = ql.business_id
  WHERE s.status = 'active'
  GROUP BY b.id, s.created_at, pd.price_cents
  ON CONFLICT (business_id) DO UPDATE SET
    last_active_date = EXCLUDED.last_active_date,
    total_revenue_cents = EXCLUDED.total_revenue_cents,
    total_months_active = EXCLUDED.total_months_active,
    current_mrr_cents = EXCLUDED.current_mrr_cents,
    health_score = EXCLUDED.health_score,
    segment = EXCLUDED.segment,
    last_calculated_at = NOW();

  -- Generate business insights
  PERFORM generate_business_insights();
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- INITIAL DATA SEEDING
-- ==============================================

-- Create initial MRR snapshot if none exists
INSERT INTO mrr_snapshots (
  snapshot_date,
  total_mrr_cents,
  new_business_mrr_cents,
  expansion_mrr_cents,
  contraction_mrr_cents,
  churned_mrr_cents,
  net_new_mrr_cents,
  total_customers,
  paying_customers,
  average_revenue_per_user_cents
)
SELECT 
  CURRENT_DATE,
  COALESCE(SUM(pd.price_cents), 0),
  0,
  0,
  0,
  0,
  0,
  COUNT(DISTINCT b.id),
  COUNT(DISTINCT CASE WHEN s.status = 'active' THEN b.id END),
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN s.status = 'active' THEN b.id END) > 0 
    THEN COALESCE(SUM(pd.price_cents), 0) / COUNT(DISTINCT CASE WHEN s.status = 'active' THEN b.id END)
    ELSE 0
  END
FROM businesses b
LEFT JOIN subscriptions s ON b.id = s.business_id
LEFT JOIN plan_definitions pd ON s.plan_id = pd.id
WHERE NOT EXISTS (SELECT 1 FROM mrr_snapshots WHERE snapshot_date = CURRENT_DATE);
