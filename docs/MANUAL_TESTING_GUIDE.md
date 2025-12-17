# Manual Testing Guide

## 🧪 Complete Manual Testing Instructions

This guide will walk you through testing every component we implemented manually.

## 📋 Prerequisites

1. **Database Setup**
   ```bash
   # Make sure your database is running
   # Check your .env file has DATABASE_URL
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Apply Schema**
   ```bash
   npm run db:migrate
   ```

## 🚀 Step 1: Apply Performance Indexes

### 1.1 Apply the Indexes
```bash
# Navigate to your project directory
cd "C:\Users\AA COMPUTER\Desktop\VOCA - AI"

# Apply performance indexes
psql -d your_database_name -f database/performance-indexes.sql
```

**Expected Output:**
```
CREATE INDEX
CREATE INDEX
CREATE INDEX
... (multiple CREATE INDEX messages)
```

### 1.2 Verify Indexes Were Created
```sql
-- Connect to your database and run:
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY indexname;
```

**Expected:** You should see all the performance indexes we created.

## 🔒 Step 2: Apply RLS Policies

### 2.1 Apply RLS Policies
```bash
psql -d your_database_name -f database/rls-policies.sql
```

**Expected Output:**
```
ALTER TABLE
CREATE FUNCTION
CREATE FUNCTION
CREATE POLICY
... (multiple policy creation messages)
```

### 2.2 Verify RLS is Enabled
```sql
-- Check RLS is enabled on tables
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relkind = 'r' 
AND relname IN ('businesses', 'users', 'menu_items', 'orders')
ORDER BY relname;
```

**Expected:** All should show `relrowsecurity = true`

### 2.3 Test RLS Helper Functions
```sql
-- Test setting business context
SELECT set_current_business_id('test-business-id');

-- Test getting business context
SELECT get_current_business_id();
```

**Expected:** Functions should execute without errors.

## 🌱 Step 3: Test Database Seeding

### 3.1 Run the Seed Script
```bash
npm run db:seed
```

**Expected Output:**
```
🚀 Starting database seeding...

🧹 Clearing existing data...
✅ Existing data cleared

🌱 Seeding businesses...
✅ Created 5 businesses

👥 Seeding users...
✅ Created 12 users

📍 Seeding locations...
✅ Created 8 locations with operating hours

🍕 Seeding menu items...
✅ Created 85 menu items

📋 Seeding policies...
✅ Created 18 policies

📚 Seeding knowledge base...
✅ Created 45 knowledge base entries

🔑 Seeding API keys...
✅ Created 12 API keys

💳 Seeding subscriptions...
✅ Created 5 subscriptions

📊 Seeding usage metrics...
✅ Created 150 usage metrics

📝 Seeding query logs...
✅ Created 300 query logs

🛒 Seeding orders...
✅ Created 75 orders

🎉 Seeding completed successfully!

📊 Summary:
   Businesses: 5
   Users: 12
   Locations: 8
   Menu Items: 85
   Policies: 18
   Knowledge Base: 45
   API Keys: 12
   Subscriptions: 5
   Usage Metrics: 150
   Query Logs: 300
   Orders: 75

🔑 Sample Business for API Testing:
   ID: [some-cuid]
   Name: [random company name]
   Email: [random email]
   Slug: [random slug]
```

### 3.2 Verify Data Was Created
```sql
-- Check business count
SELECT COUNT(*) FROM businesses;

-- Check users count
SELECT COUNT(*) FROM users;

-- Check menu items count
SELECT COUNT(*) FROM menu_items;

-- Check orders count
SELECT COUNT(*) FROM orders;
```

**Expected:** You should see the counts match the summary from seeding.

## 🧪 Step 4: Test Validation Constraints

### 4.1 Test Email Validation
```sql
-- This should FAIL (invalid email format)
INSERT INTO businesses (name, slug, email, password_hash, status) 
VALUES ('Test', 'test', 'invalid-email', 'hashed', 'ACTIVE');
```

**Expected:** Error about email format constraint.

### 4.2 Test Price Validation
```sql
-- Get a business ID first
SELECT id FROM businesses LIMIT 1;

-- This should FAIL (negative price)
INSERT INTO menu_items (business_id, name, price) 
VALUES ('[business-id-from-above]', 'Test Item', -10.99);
```

**Expected:** Error about price constraint.

### 4.3 Test Unique Constraints
```sql
-- Get an existing business email
SELECT email FROM businesses LIMIT 1;

