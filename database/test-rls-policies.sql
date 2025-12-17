-- =====================================================
-- TEST SCRIPT FOR RLS POLICIES
-- =====================================================
-- 
-- This script tests the Row-Level Security policies
-- Run this AFTER applying the RLS policies
-- =====================================================

-- ===== SETUP TEST DATA =====

-- Create test businesses (if they don't exist)
INSERT INTO businesses (id, name, slug, email, password_hash, status) 
VALUES 
  ('test-business-1', 'Test Restaurant 1', 'test-restaurant-1', 'test1@example.com', 'hashed-password', 'ACTIVE'),
  ('test-business-2', 'Test Restaurant 2', 'test-restaurant-2', 'test2@example.com', 'hashed-password', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Create test users
INSERT INTO users (id, business_id, email, password_hash, first_name, last_name, role) 
VALUES 
  ('test-user-1', 'test-business-1', 'user1@test1.com', 'hashed-password', 'John', 'Doe', 'OWNER'),
  ('test-user-2', 'test-business-2', 'user2@test2.com', 'hashed-password', 'Jane', 'Smith', 'OWNER')
ON CONFLICT (business_id, email) DO NOTHING;

-- Create test menu items
INSERT INTO menu_items (id, business_id, name, description, price, is_available) 
VALUES 
  ('test-menu-1', 'test-business-1', 'Pizza Margherita', 'Classic pizza with tomato and mozzarella', 12.99, true),
  ('test-menu-2', 'test-business-1', 'Caesar Salad', 'Fresh romaine lettuce with caesar dressing', 8.99, true),
  ('test-menu-3', 'test-business-2', 'Burger Deluxe', 'Beef burger with fries', 15.99, true),
  ('test-menu-4', 'test-business-2', 'Fish & Chips', 'Beer-battered fish with chips', 13.99, true)
ON CONFLICT (id) DO NOTHING;

-- ===== TEST RLS POLICIES =====

-- Test 1: Set business context for Business 1
SELECT 'TEST 1: Setting business context for Business 1' as test_description;
SELECT set_current_business_id('test-business-1');

-- Test 2: Verify Business 1 can only see their own data
SELECT 'TEST 2: Business 1 should only see their own business record' as test_description;
SELECT id, name, email FROM businesses;

SELECT 'TEST 2: Business 1 should only see their own users' as test_description;
SELECT id, email, first_name, last_name FROM users;

SELECT 'TEST 2: Business 1 should only see their own menu items' as test_description;
SELECT id, name, price FROM menu_items;

-- Test 3: Switch to Business 2 context
SELECT 'TEST 3: Switching to Business 2 context' as test_description;
SELECT set_current_business_id('test-business-2');

-- Test 4: Verify Business 2 can only see their own data
SELECT 'TEST 4: Business 2 should only see their own business record' as test_description;
SELECT id, name, email FROM businesses;

SELECT 'TEST 4: Business 2 should only see their own users' as test_description;
SELECT id, email, first_name, last_name FROM users;

SELECT 'TEST 4: Business 2 should only see their own menu items' as test_description;
SELECT id, name, price FROM menu_items;

-- Test 5: Test with invalid business ID
SELECT 'TEST 5: Testing with invalid business ID' as test_description;
SELECT set_current_business_id('invalid-business-id');

SELECT 'TEST 5: Should return no results for invalid business' as test_description;
SELECT id, name, email FROM businesses;
SELECT id, email, first_name, last_name FROM users;
SELECT id, name, price FROM menu_items;

-- Test 6: Test with NULL business ID
SELECT 'TEST 6: Testing with NULL business ID' as test_description;
SELECT set_current_business_id(NULL);

SELECT 'TEST 6: Should return no results for NULL business' as test_description;
SELECT id, name, email FROM businesses;
SELECT id, email, first_name, last_name FROM users;
SELECT id, name, price FROM menu_items;

-- ===== VERIFICATION QUERIES =====

-- Check current business context
SELECT 'Current business context:' as info, get_current_business_id() as current_business_id;

-- Count records visible to each business
SELECT 'Business 1 context - Record counts:' as info;
SELECT set_current_business_id('test-business-1');
SELECT 
  (SELECT COUNT(*) FROM businesses) as businesses_count,
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM menu_items) as menu_items_count;

SELECT 'Business 2 context - Record counts:' as info;
SELECT set_current_business_id('test-business-2');
SELECT 
  (SELECT COUNT(*) FROM businesses) as businesses_count,
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM menu_items) as menu_items_count;

-- ===== CLEANUP (OPTIONAL) =====
-- Uncomment these lines to clean up test data

-- DELETE FROM menu_items WHERE id LIKE 'test-menu-%';
-- DELETE FROM users WHERE id LIKE 'test-user-%';
-- DELETE FROM businesses WHERE id LIKE 'test-business-%';

-- =====================================================
-- EXPECTED RESULTS:
-- 
-- 1. Each business should only see their own records
-- 2. Switching business context should show different data
-- 3. Invalid/NULL business IDs should return no results
-- 4. Record counts should match expected values per business
-- 
-- If any test fails, check that RLS policies are properly applied
-- =====================================================

