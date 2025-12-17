const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyAnalyticsSchema() {
  console.log('🗄️  Applying Phase 4C Analytics Schema...\n');

  try {
    // Read the analytics schema file
    const schemaPath = path.join(process.cwd(), 'database', 'phase4c-analytics-schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error('Analytics schema file not found. Please ensure database/phase4c-analytics-schema.sql exists.');
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file read successfully');
    
    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          successCount++;
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Ignore errors for statements that might already exist
          if (errorMessage.includes('already exists') || 
              errorMessage.includes('relation') || 
              errorMessage.includes('duplicate') ||
              errorMessage.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
            successCount++;
          } else {
            console.log(`❌ Statement ${i + 1}/${statements.length} failed: ${errorMessage}`);
            errorCount++;
          }
        }
      }
    }
    
    console.log(`\n📊 Schema Application Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📋 Total: ${statements.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Analytics schema applied successfully!');
    } else {
      console.log('\n⚠️  Some statements failed, but this may be expected if tables already exist');
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying analytics tables...');
    await verifyAnalyticsTables();
    
  } catch (error) {
    console.error('❌ Failed to apply analytics schema:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyAnalyticsTables() {
  const requiredTables = [
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
  
  const missingTables = [];
  const existingTables = [];
  
  for (const table of requiredTables) {
    try {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = ${table}
        ) as exists
      `;
      
      if (result[0].exists) {
        existingTables.push(table);
        console.log(`✅ Table ${table} exists`);
      } else {
        missingTables.push(table);
        console.log(`❌ Table ${table} missing`);
      }
    } catch (error) {
      missingTables.push(table);
      console.log(`❌ Table ${table} verification failed`);
    }
  }
  
  console.log(`\n📊 Table Verification Summary:`);
  console.log(`✅ Existing: ${existingTables.length}`);
  console.log(`❌ Missing: ${missingTables.length}`);
  console.log(`📋 Total: ${requiredTables.length}`);
  
  if (missingTables.length === 0) {
    console.log('\n🎉 All analytics tables verified successfully!');
  } else {
    console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
    console.log('   Please check the schema application and try again');
  }
}

// Run the schema application
applyAnalyticsSchema().catch(console.error);