-- This should FAIL (duplicate email)
INSERT INTO businesses (name, slug, email, password_hash, status) 
VALUES ('Test', 'test-unique', '[email-from-above]', 'hashed', 'ACTIVE');
```

**Expected:** Error about unique constraint violation.

## 🔒 Step 5: Test Multi-Tenant Isolation

### 5.1 Create Test Businesses
```sql
-- Create two test businesses
INSERT INTO businesses (name, slug, email, password_hash, status) 
VALUES 
  ('Isolation Test 1', 'isolation-test-1', 'isolation1@test.com', 'hashed', 'ACTIVE'),
  ('Isolation Test 2', 'isolation-test-2', 'isolation2@test.com', 'hashed', 'ACTIVE');

-- Get their IDs
SELECT id, name FROM businesses WHERE slug LIKE 'isolation-test-%';
```

### 5.2 Create Test Data for Each Business
```sql
-- Replace [business1-id] and [business2-id] with actual IDs from above
INSERT INTO users (business_id, email, password_hash, first_name, last_name, role) 
VALUES 
  ('[business1-id]', 'user1@test1.com', 'hashed', 'User', 'One', 'OWNER'),
  ('[business2-id]', 'user2@test2.com', 'hashed', 'User', 'Two', 'OWNER');

INSERT INTO menu_items (business_id, name, price) 
VALUES 
  ('[business1-id]', 'Business 1 Item', 10.99),
  ('[business2-id]', 'Business 2 Item', 15.99);
```

### 5.3 Test RLS Isolation
```sql
-- Set context for business 1
SELECT set_current_business_id('[business1-id]');

-- Try to see business 1's data (should work)
SELECT * FROM businesses WHERE id = '[business1-id]';

-- Try to see business 2's data (should return empty)
SELECT * FROM businesses WHERE id = '[business2-id]';

-- Try to see business 1's users (should work)
SELECT * FROM users WHERE business_id = '[business1-id]';

-- Try to see business 2's users (should return empty)
SELECT * FROM users WHERE business_id = '[business2-id]';
```

**Expected:** Business 1 can only see its own data, not Business 2's data.

### 5.4 Clean Up Test Data
```sql
-- Delete test businesses (this will cascade delete related data)
DELETE FROM businesses WHERE slug LIKE 'isolation-test-%';
```

## ⚡ Step 6: Test Performance

### 6.1 Test Query Performance
```sql
-- Get a business with many menu items
SELECT b.id, b.name, COUNT(mi.id) as menu_count
FROM businesses b
LEFT JOIN menu_items mi ON b.id = mi.business_id
GROUP BY b.id, b.name
ORDER BY menu_count DESC
LIMIT 1;
```

### 6.2 Test Index Usage
```sql
-- Test a query that should use indexes
EXPLAIN ANALYZE 
SELECT * FROM menu_items 
WHERE business_id = '[business-id-from-above]' 
AND is_available = true
ORDER BY created_at DESC;
```

**Expected:** Should show "Index Scan" not "Seq Scan" and complete quickly.

### 6.3 Test Full-Text Search
```sql
-- Test full-text search on menu items
SELECT name, description, 
       ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')), 
               plainto_tsquery('english', 'pizza')) as rank
FROM menu_items 
WHERE to_tsvector('english', name || ' ' || COALESCE(description, '')) 
      @@ plainto_tsquery('english', 'pizza')
ORDER BY rank DESC
LIMIT 5;
```

**Expected:** Should return menu items containing "pizza" with relevance ranking.

## 🧪 Step 7: Run Automated Tests

### 7.1 Run Schema Validation
```bash
npm run validate:migration
```

**Expected Output:**
```
🔍 Starting Schema Validation...

✅ Tables Exist - 45ms - All 17 tables exist
✅ Indexes Exist - 23ms - All 7 performance indexes exist
✅ Constraints Exist - 18ms - All 5 validation constraints exist
✅ RLS Policies - 31ms - RLS enabled and policies exist for all 10 tables
✅ Multi-Tenant Isolation - 156ms - RLS properly isolates tenant data
✅ Cascade Deletion - 89ms - Business deletion properly cascades to related records
✅ Performance - 67ms - Query completed in 67ms (target: <100ms)
✅ Data Integrity - 45ms - Unique and check constraints working properly

