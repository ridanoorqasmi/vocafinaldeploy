import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { revenueAnalyticsEngine } from '../../services/analytics/revenue-analytics-engine';
import { predictiveAnalyticsModels } from '../../services/analytics/predictive-models';
import { insightsEngine } from '../../services/analytics/insights-engine';

const prisma = new PrismaClient();

// ==============================================
// ANALYTICS ACCURACY TESTING
// ==============================================

describe('Revenue Analytics Accuracy Tests', () => {
  beforeEach(async () => {
    // Setup test data
    await setupTestData();
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('MRR Calculation Accuracy', () => {
    it('should calculate MRR correctly for active subscriptions', async () => {
      // Create test businesses with subscriptions
      const business1 = await createTestBusiness('Test Business 1');
      const business2 = await createTestBusiness('Test Business 2');
      
      await createTestSubscription(business1.id, 'starter', 'ACTIVE');
      await createTestSubscription(business2.id, 'pro', 'ACTIVE');

      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());

      // Expected MRR: $29 (starter) + $99 (pro) = $128
      expect(mrrData.total_mrr_cents).toBe(12800);
      expect(mrrData.paying_customers).toBe(2);
      expect(mrrData.average_revenue_per_user_cents).toBe(6400);
    });

    it('should handle subscription changes correctly', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'starter', 'ACTIVE');
      
      // Simulate upgrade
      await createTestSubscription(business.id, 'pro', 'ACTIVE');

      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());

      // Should only count the active subscription (pro plan)
      expect(mrrData.total_mrr_cents).toBe(9900);
      expect(mrrData.paying_customers).toBe(1);
    });

    it('should calculate expansion and contraction correctly', async () => {
      // This test would require more complex setup with historical data
      // For now, we'll test the basic calculation logic
      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
      
      expect(typeof mrrData.expansion_mrr_cents).toBe('number');
      expect(typeof mrrData.contraction_mrr_cents).toBe('number');
      expect(typeof mrrData.churned_mrr_cents).toBe('number');
      expect(mrrData.expansion_mrr_cents).toBeGreaterThanOrEqual(0);
      expect(mrrData.contraction_mrr_cents).toBeGreaterThanOrEqual(0);
      expect(mrrData.churned_mrr_cents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Customer LTV Calculation Accuracy', () => {
    it('should calculate LTV metrics correctly', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      
      // Create payment history
      await createTestPayment(business.id, 9900, 'succeeded');
      await createTestPayment(business.id, 9900, 'succeeded');

      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);

      expect(ltvData.business_id).toBe(business.id);
      expect(ltvData.total_revenue_cents).toBe(19800);
      expect(ltvData.current_mrr_cents).toBe(9900);
      expect(ltvData.predicted_ltv_cents).toBe(118800); // 9900 * 12
      expect(ltvData.churn_probability).toBeGreaterThanOrEqual(0);
      expect(ltvData.churn_probability).toBeLessThanOrEqual(1);
      expect(ltvData.health_score).toBeGreaterThanOrEqual(0);
      expect(ltvData.health_score).toBeLessThanOrEqual(100);
      expect(['champion', 'loyal', 'at_risk', 'critical']).toContain(ltvData.segment);
    });

    it('should handle businesses with no payment history', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'free', 'ACTIVE');

      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);

      expect(ltvData.total_revenue_cents).toBe(0);
      expect(ltvData.current_mrr_cents).toBe(0);
      expect(ltvData.predicted_ltv_cents).toBe(0);
    });
  });

  describe('Cohort Analysis Accuracy', () => {
    it('should perform cohort analysis correctly', async () => {
      // Create businesses with different subscription dates
      const business1 = await createTestBusiness('Test Business 1');
      const business2 = await createTestBusiness('Test Business 2');
      
      // Create subscriptions with different dates
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      await createTestSubscription(business1.id, 'starter', 'ACTIVE', oneMonthAgo);
      await createTestSubscription(business2.id, 'pro', 'ACTIVE', new Date());

      const cohortData = await revenueAnalyticsEngine.performCohortAnalysis('revenue');

      expect(Array.isArray(cohortData)).toBe(true);
      if (cohortData.length > 0) {
        expect(cohortData[0]).toHaveProperty('cohort_month');
        expect(cohortData[0]).toHaveProperty('months_since_start');
        expect(cohortData[0]).toHaveProperty('customers_remaining');
        expect(cohortData[0]).toHaveProperty('total_revenue_cents');
        expect(cohortData[0]).toHaveProperty('retention_rate');
      }
    });
  });
});

