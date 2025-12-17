-- Phase 4C: Revenue Analytics & Business Intelligence System
-- Fixed schema without complex functions

-- Monthly Recurring Revenue tracking
CREATE TABLE IF NOT EXISTS mrr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  total_mrr_cents INTEGER NOT NULL,
  new_business_mrr_cents INTEGER DEFAULT 0,
  expansion_mrr_cents INTEGER DEFAULT 0,
  contraction_mrr_cents INTEGER DEFAULT 0,
  churned_mrr_cents INTEGER DEFAULT 0,
  net_new_mrr_cents INTEGER DEFAULT 0,
  total_customers INTEGER NOT NULL,
  paying_customers INTEGER NOT NULL,
  average_revenue_per_user_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customer Lifetime Value calculations
CREATE TABLE IF NOT EXISTS customer_ltv_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_subscription_date DATE NOT NULL,
  last_active_date DATE,
  total_revenue_cents INTEGER DEFAULT 0,
  total_months_active INTEGER DEFAULT 0,
  current_mrr_cents INTEGER DEFAULT 0,
  predicted_ltv_cents INTEGER DEFAULT 0,
  churn_probability DECIMAL(5,4) DEFAULT 0,
  health_score INTEGER DEFAULT 100,
  segment VARCHAR(50),
  last_calculated_at TIMESTAMP DEFAULT NOW()
);

-- Revenue cohort analysis
CREATE TABLE IF NOT EXISTS revenue_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_month DATE NOT NULL,
  months_since_start INTEGER NOT NULL,
  customers_remaining INTEGER NOT NULL,
  total_revenue_cents INTEGER NOT NULL,
  average_revenue_per_customer_cents INTEGER DEFAULT 0,
  retention_rate DECIMAL(5,4) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Churn analysis and predictions
CREATE TABLE IF NOT EXISTS churn_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  churn_probability DECIMAL(5,4) NOT NULL,
  churn_risk_factors JSONB DEFAULT '{}',
  recommended_actions JSONB DEFAULT '{}',
  last_login_date DATE,
  usage_trend VARCHAR(20),
  support_tickets_count INTEGER DEFAULT 0,
  payment_failures_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customer acquisition cost tracking
CREATE TABLE IF NOT EXISTS cac_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_month DATE NOT NULL,
  acquisition_channel VARCHAR(100),
  customers_acquired INTEGER NOT NULL,
  total_acquisition_cost_cents INTEGER NOT NULL,
  cost_per_customer_cents INTEGER NOT NULL,
  ltv_to_cac_ratio DECIMAL(5,2) DEFAULT 0,
  payback_period_months INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Plan performance analytics
CREATE TABLE IF NOT EXISTS plan_analytics (
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- Financial reporting data
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL,
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,
  total_revenue_cents INTEGER NOT NULL,
  recognized_revenue_cents INTEGER NOT NULL,
  deferred_revenue_cents INTEGER DEFAULT 0,
  refunds_issued_cents INTEGER DEFAULT 0,
  taxes_collected_cents INTEGER DEFAULT 0,
  net_revenue_cents INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Revenue forecasts
CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL,
  forecast_horizon_months INTEGER NOT NULL,
  predicted_mrr_cents INTEGER NOT NULL,
  predicted_arr_cents INTEGER NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,
  confidence_interval_lower INTEGER NOT NULL,
  confidence_interval_upper INTEGER NOT NULL,
  growth_rate DECIMAL(5,4) NOT NULL,
  key_assumptions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customer predictions
CREATE TABLE IF NOT EXISTS customer_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  prediction_type VARCHAR(50) NOT NULL,
  prediction_date DATE NOT NULL,
  prediction_horizon_days INTEGER NOT NULL,
  predicted_value DECIMAL(10,4) NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,
  risk_factors JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Expansion opportunities
CREATE TABLE IF NOT EXISTS expansion_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opportunity_type VARCHAR(50) NOT NULL,
  potential_revenue_increase_cents INTEGER NOT NULL,
  probability_of_conversion DECIMAL(3,2) NOT NULL,
  urgency_score INTEGER NOT NULL,
  recommended_actions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customer health scores
CREATE TABLE IF NOT EXISTS customer_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  health_score INTEGER NOT NULL,
  usage_trend_score INTEGER DEFAULT 0,
  payment_reliability_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  support_score INTEGER DEFAULT 0,
  overall_health_status VARCHAR(20) NOT NULL,
  last_calculated_at TIMESTAMP DEFAULT NOW()
);

-- Business insights
CREATE TABLE IF NOT EXISTS business_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type VARCHAR(50) NOT NULL,
  insight_category VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  impact_score INTEGER NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,
  actionable BOOLEAN NOT NULL DEFAULT true,
  recommended_actions JSONB DEFAULT '[]',
  insight_data JSONB DEFAULT '{}',
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Business alerts
CREATE TABLE IF NOT EXISTS business_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL,
  alert_category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  alert_data JSONB DEFAULT '{}',
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_customer_ltv_business ON customer_ltv_metrics(business_id);
CREATE INDEX IF NOT EXISTS idx_revenue_cohorts_month ON revenue_cohorts(cohort_month);
CREATE INDEX IF NOT EXISTS idx_churn_analysis_business ON churn_analysis(business_id);
CREATE INDEX IF NOT EXISTS idx_cac_metrics_month ON cac_metrics(acquisition_month);
CREATE INDEX IF NOT EXISTS idx_plan_analytics_plan ON plan_analytics(plan_id);
CREATE INDEX IF NOT EXISTS idx_financial_reports_type ON financial_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_date ON revenue_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_customer_predictions_business ON customer_predictions(business_id);
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_business ON expansion_opportunities(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_health_business ON customer_health_scores(business_id);
CREATE INDEX IF NOT EXISTS idx_business_insights_category ON business_insights(insight_category);
CREATE INDEX IF NOT EXISTS idx_business_alerts_severity ON business_alerts(severity);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_ltv_unique ON customer_ltv_metrics(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_churn_analysis_unique ON churn_analysis(business_id, analysis_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_health_unique ON customer_health_scores(business_id);
