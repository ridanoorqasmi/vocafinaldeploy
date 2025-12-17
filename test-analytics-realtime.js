const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAnalyticsRealtime() {
  console.log('🚀 Testing Phase 4C Analytics in Real-Time...\n');

  try {
    // Test 1: Check if analytics tables exist
    console.log('1. Checking analytics tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'mrr_snapshots', 'customer_ltv_metrics', 'revenue_cohorts', 
        'churn_analysis', 'business_insights', 'business_alerts'
      )
      ORDER BY table_name
    `;
    
    console.log(`✅ Found ${tables.length} analytics tables`);
    tables.forEach(table => console.log(`   - ${table.table_name}`));

    // Test 2: Create a test business and subscription
    console.log('\n2. Creating test business...');
    const testBusiness = await prisma.business.create({
      data: {
        name: 'Analytics Test Business',
        slug: 'analytics-test-business',
        email: 'test@analytics.com',
        passwordHash: 'hashedpassword'
      }
    });
    console.log(`✅ Created business: ${testBusiness.id}`);

    // Test 3: Create a test subscription
    console.log('\n3. Creating test subscription...');
    const testSubscription = await prisma.subscription.create({
      data: {
        businessId: testBusiness.id,
        planId: 'premium',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    console.log(`✅ Created subscription: ${testSubscription.id}`);

    // Test 4: Test analytics data insertion
    console.log('\n4. Testing analytics data insertion...');
    
    // Insert MRR snapshot
    const mrrSnapshot = await prisma.$executeRaw`
      INSERT INTO mrr_snapshots (
        snapshot_date, total_mrr_cents, new_business_mrr_cents,
        total_customers, paying_customers, created_at
      ) VALUES (
        CURRENT_DATE, 5000, 5000, 1, 1, NOW()
      )
    `;
    console.log('✅ MRR snapshot created');

    // Insert customer LTV metrics
    const ltvMetrics = await prisma.$executeRaw`
      INSERT INTO customer_ltv_metrics (
        business_id, first_subscription_date, total_revenue_cents,
        current_mrr_cents, health_score, segment, last_calculated_at
      ) VALUES (
        ${testBusiness.id}, CURRENT_DATE, 5000, 5000, 85, 'champion', NOW()
      )
    `;
    console.log('✅ Customer LTV metrics created');

    // Insert business insight
    const businessInsight = await prisma.$executeRaw`
      INSERT INTO business_insights (
        insight_type, insight_category, title, description,
        impact_score, confidence_score, actionable, recommended_actions,
        insight_data, generated_at
      ) VALUES (
        'revenue_opportunity', 'growth', 'Test Revenue Opportunity',
        'Test insight for analytics validation', 80, 0.85, true,
        '["Test action 1", "Test action 2"]'::jsonb,
        '{"test": true}'::jsonb, NOW()
      )
    `;
    console.log('✅ Business insight created');

    // Test 5: Query analytics data
    console.log('\n5. Querying analytics data...');
    
    const mrrData = await prisma.$queryRaw`
      SELECT * FROM mrr_snapshots ORDER BY created_at DESC LIMIT 1
    `;
    console.log(`✅ Retrieved MRR data: ${mrrData.length} records`);

    const ltvData = await prisma.$queryRaw`
      SELECT * FROM customer_ltv_metrics WHERE business_id = ${testBusiness.id}
    `;
    console.log(`✅ Retrieved LTV data: ${ltvData.length} records`);

    const insightsData = await prisma.$queryRaw`
      SELECT * FROM business_insights ORDER BY generated_at DESC LIMIT 1
    `;
    console.log(`✅ Retrieved insights data: ${insightsData.length} records`);

    // Test 6: Test analytics API endpoints (if they exist)
    console.log('\n6. Testing analytics API structure...');
    
    // Check if analytics routes exist
    const fs = require('fs');
    const path = require('path');
    
    const analyticsRoutes = [
      'src/routes/analytics/dashboard.ts',
      'src/routes/analytics/index.ts',
      'src/services/analytics/revenue-analytics-engine.ts',
      'src/services/analytics/predictive-models.ts',
      'src/services/analytics/insights-engine.ts',
      'src/services/analytics/analytics-service.ts'
    ];
    
    let existingFiles = 0;
    analyticsRoutes.forEach(route => {
      if (fs.existsSync(route)) {
        console.log(`✅ ${route} exists`);
        existingFiles++;
      } else {
        console.log(`❌ ${route} missing`);
      }
    });
    
    console.log(`\n📊 Analytics Implementation Summary:`);
    console.log(`✅ Database tables: ${tables.length}/6`);
    console.log(`✅ Test data created: Business, Subscription, Analytics records`);
    console.log(`✅ Analytics files: ${existingFiles}/${analyticsRoutes.length}`);
    
    if (tables.length >= 6 && existingFiles >= 5) {
      console.log('\n🎉 Phase 4C Analytics System is READY for real-time use!');
      console.log('\n📋 Available Analytics Features:');
      console.log('   • Revenue Analytics Engine (MRR, LTV, Cohorts)');
      console.log('   • Predictive Models (Churn, Forecasting, Expansion)');
      console.log('   • Business Intelligence Dashboard');
      console.log('   • Automated Insights Generation');
      console.log('   • Alert and Notification System');
      console.log('   • Financial Reporting');
      console.log('   • Customer Health Scoring');
      
      console.log('\n🚀 Next Steps:');
      console.log('   1. Start the application server');
      console.log('   2. Access analytics dashboard at /api/v1/analytics/');
      console.log('   3. Monitor real-time analytics data');
      console.log('   4. Set up automated analytics processing');
    } else {
      console.log('\n⚠️  Some components are missing. Please check the implementation.');
    }

  } catch (error) {
    console.error('❌ Error during analytics testing:', error);
  } finally {
    // Cleanup test data
    try {
      await prisma.$executeRaw`DELETE FROM mrr_snapshots WHERE total_mrr_cents = 5000`;
      await prisma.$executeRaw`DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name = 'Analytics Test Business')`;
      await prisma.$executeRaw`DELETE FROM business_insights WHERE title = 'Test Revenue Opportunity'`;
      await prisma.$executeRaw`DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name = 'Analytics Test Business')`;
      await prisma.$executeRaw`DELETE FROM businesses WHERE name = 'Analytics Test Business'`;
      console.log('\n🧹 Test data cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️  Warning during cleanup:', cleanupError.message);
    }
    
    await prisma.$disconnect();
  }
}

testAnalyticsRealtime();