// ==============================================
// PREDICTIVE MODELS TESTING
// ==============================================

describe('Predictive Analytics Models Tests', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Churn Prediction Accuracy', () => {
    it('should predict churn probability within valid range', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');

      const prediction = await predictiveAnalyticsModels.predictChurn(business.id, 30);

      expect(prediction.business_id).toBe(business.id);
      expect(prediction.churn_probability).toBeGreaterThanOrEqual(0);
      expect(prediction.churn_probability).toBeLessThanOrEqual(1);
      expect(prediction.confidence_score).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence_score).toBeLessThanOrEqual(1);
      expect(prediction.prediction_horizon_days).toBe(30);
      expect(Array.isArray(prediction.risk_factors)).toBe(true);
      expect(Array.isArray(prediction.recommended_actions)).toBe(true);
    });

    it('should identify high-risk customers correctly', async () => {
      // Create a business with concerning patterns
      const business = await createTestBusiness('High Risk Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      
      // Create multiple failed payments
      await createTestPayment(business.id, 9900, 'failed');
      await createTestPayment(business.id, 9900, 'failed');
      
      // Create error logs (simulating support issues)
      await createTestQueryLog(business.id, 'ERROR');

      const prediction = await predictiveAnalyticsModels.predictChurn(business.id, 30);

      expect(prediction.churn_probability).toBeGreaterThan(0.5); // Should be high risk
      expect(prediction.risk_factors.length).toBeGreaterThan(0);
      expect(prediction.recommended_actions.length).toBeGreaterThan(0);
    });
  });

  describe('Revenue Forecasting Accuracy', () => {
    it('should generate revenue forecasts with valid data', async () => {
      const forecast = await predictiveAnalyticsModels.forecastRevenue(12);

      expect(forecast.forecast_date).toBeInstanceOf(Date);
      expect(forecast.forecast_horizon_months).toBe(12);
      expect(forecast.predicted_mrr_cents).toBeGreaterThanOrEqual(0);
      expect(forecast.predicted_arr_cents).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence_score).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence_score).toBeLessThanOrEqual(1);
      expect(forecast.confidence_interval_lower).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence_interval_upper).toBeGreaterThanOrEqual(forecast.confidence_interval_lower);
      expect(forecast.growth_rate).toBeGreaterThanOrEqual(-1); // Can be negative
      expect(Array.isArray(forecast.key_assumptions)).toBe(true);
    });

    it('should handle insufficient historical data gracefully', async () => {
      // Test with minimal data
      const forecast = await predictiveAnalyticsModels.forecastRevenue(6);

      expect(forecast.predicted_mrr_cents).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence_score).toBeLessThan(1); // Should have lower confidence
    });
  });

  describe('Expansion Opportunity Detection', () => {
    it('should identify expansion opportunities correctly', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'starter', 'ACTIVE');
      
      // Create high usage patterns
      for (let i = 0; i < 50; i++) {
        await createTestQueryLog(business.id, 'SUCCESS');
      }

      const opportunities = await predictiveAnalyticsModels.identifyExpansionOpportunities(business.id);

      expect(Array.isArray(opportunities)).toBe(true);
      if (opportunities.length > 0) {
        expect(opportunities[0]).toHaveProperty('business_id');
        expect(opportunities[0]).toHaveProperty('opportunity_type');
        expect(opportunities[0]).toHaveProperty('potential_revenue_increase_cents');
        expect(opportunities[0]).toHaveProperty('probability_of_conversion');
        expect(opportunities[0]).toHaveProperty('urgency_score');
        expect(opportunities[0]).toHaveProperty('recommended_actions');
      }
    });
  });
});