📊 Validation Results:
================================================================================
✅ Tables Exist                    45ms - All 17 tables exist
✅ Indexes Exist                   23ms - All 7 performance indexes exist
✅ Constraints Exist               18ms - All 5 validation constraints exist
✅ RLS Policies                    31ms - RLS enabled and policies exist for all 10 tables
✅ Multi-Tenant Isolation         156ms - RLS properly isolates tenant data
✅ Cascade Deletion                89ms - Business deletion properly cascades to related records
✅ Performance                     67ms - Query completed in 67ms (target: <100ms)
✅ Data Integrity                  45ms - Unique and check constraints working properly
================================================================================
Total: 8 | Passed: 8 | Failed: 0

✅ All validations passed!
```

### 7.2 Run Test Suite
```bash
npm run test:schema
```

**Expected Output:**
```
✓ tests/schema.test.ts (8)
  ✓ Database Schema Tests (8)
    ✓ Multi-Tenant Isolation (3)
      ✓ should prevent cross-tenant data access via RLS
      ✓ should isolate menu items between businesses
      ✓ should isolate orders between businesses
    ✓ Cascade Deletion (2)
      ✓ should cascade delete related records when business is deleted
      ✓ should handle soft deletes properly
    ✓ Performance Tests (2)
      ✓ should complete queries within 100ms for seeded data
      ✓ should use indexes for common query patterns
    ✓ Data Integrity Tests (4)
      ✓ should enforce unique constraints
      ✓ should enforce check constraints
      ✓ should enforce email format validation
      ✓ should enforce phone format validation
    ✓ Full-Text Search (1)
      ✓ should perform full-text search on menu items

Test Files  1 passed (1)
Tests  8 passed (8)
```

## 📊 Step 8: Test Monitoring Views

### 8.1 Check Slow Queries View
```sql
SELECT * FROM slow_queries LIMIT 5;
```

**Expected:** Should show any queries that took >1000ms.

### 8.2 Check Business Usage Summary
```sql
SELECT * FROM business_usage_summary LIMIT 3;
```

**Expected:** Should show business statistics.

### 8.3 Check Index Usage Stats
```sql
SELECT * FROM get_index_usage_stats() LIMIT 10;
```

**Expected:** Should show index usage statistics.

## 🔧 Step 9: Test Maintenance Functions

### 9.1 Test Table Analysis
```sql
SELECT analyze_all_tables();
```

**Expected:** Should complete without errors.

### 9.2 Test Table Maintenance
```sql
SELECT maintain_table('menu_items');
```

**Expected:** Should complete without errors.

## 🎯 Step 10: Test API Integration

### 10.1 Test Business Context Setting
```typescript
// Create a test file: test-api.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBusinessContext() {
  // Get a business ID
  const business = await prisma.business.findFirst();
  if (!business) {
    console.log('No businesses found. Run seeding first.');
    return;
  }

  // Set business context
  await prisma.$executeRaw`SELECT set_current_business_id(${business.id})`;

  // Test that we can only see this business's data
  const menuItems = await prisma.$queryRaw`
    SELECT * FROM menu_items WHERE business_id = ${business.id};
  `;

  console.log(`Found ${(menuItems as any[]).length} menu items for business ${business.name}`);
}

testBusinessContext().finally(() => prisma.$disconnect());
```

```bash
# Run the test
npx ts-node test-api.ts
```

**Expected:** Should show menu items for the business.

## 🚨 Troubleshooting

### Common Issues:

1. **"Table doesn't exist"**
   - Run: `npm run db:migrate`

2. **"Index already exists"**
   - This is normal, indexes are created with `IF NOT EXISTS`

3. **"RLS policy already exists"**
   - This is normal, policies use `CREATE OR REPLACE`

4. **"Permission denied"**
   - Make sure your database user has proper permissions

5. **"Connection refused"**
   - Check your DATABASE_URL in .env file

### Reset Everything:
```bash
# Drop and recreate database
# Then run:
npm run db:migrate
psql -d your_database -f database/performance-indexes.sql
psql -d your_database -f database/rls-policies.sql
npm run db:seed
```

## ✅ Success Criteria

You've successfully tested everything if:

- ✅ All indexes were created
- ✅ RLS policies are enabled
- ✅ Seeding created realistic data
- ✅ Validation constraints work
- ✅ Multi-tenant isolation works
- ✅ Queries are fast (<100ms)
- ✅ Full-text search works
- ✅ Automated tests pass
- ✅ Monitoring views work
- ✅ Maintenance functions work

**🎉 Congratulations! Your database is production-ready!**
