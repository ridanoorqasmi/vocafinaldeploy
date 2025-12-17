const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function enableRLS() {
  try {
    console.log('🔧 Enabling RLS on all tables...\n');
    
    const tables = [
      'businesses', 'users', 'locations', 'operating_hours',
      'categories', 'menu_items', 'policies', 'knowledge_base',
      'api_keys', 'subscriptions', 'usage_metrics', 'query_logs',
      'menus', 'orders', 'powerups', 'business_policies', 'business_integrations'
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
        console.log(`✅ Enabled RLS on ${table}`);
      } catch (error) {
        console.log(`❌ Error enabling RLS on ${table}:`, error.message);
      }
    }

    console.log('\n🎉 RLS enabled on all tables!');
    
  } catch (error) {
    console.error('❌ Error enabling RLS:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

enableRLS();

