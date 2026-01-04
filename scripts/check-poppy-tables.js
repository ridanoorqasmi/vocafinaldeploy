const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPoppyTables() {
  try {
    console.log('🔍 Checking for Poppy (DataAnalyst) tables...\n');
    
    const expectedTables = [
      'poppy_tenants',
      'poppy_users',
      'poppy_auth_sessions',
      'poppy_datasets',
      'poppy_dataset_versions',
      'poppy_dataset_profiles',
      'poppy_analysis_sessions',
      'poppy_chat_messages',
      'poppy_artifacts',
      'poppy_explanations',
      'poppy_token_usage',
      'poppy_audit_logs'
    ];
    
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'poppy_%'
      ORDER BY table_name;
    `;
    
    const existingTables = result.map(r => r.table_name);
    
    console.log('📊 Existing Poppy tables:');
    existingTables.forEach(table => {
      console.log(`  ✅ ${table}`);
    });
    
    console.log('\n📋 Expected Poppy tables:');
    expectedTables.forEach(table => {
      const exists = existingTables.includes(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    });
    
    const missing = expectedTables.filter(t => !existingTables.includes(t));
    const extra = existingTables.filter(t => !expectedTables.includes(t));
    
    if (missing.length > 0) {
      console.log('\n⚠️  Missing tables:');
      missing.forEach(table => console.log(`  - ${table}`));
    }
    
    if (extra.length > 0) {
      console.log('\n⚠️  Extra tables (not in schema):');
      extra.forEach(table => console.log(`  - ${table}`));
    }
    
    if (existingTables.length === expectedTables.length && missing.length === 0) {
      console.log('\n✅ All Poppy tables exist!');
      console.log('⚠️  However, they are not tracked in migrations.');
      console.log('💡 You need to create a migration file to track them safely.');
    } else if (existingTables.length === 0) {
      console.log('\n❌ No Poppy tables found in database.');
      console.log('💡 You need to run: npx prisma migrate dev --name add_poppy_models');
    } else {
      console.log('\n⚠️  Partial Poppy tables exist.');
      console.log('💡 You may need to create missing tables or fix schema drift.');
    }
    
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkPoppyTables();





