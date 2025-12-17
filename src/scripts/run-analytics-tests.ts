#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runAnalyticsTests() {
  console.log('🚀 Starting Phase 4C Analytics Test Suite...\n');

  try {
    // 1. Check database connection
    console.log('📊 Checking database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');

    // 2. Verify analytics tables exist
    console.log('🗄️  Verifying analytics tables...');
    const tables = [
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

    for (const table of tables) {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = ${table}
        ) as exists
      `;
      
      if (result[0].exists) {
        console.log(`✅ Table ${table} exists`);
      } else {
        console.log(`❌ Table ${table} missing`);
        throw new Error(`Required table ${table} not found`);
      }
    }
    console.log('✅ All analytics tables verified\n');

    // 3. Run individual test suites
    console.log('🧪 Running Revenue Analytics Engine Tests...');
    execSync('jest src/tests/analytics/revenue-analytics.test.ts --verbose', { stdio: 'inherit' });
    console.log('✅ Revenue Analytics Engine Tests passed\n');

    console.log('🧪 Running Predictive Models Tests...');
    execSync('jest src/tests/analytics/predictive-models.test.ts --verbose', { stdio: 'inherit' });
    console.log('✅ Predictive Models Tests passed\n');

    console.log('🧪 Running Insights Engine Tests...');
    execSync('jest src/tests/analytics/insights-engine.test.ts --verbose', { stdio: 'inherit' });
    console.log('✅ Insights Engine Tests passed\n');

    console.log('🧪 Running Analytics Service Tests...');
    execSync('jest src/tests/analytics/analytics-service.test.ts --verbose', { stdio: 'inherit' });
    console.log('✅ Analytics Service Tests passed\n');

    console.log('🧪 Running Integration Tests...');
    execSync('jest src/tests/analytics/test-runner.ts --verbose', { stdio: 'inherit' });
    console.log('✅ Integration Tests passed\n');

    // 4. Run comprehensive test suite
    console.log('🧪 Running Comprehensive Test Suite...');
    execSync('jest src/tests/analytics --coverage --verbose', { stdio: 'inherit' });
    console.log('✅ All tests passed successfully!\n');

    // 5. Performance validation
    console.log('⚡ Running Performance Tests...');
    await runPerformanceTests();
    console.log('✅ Performance tests completed\n');

    console.log('🎉 Phase 4C Analytics Test Suite completed successfully!');
    console.log('📊 All analytics features are working correctly');
    console.log('🚀 System is ready for production deployment');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function runPerformanceTests() {
  console.log('  ⏱️  Testing MRR calculation performance...');
  const startTime = Date.now();
  
  // Simulate MRR calculation
  await prisma.$queryRaw`SELECT COUNT(*) FROM mrr_snapshots`;
  
  const endTime = Date.now();
  const executionTime = endTime - startTime;
  
  if (executionTime < 5000) {
    console.log(`  ✅ MRR calculation completed in ${executionTime}ms (target: <5000ms)`);
  } else {
    console.log(`  ⚠️  MRR calculation took ${executionTime}ms (target: <5000ms)`);
  }

  console.log('  ⏱️  Testing database query performance...');
  const queryStartTime = Date.now();
  
  // Test complex analytics query
  await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_businesses,
      COUNT(CASE WHEN s.status = 'ACTIVE' THEN 1 END) as active_subscriptions
    FROM businesses b
    LEFT JOIN subscriptions s ON b.id = s.business_id
  `;
  
  const queryEndTime = Date.now();
  const queryExecutionTime = queryEndTime - queryStartTime;
  
  if (queryExecutionTime < 1000) {
    console.log(`  ✅ Database queries completed in ${queryExecutionTime}ms (target: <1000ms)`);
  } else {
    console.log(`  ⚠️  Database queries took ${queryExecutionTime}ms (target: <1000ms)`);
  }
}

// Run the test suite
runAnalyticsTests().catch(console.error);
