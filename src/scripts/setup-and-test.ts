#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function setupAndTestAnalytics() {
  console.log('🚀 Phase 4C Analytics - Setup and Test Suite\n');

  try {
    // 1. Check database connection
    console.log('📊 Checking database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');

    // 2. Setup analytics database schema
    console.log('🗄️  Setting up analytics database schema...');
    await setupAnalyticsDatabase();
    console.log('✅ Analytics database schema setup completed\n');

    // 3. Verify analytics tables
    console.log('🔍 Verifying analytics tables...');
    await verifyAnalyticsTables();
    console.log('✅ All analytics tables verified\n');

    // 4. Create test plan definitions
    console.log('📋 Creating test plan definitions...');
    await createTestPlanDefinitions();
    console.log('✅ Test plan definitions created\n');

    // 5. Run test suites
    console.log('🧪 Running analytics test suites...');
    await runTestSuites();

  } catch (error) {
    console.error('❌ Setup and test process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function setupAnalyticsDatabase() {
  try {
    // Read the analytics schema file
    const schemaPath = path.join(process.cwd(), 'database', 'phase4c-analytics-schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error('Analytics schema file not found. Please ensure database/phase4c-analytics-schema.sql exists.');
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (error) {
          // Ignore errors for statements that might already exist
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('already exists') && 
              !errorMessage.includes('relation') && 
              !errorMessage.includes('duplicate')) {
            console.warn(`Warning: ${errorMessage}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to setup analytics database:', error);
    throw error;
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
  
  for (const table of requiredTables) {
    try {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = ${table}
        ) as exists
      `;
      
      const resultArray = result as any[];
      if (!resultArray[0].exists) {
        missingTables.push(table);
      }
    } catch (error) {
      missingTables.push(table);
    }
  }
  
  if (missingTables.length > 0) {
    throw new Error(`Missing analytics tables: ${missingTables.join(', ')}`);
  }
}

async function createTestPlanDefinitions() {
  try {
    await prisma.$executeRaw`
      INSERT INTO plan_definitions (id, name, description, price_cents, currency, billing_interval, trial_days, display_order)
      VALUES 
        ('free', 'Free Plan', 'Free tier', 0, 'usd', 'month', 14, 1),
        ('starter', 'Starter Plan', 'Starter tier', 2900, 'usd', 'month', 14, 2),
        ('pro', 'Professional Plan', 'Pro tier', 9900, 'usd', 'month', 14, 3),
        ('business', 'Business Plan', 'Business tier', 29900, 'usd', 'month', 14, 4)
      ON CONFLICT (id) DO NOTHING
    `;
  } catch (error) {
    console.error('❌ Failed to create test plan definitions:', error);
    throw error;
  }
}

async function runTestSuites() {
  const testSuites = [
    {
      name: 'Revenue Analytics Engine',
      path: 'src/tests/analytics/revenue-analytics.test.ts',
      description: 'Tests MRR calculation, LTV metrics, cohort analysis, and churn analysis'
    },
    {
      name: 'Predictive Models',
      path: 'src/tests/analytics/predictive-models.test.ts',
      description: 'Tests churn prediction, revenue forecasting, and expansion opportunities'
    },
    {
      name: 'Insights Engine',
      path: 'src/tests/analytics/insights-engine.test.ts',
      description: 'Tests business insights generation and alert system'
    },
    {
      name: 'Analytics Service',
      path: 'src/tests/analytics/analytics-service.test.ts',
      description: 'Tests analytics service integration and dashboard data'
    },
    {
      name: 'Integration Tests',
      path: 'src/tests/analytics/test-runner.ts',
      description: 'Comprehensive end-to-end integration tests'
    }
  ];

  const results = [];

  for (const suite of testSuites) {
    console.log(`\n🧪 Running ${suite.name}...`);
    console.log(`   ${suite.description}`);
    console.log('   ' + '='.repeat(50));
    
    const startTime = Date.now();
    
    try {
      execSync(`npx jest ${suite.path} --verbose --no-coverage`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      const duration = Date.now() - startTime;
      console.log(`\n✅ ${suite.name} passed (${duration}ms)`);
      
      results.push({
        suite: suite.name,
        status: 'pass',
        duration: duration,
        error: null
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`\n❌ ${suite.name} failed (${duration}ms)`);
      console.log(`   Error: ${errorMessage}`);
      
      results.push({
        suite: suite.name,
        status: 'fail',
        duration: duration,
        error: errorMessage
      });
    }
  }

  // Generate test report
  generateTestReport(results);
}

function generateTestReport(results: any[]) {
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;

  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    const duration = `(${result.duration}ms)`;
    console.log(`${icon} ${result.suite} ${duration}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n📈 Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed === 0) {
    console.log('\n🎉 All test suites passed!');
    console.log('📊 Phase 4C Analytics System is fully functional');
    console.log('🚀 Ready for production deployment');
  } else {
    console.log('\n❌ Some test suites failed');
    console.log('🔧 Please review and fix the failing tests');
  }

  // Save detailed results to file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: { passed, failed, total: results.length },
    results: results,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };

  fs.writeFileSync('test-results.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Detailed test report saved to test-results.json');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the setup and test process
setupAndTestAnalytics().catch(console.error);
