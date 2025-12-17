# Row-Level Security (RLS) Implementation

This directory contains the Row-Level Security implementation for the VOCA AI Order Taking Agent multi-tenant system.

## 📁 Files

- `rls-policies.sql` - Main RLS policies and helper functions
- `test-rls-policies.sql` - Test script to verify RLS policies work correctly
- `README-RLS.md` - This documentation file

## 🚀 Setup Instructions

### 1. Apply RLS Policies

After running all Prisma migrations, apply the RLS policies:

```bash
# Using psql
psql -d voca_order_taking -f database/rls-policies.sql

# Or using pgAdmin
# Open pgAdmin, connect to your database, and run the contents of rls-policies.sql
```

### 2. Test RLS Policies

Run the test script to verify everything works:

```bash
# Using psql
psql -d voca_order_taking -f database/test-rls-policies.sql
```

## 🔧 How It Works

### Business Context Functions

The RLS system uses two PostgreSQL functions:

- `set_current_business_id(business_id TEXT)` - Sets the current business context
- `get_current_business_id()` - Gets the current business context

### RLS Policies

Each table has an isolation policy that ensures:
- Businesses can only see their own data
- Users can only see users from their business
- All related data (menu items, orders, etc.) is properly isolated

### API Integration

The `/lib/auth.ts` file provides helper functions:

```typescript
import { setBusinessContextFromToken, createBusinessScopedClient } from '@/lib/auth'

// In API routes, set business context from JWT token
await setBusinessContextFromToken(token)

// Or create a scoped Prisma client
const client = createBusinessScopedClient(businessId)
```

## 🛡️ Security Features

### Tenant Isolation
- ✅ Business A cannot query Business B's data
- ✅ All database operations are automatically filtered by business_id
- ✅ Cross-tenant data access is prevented at the database level

### Soft Delete Support
- ✅ RLS policies respect `deletedAt` fields
- ✅ Soft-deleted records are not visible to any business
- ✅ Cascade deletion works properly with RLS

### API Security
- ✅ JWT token validation required for all operations
- ✅ Business context automatically set from token
- ✅ Business access validation before operations

## 📊 Tables with RLS Enabled

### Core Tables
- `businesses` - Business isolation
- `users` - User access control
- `locations` - Location-based isolation
- `operating_hours` - Hours tied to locations
- `categories` - Menu category isolation
- `menu_items` - Menu item isolation
- `policies` - Policy isolation
- `knowledge_base` - Knowledge base isolation
- `api_keys` - API key isolation
- `subscriptions` - Subscription isolation
- `usage_metrics` - Usage tracking isolation
- `query_logs` - Query log isolation

### Legacy Tables
- `menus` - Legacy menu isolation
- `orders` - Order isolation
- `powerups` - Powerup isolation
- `business_policies` - Legacy policy isolation
- `business_integrations` - Integration isolation

## 🧪 Testing

### Manual Testing

1. **Set Business Context:**
   ```sql
   SELECT set_current_business_id('your-business-id');
   ```

2. **Query Data:**
   ```sql
   SELECT * FROM businesses; -- Should only show current business
   SELECT * FROM menu_items; -- Should only show current business menu items
   ```

3. **Switch Context:**
   ```sql
   SELECT set_current_business_id('different-business-id');
   SELECT * FROM businesses; -- Should show different business
   ```

### Automated Testing

Run the test script to verify all policies work correctly:

```bash
psql -d voca_order_taking -f database/test-rls-policies.sql
```

## ⚠️ Important Notes

1. **Always set business context** before database operations
2. **Use the helper functions** in `/lib/auth.ts` for API routes
3. **Test thoroughly** after any schema changes
4. **Monitor query performance** - RLS adds overhead
5. **Backup before applying** RLS policies to production

## 🔍 Troubleshooting

### Common Issues

1. **"No rows returned"** - Check if business context is set
2. **"Permission denied"** - Verify RLS policies are applied
3. **"Function not found"** - Ensure helper functions are created

### Debug Queries

```sql
-- Check current business context
SELECT get_current_business_id();

-- Check if RLS is enabled on a table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'your_table_name';

-- List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies;
```

## 📈 Performance Considerations

- RLS policies add query overhead
- Consider adding indexes on `business_id` columns
- Monitor query performance in production
- Use connection pooling for better performance

## 🔄 Maintenance

- Review RLS policies after schema changes
- Test policies with new tables
- Monitor for performance issues
- Keep test scripts updated

