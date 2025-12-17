-- =====================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR MULTI-TENANT ISOLATION
-- =====================================================
-- 
-- This file contains all RLS policies for the VOCA AI Order Taking Agent
-- Run this SQL directly in PostgreSQL (psql/pgAdmin) after schema migrations
--
-- IMPORTANT: Run this AFTER all Prisma migrations are complete
-- =====================================================

-- ===== ENABLE RLS ON ALL TENANT TABLES =====

-- Core business tables
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operating_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_base" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "query_logs" ENABLE ROW LEVEL SECURITY;

-- Legacy tables
ALTER TABLE "menus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "powerups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_integrations" ENABLE ROW LEVEL SECURITY;

-- Embeddings table
ALTER TABLE "embeddings" ENABLE ROW LEVEL SECURITY;

-- ===== CREATE HELPER FUNCTIONS FOR BUSINESS CONTEXT =====

-- Function to set current business context
CREATE OR REPLACE FUNCTION set_current_business_id(business_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_business_id', business_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current business ID
CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_business_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== BUSINESS POLICIES =====

-- Businesses can only see their own data
CREATE POLICY "business_isolation" ON "businesses"
  FOR ALL
  USING (id = get_current_business_id()::TEXT);

-- ===== USER POLICIES =====

-- Users can only see users from their business
CREATE POLICY "user_business_isolation" ON "users"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== LOCATION POLICIES =====

-- Locations can only be accessed by their business
CREATE POLICY "location_business_isolation" ON "locations"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- Operating hours can only be accessed by their business (via location)
CREATE POLICY "operating_hours_business_isolation" ON "operating_hours"
  FOR ALL
  USING (
    location_id IN (
      SELECT id FROM "locations" 
      WHERE business_id = get_current_business_id()::TEXT
    )
  );

-- ===== CATEGORY POLICIES =====

-- Categories can only be accessed by their business
CREATE POLICY "category_business_isolation" ON "categories"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== MENU ITEM POLICIES =====

-- Menu items can only be accessed by their business
CREATE POLICY "menu_item_business_isolation" ON "menu_items"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== POLICY POLICIES =====

-- Policies can only be accessed by their business
CREATE POLICY "policy_business_isolation" ON "policies"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== KNOWLEDGE BASE POLICIES =====

-- Knowledge base can only be accessed by their business
CREATE POLICY "knowledge_base_business_isolation" ON "knowledge_base"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== API KEY POLICIES =====

-- API keys can only be accessed by their business
CREATE POLICY "api_key_business_isolation" ON "api_keys"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== SUBSCRIPTION POLICIES =====

-- Subscriptions can only be accessed by their business
CREATE POLICY "subscription_business_isolation" ON "subscriptions"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== USAGE METRIC POLICIES =====

-- Usage metrics can only be accessed by their business
CREATE POLICY "usage_metric_business_isolation" ON "usage_metrics"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== QUERY LOG POLICIES =====

-- Query logs can only be accessed by their business
CREATE POLICY "query_log_business_isolation" ON "query_logs"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== LEGACY TABLE POLICIES =====

-- Legacy menu items can only be accessed by their business
CREATE POLICY "menu_business_isolation" ON "menus"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- Orders can only be accessed by their business
CREATE POLICY "order_business_isolation" ON "orders"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- Powerups can only be accessed by their business
CREATE POLICY "powerup_business_isolation" ON "powerups"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- Business policies can only be accessed by their business
CREATE POLICY "business_policy_business_isolation" ON "business_policies"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- Business integrations can only be accessed by their business
CREATE POLICY "business_integration_business_isolation" ON "business_integrations"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== EMBEDDING POLICIES =====

-- Embeddings can only be accessed by their business
CREATE POLICY "embedding_business_isolation" ON "embeddings"
  FOR ALL
  USING (business_id = get_current_business_id()::TEXT);

-- ===== GRANT PERMISSIONS =====

-- Grant execute permissions on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION set_current_business_id(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_business_id() TO PUBLIC;

-- ===== COMMENTS =====

COMMENT ON FUNCTION set_current_business_id(TEXT) IS 'Sets the current business context for RLS policies';
COMMENT ON FUNCTION get_current_business_id() IS 'Gets the current business context for RLS policies';

-- ===== VERIFICATION QUERIES =====
-- 
-- To test RLS policies, run these queries:
--
-- 1. Set business context:
--    SELECT set_current_business_id('your-business-id-here');
--
-- 2. Test business isolation:
--    SELECT * FROM businesses; -- Should only show current business
--    SELECT * FROM users; -- Should only show users from current business
--    SELECT * FROM menu_items; -- Should only show menu items from current business
--
-- 3. Test cross-tenant isolation:
--    SELECT set_current_business_id('different-business-id');
--    SELECT * FROM businesses; -- Should show different business data
--
-- =====================================================
