# API Team Development Guide

## 🚀 Quick Start

### 1. Database Setup
```bash
# Install dependencies
npm install

# Apply schema migrations
npm run db:migrate

# Apply performance indexes and constraints
psql -d your_database -f database/performance-indexes.sql

# Apply RLS policies
psql -d your_database -f database/rls-policies.sql

# Seed test data
npm run db:seed
```

### 2. Run Tests
```bash
# Run all tests
npm test

# Run schema validation tests only
npm run test:schema

# Validate migration
npm run validate:migration
```

## 🔑 Sample Business for Testing

After running `npm run db:seed`, you'll get a sample business with the following details:

```
Business ID: [generated-cuid]
Name: [random company name]
Email: [random email]
Slug: [random slug]
```

Use this business ID for all your API testing.

## 📊 Database Schema Overview

### Core Tables
- **businesses** - Main tenant table
- **users** - Business users with roles
- **locations** - Business locations with operating hours
- **categories** - Menu categories
- **menu_items** - Menu items with full-text search
- **policies** - Business policies
- **knowledge_base** - AI knowledge base
- **api_keys** - API authentication
- **subscriptions** - Billing subscriptions
- **usage_metrics** - Usage tracking
- **query_logs** - AI query logs
- **orders** - Order management

### Performance Features
- **Composite Indexes** - Optimized for common query patterns
- **Full-Text Search** - Menu items and knowledge base
- **Partial Indexes** - Active records only
- **RLS Policies** - Multi-tenant isolation

## 🔒 Multi-Tenant Security

### Row-Level Security (RLS)
All tables have RLS enabled with business isolation:

```typescript
// Set business context before queries
await prisma.$executeRaw`SELECT set_current_business_id(${businessId})`;

// All subsequent queries are automatically scoped to this business
const menuItems = await prisma.menuItem.findMany();
```

### Helper Functions
```typescript
import { setBusinessContext, createBusinessScopedClient } from '@/lib/auth';

// Method 1: Set context globally
await setBusinessContext(businessId);

// Method 2: Create scoped client
const scopedPrisma = createBusinessScopedClient(businessId);
const menuItems = await scopedPrisma.menuItem.findMany();
```

## 🚀 Performance Optimization

### Indexes Applied
- **Composite Indexes**: `(status, created_at)`, `(business_id, type, date)`
- **Full-Text Search**: Menu items and knowledge base content
- **Partial Indexes**: Active records only (excludes soft-deleted)

### Query Performance
- All queries should complete in <100ms for seeded data
- Use `EXPLAIN ANALYZE` to check query plans
- Monitor slow queries via `slow_queries` view

### Maintenance Functions
```sql
-- Analyze all tables
SELECT analyze_all_tables();

-- Get index usage stats
SELECT * FROM get_index_usage_stats();

-- Maintain specific table
SELECT maintain_table('menu_items');
```

## 🧪 Testing

### Schema Validation Tests
```bash
npm run test:schema
```

Tests include:
- ✅ Multi-tenant isolation
- ✅ Cascade deletion
- ✅ Performance (<100ms queries)
- ✅ Data integrity constraints
- ✅ Full-text search
- ✅ RLS policies

### Test Data
- 5 sample businesses
- 1-3 users per business
- 1-2 locations per business
- 10-25 menu items per business
- 2-5 policies per business
- 5-15 knowledge base entries per business
- 1-3 API keys per business
- 10-50 usage metrics per business
- 20-100 query logs per business
- 5-20 orders per business

## 📈 Monitoring

### Performance Views
```sql
-- Monitor slow queries
SELECT * FROM slow_queries;

-- Business usage summary
SELECT * FROM business_usage_summary;

-- Index usage statistics
SELECT * FROM get_index_usage_stats();
```

### Key Metrics
- Query response times
- Index usage
- RLS policy effectiveness
- Multi-tenant isolation
- Data integrity

## 🔧 Development Workflow

### 1. Schema Changes
```bash
# Make changes to prisma/schema.prisma
npm run db:migrate

# Apply performance indexes
psql -d your_database -f database/performance-indexes.sql

# Apply RLS policies
psql -d your_database -f database/rls-policies.sql

# Validate changes
npm run validate:migration
```

### 2. Testing Changes
```bash
# Run tests
npm run test:schema

# Check performance
npm run validate:migration
```

### 3. Seeding New Data
```bash
# Clear and reseed
npm run db:seed
```

## 🚨 Common Issues

### RLS Context Not Set
```typescript
// ❌ This will fail - no business context
const menuItems = await prisma.menuItem.findMany();

// ✅ This will work - business context set
await setBusinessContext(businessId);
const menuItems = await prisma.menuItem.findMany();
```

### Performance Issues
```sql
-- Check if indexes are being used
EXPLAIN ANALYZE SELECT * FROM menu_items WHERE business_id = 'xxx';

-- Look for Seq Scan (bad) vs Index Scan (good)
```

### Constraint Violations
```typescript
// ❌ This will fail - negative price
await prisma.menuItem.create({
  data: { businessId, name: 'Item', price: -10.99 }
});

// ✅ This will work - positive price
await prisma.menuItem.create({
  data: { businessId, name: 'Item', price: 10.99 }
});
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Business registration
- `POST /api/auth/login` - Business login

### Business Management
- `GET /api/business/[id]` - Get business details
- `PUT /api/business/[id]` - Update business
- `DELETE /api/business/[id]` - Delete business (soft delete)

### Menu Management
- `GET /api/business/[id]/menu` - Get menu items
- `POST /api/business/[id]/menu/upload` - Upload menu items
- `PUT /api/business/[id]/menu/[itemId]` - Update menu item
- `DELETE /api/business/[id]/menu/[itemId]` - Delete menu item

### Order Management
- `GET /api/business/[id]/orders` - Get orders
- `POST /api/business/[id]/orders` - Create order
- `PUT /api/business/[id]/orders/[orderId]` - Update order
- `DELETE /api/business/[id]/orders/[orderId]` - Delete order

### AI Integration
- `POST /api/bella/action` - AI action processing
- `POST /api/bella/intent` - AI intent recognition
- `POST /api/bella/log` - AI query logging

## 🔐 Security Best Practices

1. **Always set business context** before database queries
2. **Use RLS helper functions** for multi-tenant isolation
3. **Validate input data** with Zod schemas
4. **Hash passwords** with bcrypt
5. **Use JWT tokens** for authentication
6. **Encrypt sensitive data** (API keys, tokens)
7. **Log all queries** for monitoring
8. **Rate limit API endpoints**
9. **Validate business access** on every request
10. **Use HTTPS** in production

## 📞 Support

For issues or questions:
1. Check the test suite: `npm run test:schema`
2. Validate migrations: `npm run validate:migration`
3. Review the logs for specific error messages
4. Check RLS policies are applied correctly
5. Verify business context is set properly

---

**Happy Coding! 🚀**
