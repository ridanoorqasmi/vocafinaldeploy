const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAnalyticsTables() {
  console.log('🗄️  Creating Phase 4C Analytics Tables...\n');

  const tableDefinitions = [
    {
      name: 'mrr_snapshots',
      sql: `
        CREATE TABLE mrr_snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          snapshot_date DATE NOT NULL,
          total_mrr_cents INTEGER NOT NULL,
          new_business_mrr_cents INTEGER DEFAULT 0,
          expansion_mrr_cents INTEGER DEFAULT 0,
          contraction_mrr_cents INTEGER DEFAULT 0,
          churned_mrr_cents INTEGER DEFAULT 0,
          net_new_mrr_cents INTEGER DEFAULT 0,
          total_customers INTEGER NOT NULL,
          paying_customers INTEGER NOT NULL,
          average_revenue_per_user_cents INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'customer_ltv_metrics',
      sql: `
        CREATE TABLE customer_ltv_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
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
      name: 'revenue_cohorts',
      sql: `
        CREATE TABLE revenue_cohorts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cohort_month DATE NOT NULL,
          months_since_start INTEGER NOT NULL,
          customers_remaining INTEGER NOT NULL,
          total_revenue_cents INTEGER NOT NULL,
          average_revenue_per_customer_cents INTEGER DEFAULT 0,
          retention_rate DECIMAL(5,4) DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'churn_analysis',
      sql: `
        CREATE TABLE churn_analysis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
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
      name: 'cac_metrics',
      sql: `
        CREATE TABLE cac_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          acquisition_month DATE NOT NULL,
          acquisition_channel VARCHAR(100),
          customers_acquired INTEGER NOT NULL,
          total_acquisition_cost_cents INTEGER NOT NULL,
          cost_per_customer_cents INTEGER NOT NULL,
          ltv_to_cac_ratio DECIMAL(5,2) DEFAULT 0,
          payback_period_months INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'plan_analytics',
      sql: `
        CREATE TABLE plan_analytics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          plan_id VARCHAR(50) NOT NULL,
          analysis_period_start DATE NOT NULL,
          analysis_period_end DATE NOT NULL,
          total_subscribers INTEGER NOT NULL,
          new_subscribers INTEGER DEFAULT 0,
          churned_subscribers INTEGER DEFAULT 0,
          upgrade_rate DECIMAL(5,4) DEFAULT 0,
          downgrade_rate DECIMAL(5,4) DEFAULT 0,
          average_usage_percentage DECIMAL(5,2) DEFAULT 0,
          overage_revenue_cents INTEGER DEFAULT 0,
          plan_satisfaction_score DECIMAL(3,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'financial_reports',
      sql: `
        CREATE TABLE financial_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_type VARCHAR(50) NOT NULL,
          reporting_period_start DATE NOT NULL,
          reporting_period_end DATE NOT NULL,
          total_revenue_cents INTEGER NOT NULL,
          recognized_revenue_cents INTEGER NOT NULL,
          deferred_revenue_cents INTEGER DEFAULT 0,
          refunds_issued_cents INTEGER DEFAULT 0,
          taxes_collected_cents INTEGER DEFAULT 0,
          net_revenue_cents INTEGER NOT NULL,
          report_data JSONB NOT NULL,
          generated_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'revenue_forecasts',
      sql: `
        CREATE TABLE revenue_forecasts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          forecast_date DATE NOT NULL,
          forecast_horizon_months INTEGER NOT NULL,
          predicted_mrr_cents INTEGER NOT NULL,
          predicted_arr_cents INTEGER NOT NULL,
          confidence_score DECIMAL(3,2) NOT NULL,
          confidence_interval_lower INTEGER NOT NULL,
          confidence_interval_upper INTEGER NOT NULL,
          growth_rate DECIMAL(5,4) NOT NULL,
          key_assumptions JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'customer_predictions',
      sql: `
        CREATE TABLE customer_predictions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
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
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
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
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          health_score INTEGER NOT NULL,
          usage_trend_score INTEGER DEFAULT 0,
          payment_reliability_score INTEGER DEFAULT 0,
          engagement_score INTEGER DEFAULT 0,
          support_score INTEGER DEFAULT 0,
          overall_health_status VARCHAR(20) NOT NULL,
          last_calculated_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'business_insights',
      sql: `
        CREATE TABLE business_insights (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          insight_type VARCHAR(50) NOT NULL,
          insight_category VARCHAR(50) NOT NULL,
          title VARCHAR(200) NOT NULL,
          description TEXT NOT NULL,
          impact_score INTEGER NOT NULL,
          confidence_score DECIMAL(3,2) NOT NULL,
          actionable BOOLEAN NOT NULL DEFAULT true,
          recommended_actions JSONB DEFAULT '[]',
          insight_data JSONB DEFAULT '{}',
          generated_at TIMESTAMP DEFAULT NOW()
        )
      `
    },
    {
      name: 'business_alerts',
      sql: `
        CREATE TABLE business_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          alert_type VARCHAR(50) NOT NULL,
          alert_category VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          alert_data JSONB DEFAULT '{}',
          acknowledged_at TIMESTAMP,
          resolved_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
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

  if (errorCount === 0) {
    console.log('\n🎉 All analytics tables created successfully!');
  } else {
    console.log('\n⚠️  Some tables failed to create');
  }

  // Create indexes
  console.log('\n🔧 Creating indexes...');
  await createIndexes();

  // Verify tables
  console.log('\n🔍 Verifying tables...');
  await verifyTables();
}

async function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date)',
    'CREATE INDEX IF NOT EXISTS idx_customer_ltv_business ON customer_ltv_metrics(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_revenue_cohorts_month ON revenue_cohorts(cohort_month)',
    'CREATE INDEX IF NOT EXISTS idx_churn_analysis_business ON churn_analysis(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_cac_metrics_month ON cac_metrics(acquisition_month)',
    'CREATE INDEX IF NOT EXISTS idx_plan_analytics_plan ON plan_analytics(plan_id)',
    'CREATE INDEX IF NOT EXISTS idx_financial_reports_type ON financial_reports(report_type)',
    'CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_date ON revenue_forecasts(forecast_date)',
    'CREATE INDEX IF NOT EXISTS idx_customer_predictions_business ON customer_predictions(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_business ON expansion_opportunities(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_customer_health_business ON customer_health_scores(business_id)',
    'CREATE INDEX IF NOT EXISTS idx_business_insights_category ON business_insights(insight_category)',
    'CREATE INDEX IF NOT EXISTS idx_business_alerts_severity ON business_alerts(severity)'
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

async function verifyTables() {
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

// Run the table creation
createAnalyticsTables()
  .then(() => {
    console.log('\n🚀 Analytics tables setup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