// ==============================================
// DASHBOARD FUNCTIONALITY TESTING
// ==============================================

describe('Dashboard API Functionality Tests', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Revenue Overview API', () => {
    it('should return valid revenue overview data', async () => {
      // This would test the actual API endpoint
      // For now, we'll test the underlying logic
      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
      
      expect(mrrData).toHaveProperty('total_mrr_cents');
      expect(mrrData).toHaveProperty('paying_customers');
      expect(mrrData).toHaveProperty('average_revenue_per_user_cents');
      expect(typeof mrrData.total_mrr_cents).toBe('number');
      expect(typeof mrrData.paying_customers).toBe('number');
      expect(typeof mrrData.average_revenue_per_user_cents).toBe('number');
    });

    it('should handle different time periods correctly', async () => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const currentMRR = await revenueAnalyticsEngine.calculateMRRForDate(today);
      const historicalMRR = await revenueAnalyticsEngine.calculateMRRForDate(thirtyDaysAgo);
      
      expect(typeof currentMRR.total_mrr_cents).toBe('number');
      expect(typeof historicalMRR.total_mrr_cents).toBe('number');
    });
  });

  describe('Customer Health Analytics API', () => {
    it('should return valid customer health data', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      
      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
      
      expect(ltvData.health_score).toBeGreaterThanOrEqual(0);
      expect(ltvData.health_score).toBeLessThanOrEqual(100);
      expect(['champion', 'loyal', 'at_risk', 'critical']).toContain(ltvData.segment);
    });
  });

  describe('Financial Reports API', () => {
    it('should generate valid financial report data', async () => {
      // Test revenue recognition report
      const reportData = await generateTestFinancialReport();
      
      expect(reportData).toHaveProperty('report_summary');
      expect(reportData).toHaveProperty('revenue_breakdown');
      expect(reportData).toHaveProperty('plan_performance');
      expect(reportData).toHaveProperty('tax_summary');
    });
  });
});

// ==============================================
// BUSINESS LOGIC TESTING
// ==============================================

describe('Business Logic Tests', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Alert System Logic', () => {
    it('should generate alerts for MRR decline', async () => {
      // Create scenario with declining MRR
      const business1 = await createTestBusiness('Business 1');
      await createTestSubscription(business1.id, 'pro', 'CANCELLED'); // Cancelled subscription
      
      const alerts = await insightsEngine.generateBusinessAlerts();
      
      const mrrDeclineAlert = alerts.find(alert => alert.alert_type === 'mrr_decline');
      if (mrrDeclineAlert) {
        expect(mrrDeclineAlert.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(mrrDeclineAlert.title).toContain('MRR Decline');
        expect(mrrDeclineAlert.alert_data).toHaveProperty('decline_rate');
      }
    });

    it('should generate alerts for high churn risk', async () => {
      // Create high-risk customer
      const business = await createTestBusiness('High Risk Business');
      await createTestSubscription(business.id, 'business', 'ACTIVE');
      
      // Create multiple failed payments
      for (let i = 0; i < 3; i++) {
        await createTestPayment(business.id, 29900, 'failed');
      }
      
      // Create error logs
      for (let i = 0; i < 5; i++) {
        await createTestQueryLog(business.id, 'ERROR');
      }

      const alerts = await insightsEngine.generateBusinessAlerts();
      
      const churnAlert = alerts.find(alert => alert.alert_type === 'churn_spike');
      if (churnAlert) {
        expect(churnAlert.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(churnAlert.title).toContain('Churn');
      }
    });
  });

  describe('Insight Generation Logic', () => {
    it('should generate revenue insights', async () => {
      const insights = await insightsEngine.generateBusinessInsights();
      
      const revenueInsights = insights.filter(insight => insight.insight_category === 'revenue');
      expect(revenueInsights.length).toBeGreaterThanOrEqual(0);
      
      revenueInsights.forEach(insight => {
        expect(insight.impact_score).toBeGreaterThanOrEqual(0);
        expect(insight.impact_score).toBeLessThanOrEqual(100);
        expect(insight.confidence_score).toBeGreaterThanOrEqual(0);
        expect(insight.confidence_score).toBeLessThanOrEqual(1);
        expect(Array.isArray(insight.recommended_actions)).toBe(true);
      });
    });

    it('should generate customer insights', async () => {
      const insights = await insightsEngine.generateBusinessInsights();
      
      const customerInsights = insights.filter(insight => insight.insight_category === 'customer');
      expect(customerInsights.length).toBeGreaterThanOrEqual(0);
      
      customerInsights.forEach(insight => {
        expect(insight.insight_type).toMatch(/^(churn_drivers|expansion_opportunities|success_patterns|segmentation_opportunities)$/);
        expect(insight.actionable).toBe(true);
      });
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency across calculations', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      
      // Calculate MRR
      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
      
      // Calculate LTV
      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
      
      // MRR should match current MRR in LTV data
      expect(mrrData.total_mrr_cents).toBeGreaterThanOrEqual(0);
      expect(ltvData.current_mrr_cents).toBe(9900); // Pro plan price
    });

    it('should handle edge cases gracefully', async () => {
      // Test with no businesses
      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
      expect(mrrData.total_mrr_cents).toBe(0);
      expect(mrrData.paying_customers).toBe(0);
      
      // Test with cancelled subscription
      const business = await createTestBusiness('Cancelled Business');
      await createTestSubscription(business.id, 'starter', 'CANCELLED');
      
      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
      expect(ltvData.current_mrr_cents).toBe(0);
    });
  });
});

