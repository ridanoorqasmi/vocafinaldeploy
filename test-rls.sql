-- 1. Set business context to Business A
SELECT set_current_business_id('cmfb5kmmk00001oluz6vvyvsu');
\echo '---- Business A ----'

-- Users
SELECT 'users' AS table, id, email, "businessId" FROM "users";
-- Menu Items
SELECT 'menu_items' AS table, id, name, "businessId" FROM "menu_items";
-- Policies
SELECT 'policies' AS table, id, title, "businessId" FROM "policies";
-- Knowledge Base
SELECT 'knowledge_base' AS table, id, title, "businessId" FROM "knowledge_base";
-- Orders
SELECT 'orders' AS table, id, status, "businessId" FROM "orders";

-- 2. Switch to Business B
SELECT set_current_business_id('cmfb5kmnw000210u81vsa6zo');
\echo '---- Business B ----'

-- Users
SELECT 'users' AS table, id, email, "businessId" FROM "users";
-- Menu Items
SELECT 'menu_items' AS table, id, name, "businessId" FROM "menu_items";
-- Policies
SELECT 'policies' AS table, id, title, "businessId" FROM "policies";
-- Knowledge Base
SELECT 'knowledge_base' AS table, id, title, "businessId" FROM "knowledge_base";
-- Orders
SELECT 'orders' AS table, id, status, "businessId" FROM "orders";

-- 3. Switch to Business C (Demo Pizza)
SELECT set_current_business_id('cmfb5kmo20004101ub1bcoytf');
\echo '---- Business C (Demo Pizza) ----'

-- Users
SELECT 'users' AS table, id, email, "businessId" FROM "users";
-- Menu Items
SELECT 'menu_items' AS table, id, name, "businessId" FROM "menu_items";
-- Policies
SELECT 'policies' AS table, id, title, "businessId" FROM "policies";
-- Knowledge Base
SELECT 'knowledge_base' AS table, id, title, "businessId" FROM "knowledge_base";
-- Orders
SELECT 'orders' AS table, id, status, "businessId" FROM "orders";
