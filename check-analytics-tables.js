const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAnalyticsTables() {
  console.log('🔍 Checking analytics tables in database...\n');

  try {
    // Check all tables in the database
    const allTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('📋 All tables in database:');
    allTables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });
    
    // Check specifically for analytics tables
    const analyticsTables = [
      'mrr_snapshots',
      'customer_ltv_metrics',
      'revenue_cohorts',
      'churn_analysis',
      'cac_metrics',
      'plan_analytics',
      'financial_reports',
      'revenue_forecasts',
      'customer_predictions',
      'expansion_opportunities',
      'customer_health_scores',
      'business_insights',
      'business_alerts'
    ];
    
    console.log('\n🔍 Checking for analytics tables:');
    const foundTables = [];
    const missingTables = [];
    
    for (const tableName of analyticsTables) {
      const exists = allTables.some(table => table.table_name === tableName);
      if (exists) {
        foundTables.push(tableName);
        console.log(`✅ ${tableName} - EXISTS`);
      } else {
        missingTables.push(tableName);
        console.log(`❌ ${tableName} - MISSING`);
      }
    }
    
    console.log(`\n📊 Analytics Tables Summary:`);
    console.log(`✅ Found: ${foundTables.length}`);
    console.log(`❌ Missing: ${missingTables.length}`);
    console.log(`📋 Total: ${analyticsTables.length}`);
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
      console.log('   These tables need to be created');
    } else {
      console.log('\n🎉 All analytics tables found!');
    }
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAnalyticsTables();
