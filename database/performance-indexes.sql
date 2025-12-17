-- ===== PERFORMANCE INDEXES & VALIDATION CONSTRAINTS =====
-- Run this after applying the main schema migration

-- ===== COMPOSITE INDEXES FOR COMMON QUERY PATTERNS =====

-- Orders: status + created_at for order management queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created_at 
ON orders (status, created_at DESC) 
WHERE deleted_at IS NULL;

-- Subscriptions: status + period_end for billing queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_period_end 
ON subscriptions (status, current_period_end) 
WHERE status IN ('ACTIVE', 'TRIAL', 'PAST_DUE');

-- Usage metrics: business + type + date for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_business_type_date 
ON usage_metrics (business_id, type, date DESC);

-- Query logs: business + status + created_at for monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_logs_business_status_created 
ON query_logs (business_id, status, created_at DESC);

-- Menu items: business + category + available for menu queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_business_category_available 
ON menu_items (business_id, category_id, is_available) 
WHERE deleted_at IS NULL;

-- Users: business + role + active for user management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_business_role_active 
ON users (business_id, role, is_active) 
WHERE deleted_at IS NULL;

-- ===== FULL-TEXT SEARCH INDEXES =====

-- Menu items search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_search 
ON menu_items USING gin(to_tsvector('english', name || ' ' || COALESCE(description, ''))) 
WHERE deleted_at IS NULL;

-- Knowledge base search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_search 
ON knowledge_base USING gin(to_tsvector('english', title || ' ' || content)) 
WHERE deleted_at IS NULL;

-- Business search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_search 
ON businesses USING gin(to_tsvector('english', name || ' ' || COALESCE(description, ''))) 
WHERE deleted_at IS NULL;

-- ===== PARTIAL INDEXES FOR SOFT DELETES =====

-- Active businesses only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_active 
ON businesses (id, status, created_at) 
WHERE deleted_at IS NULL;

-- Active users only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
ON users (id, role, is_active) 
WHERE deleted_at IS NULL;

-- Active menu items only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_active 
ON menu_items (id, category_id, is_available) 
WHERE deleted_at IS NULL;

-- Active categories only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_active 
ON categories (id, sort_order) 
WHERE deleted_at IS NULL;

-- Active policies only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_policies_active 
ON policies (id, type, is_active) 
WHERE deleted_at IS NULL;

-- Active knowledge base only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_active 
ON knowledge_base (id, category, is_active) 
WHERE deleted_at IS NULL;

-- Active API keys only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_active 
ON api_keys (id, status, last_used_at) 
WHERE deleted_at IS NULL;

-- ===== VALIDATION CONSTRAINTS =====

-- Email validation for businesses
ALTER TABLE businesses 
ADD CONSTRAINT chk_business_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Email validation for users
ALTER TABLE users 
ADD CONSTRAINT chk_user_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Phone validation (10+ digits if provided)
ALTER TABLE businesses 
ADD CONSTRAINT chk_business_phone_format 
CHECK (phone IS NULL OR length(replace(replace(replace(phone, '(', ''), ')', ''), '-', '')) >= 10);

-- Phone validation for locations
ALTER TABLE locations 
ADD CONSTRAINT chk_location_phone_format 
CHECK (phone IS NULL OR length(replace(replace(replace(phone, '(', ''), ')', ''), '-', '')) >= 10);

-- Price validation (positive)
ALTER TABLE menu_items 
ADD CONSTRAINT chk_menu_item_price_positive 
CHECK (price > 0);

-- Price validation for legacy menus
ALTER TABLE menus 
ADD CONSTRAINT chk_menu_price_positive 
CHECK (price > 0);

-- Order total validation (non-negative)
ALTER TABLE orders 
ADD CONSTRAINT chk_order_total_non_negative 
CHECK (total_price >= 0);

-- Tax rate validation (0-100%)
ALTER TABLE business_policies 
ADD CONSTRAINT chk_tax_rate_valid 
CHECK (tax_rate >= 0 AND tax_rate <= 100);

-- Usage count validation (positive)
ALTER TABLE usage_metrics 
ADD CONSTRAINT chk_usage_count_positive 
CHECK (count > 0);

-- Response time validation (positive if provided)
ALTER TABLE query_logs 
ADD CONSTRAINT chk_response_time_positive 
CHECK (response_time IS NULL OR response_time > 0);

