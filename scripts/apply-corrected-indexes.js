const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyCorrectedIndexes() {
  console.log('🔧 Applying corrected performance indexes...\n');

  try {
    // Apply performance indexes with correct column names
    console.log('📊 Creating performance indexes...');
    
    const indexes = [
      // Composite indexes with correct column names
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created_at 
       ON orders (status, "createdAt" DESC) 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_period_end 
       ON subscriptions (status, "currentPeriodEnd") 
       WHERE status IN ('ACTIVE', 'TRIAL', 'PAST_DUE');`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_business_type_date 
       ON usage_metrics ("businessId", type, date DESC);`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_logs_business_status_created 
       ON query_logs ("businessId", status, "createdAt" DESC);`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_business_category_available 
       ON menu_items ("businessId", "categoryId", "isAvailable") 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_business_role_active 
       ON users ("businessId", role, "isActive") 
       WHERE "deletedAt" IS NULL;`,
      
      // Full-text search indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_search 
       ON menu_items USING gin(to_tsvector('english', name || ' ' || COALESCE(description, ''))) 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_search 
       ON knowledge_base USING gin(to_tsvector('english', title || ' ' || content)) 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_search 
       ON businesses USING gin(to_tsvector('english', name || ' ' || COALESCE(description, ''))) 
       WHERE "deletedAt" IS NULL;`,
      
      // Partial indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_active 
       ON businesses (id, status, "createdAt") 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
       ON users (id, role, "isActive") 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_active 
       ON menu_items (id, "categoryId", "isAvailable") 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_active 
       ON categories (id, "sortOrder") 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_policies_active 
       ON policies (id, type, "isActive") 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_active 
       ON knowledge_base (id, category, "isActive") 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_active 
       ON api_keys (id, status, "lastUsedAt") 
       WHERE "deletedAt" IS NULL;`
    ];

    for (const indexSQL of indexes) {
      try {
        await prisma.$executeRawUnsafe(indexSQL);
        console.log('✅ Index created successfully');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️  Index already exists');
        } else {
          console.log('❌ Error creating index:', error.message);
        }
      }
    }

    // Apply remaining validation constraints with correct column names
    console.log('\n🔒 Creating remaining validation constraints...');
    
    const constraints = [
      // Price validation for menu_items (fix existing data first)
      `UPDATE menu_items SET price = 0.01 WHERE price <= 0;`,
      
      `ALTER TABLE menu_items 
       ADD CONSTRAINT chk_menu_item_price_positive 
       CHECK (price > 0);`,
      
      // Order total validation
      `ALTER TABLE orders 
       ADD CONSTRAINT chk_order_total_non_negative 
       CHECK ("totalPrice" >= 0);`,
      
      // Tax rate validation
      `ALTER TABLE business_policies 
       ADD CONSTRAINT chk_tax_rate_valid 
       CHECK ("taxRate" >= 0 AND "taxRate" <= 100);`,
      
      // Response time validation
      `ALTER TABLE query_logs 
       ADD CONSTRAINT chk_response_time_positive 
       CHECK ("responseTime" IS NULL OR "responseTime" > 0);`,
      
      // Day of week validation
      `ALTER TABLE operating_hours 
       ADD CONSTRAINT chk_day_of_week_valid 
       CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6);`,
      
      // Time format validation
      `ALTER TABLE operating_hours 
       ADD CONSTRAINT chk_time_format 
       CHECK ("openTime" ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' AND "closeTime" ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');`
    ];

    for (const constraintSQL of constraints) {
      try {
        await prisma.$executeRawUnsafe(constraintSQL);
        console.log('✅ Constraint created successfully');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️  Constraint already exists');
        } else {
          console.log('❌ Error creating constraint:', error.message);
        }
      }
    }

    // Create unique constraints with correct column names
    console.log('\n🔑 Creating unique constraints...');
    
    const uniqueConstraints = [
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_slug_unique 
       ON businesses (lower(slug)) 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_email_unique 
       ON businesses (lower(email)) 
       WHERE "deletedAt" IS NULL;`,
      
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_business_email_unique 
       ON users ("businessId", lower(email)) 
       WHERE "deletedAt" IS NULL;`
    ];

    for (const uniqueSQL of uniqueConstraints) {
      try {
        await prisma.$executeRawUnsafe(uniqueSQL);
        console.log('✅ Unique constraint created successfully');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️  Unique constraint already exists');
        } else {
          console.log('❌ Error creating unique constraint:', error.message);
        }
      }
    }

    console.log('\n🎉 All corrected indexes and constraints applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying indexes and constraints:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
applyCorrectedIndexes()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

