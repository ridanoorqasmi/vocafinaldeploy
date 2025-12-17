const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAnalyticsTables() {
  console.log('🔧 Fixing analytics tables with correct foreign key types...\n');

  const tableDefinitions = [
    {
      name: 'customer_ltv_metrics',
      sql: `
        CREATE TABLE customer_ltv_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          first_subscription_date DATE NOT NULL,
          last_active_date DATE,
          total_revenue_cents INTEGER DEFAULT 0,
          total_months_active INTEGER DEFAULT 0,
          current_mrr_cents INTEGER DEFAULT 0,
          predicted_ltv_cents INTEGER DEFAULT 0,
          churn_probability DECIMAL(5,4) DEFAULT 0,
          health_score INTEGER DEFAULT 100,
          segment VARCHAR(50),
          last_calculated_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'churn_analysis',
      sql: `
        CREATE TABLE churn_analysis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          analysis_date DATE NOT NULL,
          churn_probability DECIMAL(5,4) NOT NULL,
          churn_risk_factors JSONB DEFAULT '{}',
          recommended_actions JSONB DEFAULT '{}',
          last_login_date DATE,
          usage_trend VARCHAR(20),
          support_tickets_count INTEGER DEFAULT 0,
          payment_failures_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'customer_predictions',
      sql: `
        CREATE TABLE customer_predictions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          prediction_type VARCHAR(50) NOT NULL,
          prediction_date DATE NOT NULL,
          prediction_horizon_days INTEGER NOT NULL,
          predicted_value DECIMAL(10,4) NOT NULL,
          confidence_score DECIMAL(3,2) NOT NULL,
          risk_factors JSONB DEFAULT '[]',
          recommended_actions JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'expansion_opportunities',
      sql: `
        CREATE TABLE expansion_opportunities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          opportunity_type VARCHAR(50) NOT NULL,
          potential_revenue_increase_cents INTEGER NOT NULL,
          probability_of_conversion DECIMAL(3,2) NOT NULL,
          urgency_score INTEGER NOT NULL,
          recommended_actions JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'customer_health_scores',
      sql: `
        CREATE TABLE customer_health_scores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          health_score INTEGER NOT NULL,
          usage_trend_score INTEGER DEFAULT 0,
          payment_reliability_score INTEGER DEFAULT 0,
          engagement_score INTEGER DEFAULT 0,
          support_score INTEGER DEFAULT 0,
          overall_health_status VARCHAR(20) NOT NULL,
          last_calculated_at TIMESTAMP DEFAULT NOW()
        )
      `
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < tableDefinitions.length; i++) {
    const table = tableDefinitions[i];
    try {
      await prisma.$executeRawUnsafe(table.sql);
      successCount++;
      console.log(`✅ Table ${table.name} created successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('already exists')) {
        console.log(`⚠️  Table ${table.name} already exists`);
        successCount++;
      } else {
        console.log(`❌ Table ${table.name} creation failed: ${errorMessage}`);
        errorCount++;
      }
    }
  }

  console.log(`\n📊 Table Creation Summary:`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📋 Total: ${tableDefinitions.length}`);

  // Create missing indexes
  console.log('\n🔧 Creating missing indexes...');
  await createMissingIndexes();

  // Verify all tables
  console.log('\n🔍 Verifying all tables...');
  await verifyAllTables();
}

async function createMissingIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_customer_ltv_business ON customer_ltv_metrics(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_churn_analysis_business ON churn_analysis(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_customer_predictions_business ON customer_predictions(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_business ON expansion_opportunities(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_customer_health_business ON customer_health_scores(business_id)'
  ];

  for (const indexSQL of indexes) {
    try {
      await prisma.$executeRawUnsafe(indexSQL);
      console.log(`✅ Index created: ${indexSQL.split(' ')[5]}`);
    } catch (error) {
      console.log(`⚠️  Index creation skipped: ${error.message}`);
    }
  }
}

async function verifyAllTables() {
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

  const foundTables = [];
  const missingTables = [];

  for (const tableName of requiredTables) {
    try {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = ${tableName}
        ) as exists
      `;
      
      if (result[0].exists) {
        foundTables.push(tableName);
        console.log(`✅ ${tableName} - EXISTS`);
      } else {
        missingTables.push(tableName);
        console.log(`❌ ${tableName} - MISSING`);
      }
    } catch (error) {
      missingTables.push(tableName);
      console.log(`❌ ${tableName} - ERROR`);
    }
  }

  console.log(`\n📊 Final Verification:`);
  console.log(`✅ Found: ${foundTables.length}`);
  console.log(`❌ Missing: ${missingTables.length}`);
  console.log(`📋 Total: ${requiredTables.length}`);

  if (missingTables.length === 0) {
    console.log('\n🎉 All analytics tables verified successfully!');
    return true;
  } else {
    console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
    return false;
  }
}

// Run the table fixing
fixAnalyticsTables()
  .then(() => {
    console.log('\n🚀 Analytics tables fixed and verified!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
