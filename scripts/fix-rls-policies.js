const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixRLSPolicies() {
  try {
    console.log('🔧 Fixing RLS Policies...\n');
    
    // Check current role
    const currentRole = await prisma.$queryRaw`SELECT current_user, session_user`;
    console.log('Current role:', currentRole);

    // Drop existing policies and recreate them for all roles
    console.log('\nDropping existing policies...');
    
    const tables = [
      'businesses', 'users', 'locations', 'operating_hours',
      'categories', 'menu_items', 'policies', 'knowledge_base',
      'api_keys', 'subscriptions', 'usage_metrics', 'query_logs',
      'menus', 'orders', 'powerups', 'business_policies', 'business_integrations'
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS ${table}_isolation ON ${table};`);
        console.log(`✅ Dropped policy for ${table}`);
      } catch (error) {
        console.log(`ℹ️  No policy to drop for ${table}`);
      }
    }

    // Recreate policies for all roles (PUBLIC)
    console.log('\nCreating new policies for all roles...');
    
    const policies = [
      // Businesses
      `CREATE POLICY business_isolation ON businesses
       FOR ALL TO PUBLIC
       USING (id = current_setting('app.current_business_id', true));`,
      
      // Users
      `CREATE POLICY user_isolation ON users
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Locations
      `CREATE POLICY location_isolation ON locations
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Operating Hours
      `CREATE POLICY operating_hour_isolation ON operating_hours
       FOR ALL TO PUBLIC
       USING ("locationId" IN (
         SELECT id FROM locations 
         WHERE "businessId" = current_setting('app.current_business_id', true)
       ));`,
      
      // Categories
      `CREATE POLICY category_isolation ON categories
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Menu Items
      `CREATE POLICY menu_item_isolation ON menu_items
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Policies
      `CREATE POLICY policy_isolation ON policies
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Knowledge Base
      `CREATE POLICY kb_isolation ON knowledge_base
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // API Keys
      `CREATE POLICY apikey_isolation ON api_keys
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Subscriptions
      `CREATE POLICY subscription_isolation ON subscriptions
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Usage Metrics
      `CREATE POLICY usage_isolation ON usage_metrics
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Query Logs
      `CREATE POLICY querylog_isolation ON query_logs
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      // Legacy tables
      `CREATE POLICY menu_isolation ON menus
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      `CREATE POLICY order_isolation ON orders
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      `CREATE POLICY powerup_isolation ON powerups
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      `CREATE POLICY bizpol_isolation ON business_policies
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`,
      
      `CREATE POLICY bizint_isolation ON business_integrations
       FOR ALL TO PUBLIC
       USING ("businessId" = current_setting('app.current_business_id', true));`
    ];

    for (const policySQL of policies) {
      try {
        await prisma.$executeRawUnsafe(policySQL);
        console.log('✅ Policy created successfully');
      } catch (error) {
        console.log('❌ Error creating policy:', error.message);
      }
    }

    console.log('\n🎉 RLS policies fixed!');
    
  } catch (error) {
    console.error('❌ Error fixing RLS policies:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixRLSPolicies();

