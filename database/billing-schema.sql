-- Phase 4A: Core Stripe Integration & Payment Processing
-- Database Schema for Billing and Subscription Management

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  plan_id VARCHAR(100) NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL, -- active, trialing, past_due, canceled, unpaid
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods table
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- card, bank_account
  is_default BOOLEAN DEFAULT FALSE,
  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  bank_account_last4 VARCHAR(4),
  bank_account_bank_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table  
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  amount_due INTEGER NOT NULL, -- in cents
  amount_paid INTEGER DEFAULT 0, -- in cents
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL, -- draft, open, paid, past_due, canceled
  description TEXT,
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment history table
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL, -- succeeded, failed, canceled, processing
  failure_reason VARCHAR(255),
  payment_method_id UUID REFERENCES payment_methods(id),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Billing events table for audit logging
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- subscription_created, payment_succeeded, etc.
  stripe_event_id VARCHAR(255) UNIQUE,
  event_data JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'processed' -- processed, failed, retry
);

-- Enable Row Level Security for all billing tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for billing tables
CREATE POLICY "billing_business_isolation" ON subscriptions
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "billing_business_isolation" ON payment_methods
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "billing_business_isolation" ON invoices
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "billing_business_isolation" ON payment_history
  USING (business_id = current_setting('app.current_business_id')::UUID);

CREATE POLICY "billing_business_isolation" ON billing_events
  USING (business_id = current_setting('app.current_business_id')::UUID);

-- Indexes for performance
CREATE INDEX idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE INDEX idx_payment_methods_business_id ON payment_methods(business_id);
CREATE INDEX idx_payment_methods_stripe_id ON payment_methods(stripe_payment_method_id);
CREATE INDEX idx_payment_methods_customer_id ON payment_methods(stripe_customer_id);

CREATE INDEX idx_invoices_business_id ON invoices(business_id);
CREATE INDEX idx_invoices_stripe_id ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

CREATE INDEX idx_payment_history_business_id ON payment_history(business_id);
CREATE INDEX idx_payment_history_stripe_id ON payment_history(stripe_payment_intent_id);
CREATE INDEX idx_payment_history_status ON payment_history(status);

CREATE INDEX idx_billing_events_business_id ON billing_events(business_id);
CREATE INDEX idx_billing_events_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_stripe_id ON billing_events(stripe_event_id);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
