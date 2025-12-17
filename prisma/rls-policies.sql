-- ===================================================
-- Helper Functions for RLS Context
-- ===================================================
CREATE OR REPLACE FUNCTION set_current_business_id(businessId text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_business_id', businessId, false);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_current_business_id()
RETURNS text AS $$
BEGIN
  RETURN current_setting('app.current_business_id', true);
END;
$$ LANGUAGE plpgsql;

-- ===================================================
-- USERS
-- ===================================================
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolation ON "users";
CREATE POLICY user_isolation ON "users"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- BUSINESSES
-- ===================================================
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "businesses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_isolation ON "businesses";
CREATE POLICY business_isolation ON "businesses"
  FOR SELECT TO voca_app
  USING (id = current_setting('app.current_business_id', true));

-- ===================================================
-- LOCATIONS
-- ===================================================
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS location_isolation ON "locations";
CREATE POLICY location_isolation ON "locations"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- CATEGORIES
-- ===================================================
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS category_isolation ON "categories";
CREATE POLICY category_isolation ON "categories"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- MENU ITEMS
-- ===================================================
ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "menu_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_item_isolation ON "menu_items";
CREATE POLICY menu_item_isolation ON "menu_items"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- POLICIES
-- ===================================================
ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_isolation ON "policies";
CREATE POLICY policy_isolation ON "policies"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- KNOWLEDGE BASE
-- ===================================================
ALTER TABLE "knowledge_base" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_base" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kb_isolation ON "knowledge_base";
CREATE POLICY kb_isolation ON "knowledge_base"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- API KEYS
-- ===================================================
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apikey_isolation ON "api_keys";
CREATE POLICY apikey_isolation ON "api_keys"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- SUBSCRIPTIONS
-- ===================================================
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_isolation ON "subscriptions";
CREATE POLICY subscription_isolation ON "subscriptions"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- USAGE METRICS
-- ===================================================
ALTER TABLE "usage_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_metrics" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_isolation ON "usage_metrics";
CREATE POLICY usage_isolation ON "usage_metrics"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- QUERY LOGS
-- ===================================================
ALTER TABLE "query_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "query_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS querylog_isolation ON "query_logs";
CREATE POLICY querylog_isolation ON "query_logs"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

-- ===================================================
-- LEGACY TABLES
-- ===================================================
ALTER TABLE "menus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "menus" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_isolation ON "menus";
CREATE POLICY menu_isolation ON "menus"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_isolation ON "orders";
CREATE POLICY order_isolation ON "orders"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

ALTER TABLE "powerups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "powerups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS powerup_isolation ON "powerups";
CREATE POLICY powerup_isolation ON "powerups"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

ALTER TABLE "business_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_policies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bizpol_isolation ON "business_policies";
CREATE POLICY bizpol_isolation ON "business_policies"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));

ALTER TABLE "business_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_integrations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bizint_isolation ON "business_integrations";
CREATE POLICY bizint_isolation ON "business_integrations"
  FOR SELECT TO voca_app
  USING ("businessId" = current_setting('app.current_business_id', true));
