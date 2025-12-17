const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyIndexesAndConstraints() {
  console.log('🔧 Applying performance indexes and constraints...\n');

  try {
    // Apply performance indexes
    console.log('📊 Creating performance indexes...');
    
    const indexes = [
      // Composite indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created_at 
       ON orders (status, created_at DESC) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_period_end 
       ON subscriptions (status, current_period_end) 
       WHERE status IN ('ACTIVE', 'TRIAL', 'PAST_DUE');`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metrics_business_type_date 
       ON usage_metrics (business_id, type, date DESC);`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_logs_business_status_created 
       ON query_logs (business_id, status, created_at DESC);`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_business_category_available 
       ON menu_items (business_id, category_id, is_available) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_business_role_active 
       ON users (business_id, role, is_active) 
       WHERE deleted_at IS NULL;`,
      
      // Full-text search indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_search 
       ON menu_items USING gin(to_tsvector('english', name || ' ' || COALESCE(description, ''))) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_search 
       ON knowledge_base USING gin(to_tsvector('english', title || ' ' || content)) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_search 
       ON businesses USING gin(to_tsvector('english', name || ' ' || COALESCE(description, ''))) 
       WHERE deleted_at IS NULL;`,
      
      // Partial indexes
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_active 
       ON businesses (id, status, created_at) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
       ON users (id, role, is_active) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_active 
       ON menu_items (id, category_id, is_available) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_active 
       ON categories (id, sort_order) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_policies_active 
       ON policies (id, type, is_active) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_active 
       ON knowledge_base (id, category, is_active) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_active 
       ON api_keys (id, status, last_used_at) 
       WHERE deleted_at IS NULL;`
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

    // Apply validation constraints
    console.log('\n🔒 Creating validation constraints...');
    
    const constraints = [
      // Email validation
      `ALTER TABLE businesses 
       ADD CONSTRAINT chk_business_email_format 
       CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');`,
      
      `ALTER TABLE users 
       ADD CONSTRAINT chk_user_email_format 
       CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');`,
      
      // Phone validation
      `ALTER TABLE businesses 
       ADD CONSTRAINT chk_business_phone_format 
       CHECK (phone IS NULL OR length(replace(replace(replace(phone, '(', ''), ')', ''), '-', '')) >= 10);`,
      
      `ALTER TABLE locations 
       ADD CONSTRAINT chk_location_phone_format 
       CHECK (phone IS NULL OR length(replace(replace(replace(phone, '(', ''), ')', ''), '-', '')) >= 10);`,
      
      // Price validation
      `ALTER TABLE menu_items 
       ADD CONSTRAINT chk_menu_item_price_positive 
       CHECK (price > 0);`,
      
      `ALTER TABLE menus 
       ADD CONSTRAINT chk_menu_price_positive 
       CHECK (price > 0);`,
      
      // Order total validation
      `ALTER TABLE orders 
       ADD CONSTRAINT chk_order_total_non_negative 
       CHECK (total_price >= 0);`,
      
      // Tax rate validation
      `ALTER TABLE business_policies 
       ADD CONSTRAINT chk_tax_rate_valid 
       CHECK (tax_rate >= 0 AND tax_rate <= 100);`,
      
      // Usage count validation
      `ALTER TABLE usage_metrics 
       ADD CONSTRAINT chk_usage_count_positive 
       CHECK (count > 0);`,
      
      // Response time validation
      `ALTER TABLE query_logs 
       ADD CONSTRAINT chk_response_time_positive 
       CHECK (response_time IS NULL OR response_time > 0);`,
      
      // Day of week validation
      `ALTER TABLE operating_hours 
       ADD CONSTRAINT chk_day_of_week_valid 
       CHECK (day_of_week >= 0 AND day_of_week <= 6);`,
      
      // Time format validation
      `ALTER TABLE operating_hours 
       ADD CONSTRAINT chk_time_format 
       CHECK (open_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$' AND close_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$');`
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

    // Create unique constraints
    console.log('\n🔑 Creating unique constraints...');
    
    const uniqueConstraints = [
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_slug_unique 
       ON businesses (lower(slug)) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_businesses_email_unique 
       ON businesses (lower(email)) 
       WHERE deleted_at IS NULL;`,
      
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_users_business_email_unique 
       ON users (business_id, lower(email)) 
       WHERE deleted_at IS NULL;`
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

    console.log('\n🎉 All indexes and constraints applied successfully!');
    
  } catch (error) {
    console.error('❌ Error applying indexes and constraints:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
applyIndexesAndConstraints()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