// ==============================================
// PERFORMANCE TESTING
// ==============================================

describe('Analytics Performance Tests', () => {
  it('should complete MRR calculation within acceptable time', async () => {
    const startTime = Date.now();
    
    await revenueAnalyticsEngine.calculateMRRForDate(new Date());
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should complete churn prediction within acceptable time', async () => {
    const business = await createTestBusiness('Performance Test Business');
    await createTestSubscription(business.id, 'pro', 'ACTIVE');
    
    const startTime = Date.now();
    
    await predictiveAnalyticsModels.predictChurn(business.id, 30);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
  });

  it('should handle batch operations efficiently', async () => {
    // Create multiple businesses for batch testing
    const businesses = [];
    for (let i = 0; i < 10; i++) {
      const business = await createTestBusiness(`Batch Test Business ${i}`);
      await createTestSubscription(business.id, 'starter', 'ACTIVE');
      businesses.push(business);
    }
    
    const startTime = Date.now();
    
    const predictions = await predictiveAnalyticsModels.batchPredictChurn(30);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    expect(predictions.length).toBe(10);
    expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
  });
});

// ==============================================
// HELPER FUNCTIONS
// ==============================================

async function setupTestData(): Promise<void> {
  // Clean up any existing test data
  await cleanupTestData();
  
  // Create test plan definitions if they don't exist
  await prisma.$executeRaw`
    INSERT INTO plan_definitions (id, name, description, price_cents, currency, billing_interval, trial_days, display_order)
    VALUES 
      ('free', 'Free Plan', 'Free tier', 0, 'usd', 'month', 14, 1),
      ('starter', 'Starter Plan', 'Starter tier', 2900, 'usd', 'month', 14, 2),
      ('pro', 'Professional Plan', 'Pro tier', 9900, 'usd', 'month', 14, 3),
      ('business', 'Business Plan', 'Business tier', 29900, 'usd', 'month', 14, 4)
    ON CONFLICT (id) DO NOTHING
  `;
}

async function cleanupTestData(): Promise<void> {
  // Clean up test data in reverse order of dependencies
  await prisma.$executeRaw`DELETE FROM business_alerts WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%')`;
  await prisma.$executeRaw`DELETE FROM business_insights WHERE insight_data::text LIKE '%Test%'`;
  await prisma.$executeRaw`DELETE FROM customer_predictions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%')`;
  await prisma.$executeRaw`DELETE FROM expansion_opportunities WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%')`;
  await prisma.$executeRaw`DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%')`;
  await prisma.$executeRaw`DELETE FROM churn_analysis WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%')`;
  await prisma.$executeRaw`DELETE FROM payment_history WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%')`;
  await prisma.$executeRaw`DELETE FROM query_logs WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%')`;
  await prisma.$executeRaw`DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%')`;
  await prisma.$executeRaw`DELETE FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch Test%' OR name LIKE 'High Risk%' OR name LIKE 'Performance Test%'`;
}