-- Day of week validation (0-6)
ALTER TABLE operating_hours 
ADD CONSTRAINT chk_day_of_week_valid 
CHECK (day_of_week >= 0 AND day_of_week <= 6);

-- Time format validation (HH:MM)
ALTER TABLE operating_hours 
ADD CONSTRAINT chk_time_format 
CHECK (open_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' AND close_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');

-- ===== UNIQUE CONSTRAINTS =====

-- Ensure unique business slug (case insensitive)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_slug_unique 
ON businesses (lower(slug)) 
WHERE deleted_at IS NULL;

-- Ensure unique business email (case insensitive)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_email_unique 
ON businesses (lower(email)) 
WHERE deleted_at IS NULL;

-- Ensure unique user email per business (case insensitive)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_business_email_unique 
ON users (business_id, lower(email)) 
WHERE deleted_at IS NULL;

-- ===== PERFORMANCE MONITORING VIEWS =====

-- View for slow queries monitoring
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
  business_id,
  query,
  status,
  response_time,
  created_at,
  CASE 
    WHEN response_time > 5000 THEN 'CRITICAL'
    WHEN response_time > 1000 THEN 'WARNING'
    ELSE 'OK'
  END as performance_level
FROM query_logs 
WHERE response_time IS NOT NULL 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY response_time DESC;

-- View for business usage analytics
CREATE OR REPLACE VIEW business_usage_summary AS
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.status as business_status,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT mi.id) as menu_item_count,
  COUNT(DISTINCT o.id) as order_count,
  COUNT(DISTINCT ql.id) as query_count,
  AVG(ql.response_time) as avg_response_time,
  MAX(ql.created_at) as last_activity
FROM businesses b
LEFT JOIN users u ON b.id = u.business_id AND u.deleted_at IS NULL
LEFT JOIN menu_items mi ON b.id = mi.business_id AND mi.deleted_at IS NULL
LEFT JOIN orders o ON b.id = o.business_id AND o.deleted_at IS NULL
LEFT JOIN query_logs ql ON b.id = ql.business_id
WHERE b.deleted_at IS NULL
GROUP BY b.id, b.name, b.status;

-- ===== INDEX USAGE STATISTICS =====

-- Function to get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
  schemaname text,
  tablename text,
  indexname text,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.schemaname::text,
    s.tablename::text,
    s.indexname::text,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch
  FROM pg_stat_user_indexes s
  WHERE s.schemaname = 'public'
  ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- ===== MAINTENANCE FUNCTIONS =====

-- Function to analyze all tables for query optimization
CREATE OR REPLACE FUNCTION analyze_all_tables()
RETURNS void AS $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE 'ANALYZE ' || quote_ident(table_name);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to vacuum and analyze specific table
CREATE OR REPLACE FUNCTION maintain_table(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE 'VACUUM ANALYZE ' || quote_ident(table_name);
END;
$$ LANGUAGE plpgsql;

-- ===== COMMENTS FOR DOCUMENTATION =====

COMMENT ON INDEX idx_orders_status_created_at IS 'Composite index for order management queries by status and creation time';
COMMENT ON INDEX idx_subscriptions_status_period_end IS 'Composite index for billing queries by subscription status and period end';
COMMENT ON INDEX idx_usage_metrics_business_type_date IS 'Composite index for usage analytics by business, type, and date';
COMMENT ON INDEX idx_menu_items_search IS 'Full-text search index for menu items name and description';
COMMENT ON INDEX idx_knowledge_base_search IS 'Full-text search index for knowledge base title and content';
COMMENT ON INDEX idx_businesses_active IS 'Partial index for active businesses only';
COMMENT ON INDEX idx_users_active IS 'Partial index for active users only';
COMMENT ON INDEX idx_menu_items_active IS 'Partial index for active menu items only';

COMMENT ON VIEW slow_queries IS 'View for monitoring slow queries and performance issues';
COMMENT ON VIEW business_usage_summary IS 'View for business usage analytics and monitoring';
COMMENT ON FUNCTION get_index_usage_stats() IS 'Function to get index usage statistics for performance monitoring';
COMMENT ON FUNCTION analyze_all_tables() IS 'Function to analyze all tables for query optimization';
COMMENT ON FUNCTION maintain_table(text) IS 'Function to vacuum and analyze a specific table';