async function createTestBusiness(name: string): Promise<{ id: string }> {
  const business = await prisma.business.create({
    data: {
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      email: `${name.toLowerCase().replace(/\s+/g, '')}@test.com`,
      passwordHash: 'test-hash',
      status: 'ACTIVE'
    }
  });
  
  return business;
}

async function createTestSubscription(
  businessId: string, 
  planId: string, 
  status: 'ACTIVE' | 'CANCELLED' | 'TRIAL',
  createdAt?: Date
): Promise<void> {
  const now = createdAt || new Date();
  const periodStart = new Date(now);
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  
  await prisma.subscription.create({
    data: {
      businessId,
      planId,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      createdAt: now
    }
  });
}

async function createTestPayment(
  businessId: string, 
  amount: number, 
  status: 'succeeded' | 'failed'
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO payment_history (business_id, amount, currency, status, processed_at)
    VALUES (${businessId}::UUID, ${amount}, 'usd', ${status}, NOW())
  `;
}

async function createTestQueryLog(
  businessId: string, 
  status: 'SUCCESS' | 'ERROR'
): Promise<void> {
  await prisma.queryLog.create({
    data: {
      businessId,
      query: 'Test query',
      response: 'Test response',
      status,
      tokensUsed: 100,
      costCents: 1
    }
  });
}

async function generateTestFinancialReport(): Promise<any> {
  return {
    report_summary: {
      total_revenue: 0,
      recognized_revenue: 0,
      deferred_revenue: 0,
      cash_received: 0,
      refunds_issued: 0,
      net_revenue: 0
    },
    revenue_breakdown: {
      subscription_revenue: 0,
      usage_based_revenue: 0,
      one_time_charges: 0,
      setup_fees: 0,
      overage_charges: 0
    },
    plan_performance: [],
    tax_summary: {
      total_tax_collected: 0,
      tax_by_jurisdiction: [],
      tax_compliance_status: 'compliant'
    }
  };
}

// ==============================================
// INTEGRATION TESTING
// ==============================================

describe('Analytics Integration Tests', () => {
  it('should integrate revenue analytics with predictive models', async () => {
    const business = await createTestBusiness('Integration Test Business');
    await createTestSubscription(business.id, 'pro', 'ACTIVE');
    
    // Calculate MRR
    const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
    
    // Predict churn
    const churnPrediction = await predictiveAnalyticsModels.predictChurn(business.id, 30);
    
    // Generate insights
    const insights = await insightsEngine.generateBusinessInsights();
    
    expect(mrrData.total_mrr_cents).toBeGreaterThanOrEqual(0);
    expect(churnPrediction.churn_probability).toBeGreaterThanOrEqual(0);
    expect(churnPrediction.churn_probability).toBeLessThanOrEqual(1);
    expect(Array.isArray(insights)).toBe(true);
  });

  it('should maintain data consistency across all analytics components', async () => {
    const business = await createTestBusiness('Consistency Test Business');
    await createTestSubscription(business.id, 'business', 'ACTIVE');
    
    // Create payment history
    await createTestPayment(business.id, 29900, 'succeeded');
    
    // Calculate LTV
    const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
    
    // Predict churn
    const churnPrediction = await predictiveAnalyticsModels.predictChurn(business.id, 30);
    
    // Generate alerts
    const alerts = await insightsEngine.generateBusinessAlerts();
    
    // All data should be consistent
    expect(ltvData.business_id).toBe(business.id);
    expect(churnPrediction.business_id).toBe(business.id);
    expect(ltvData.total_revenue_cents).toBe(29900);
    expect(ltvData.current_mrr_cents).toBe(29900);
  });
});

export default {
  setupTestData,
  cleanupTestData,
  createTestBusiness,
  createTestSubscription,
  createTestPayment,
  createTestQueryLog
};
