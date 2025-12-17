import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { analyticsService } from '../../services/analytics/analytics-service';
import { revenueAnalyticsEngine } from '../../services/analytics/revenue-analytics-engine';
import { predictiveAnalyticsModels } from '../../services/analytics/predictive-models';
import { insightsEngine } from '../../services/analytics/insights-engine';

const prisma = new PrismaClient();

// ==============================================
// ANALYTICS INTEGRATION TESTS
// ==============================================

describe('Analytics Integration Tests', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('End-to-End Analytics Processing', () => {
    it('should complete full analytics processing pipeline', async () => {
      // Create test data
      const business = await createTestBusiness('Integration Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      await createTestPayment(business.id, 9900, 'succeeded');
      await createTestQueryLog(business.id, 'SUCCESS');

      // Run analytics processing
      const processingStatus = await analyticsService.runAnalyticsProcessing();

      // Verify all components completed successfully
      expect(processingStatus.mrr_calculation).toBe(true);
      expect(processingStatus.ltv_calculation).toBe(true);
      expect(processingStatus.churn_prediction).toBe(true);
      expect(processingStatus.revenue_forecasting).toBe(true);
      expect(processingStatus.insights_generation).toBe(true);
      expect(processingStatus.alert_generation).toBe(true);
      expect(processingStatus.processing_time_ms).toBeGreaterThan(0);
    });

    it('should handle processing errors gracefully', async () => {
      // Create scenario that might cause errors
      const business = await createTestBusiness('Error Test Business');
      await createTestSubscription(business.id, 'invalid_plan', 'ACTIVE');

      // Run analytics processing - should not throw
      const processingStatus = await analyticsService.runAnalyticsProcessing();

      // Should complete with some components potentially failing
      expect(processingStatus.last_processed).toBeInstanceOf(Date);
      expect(processingStatus.processing_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Data Integration', () => {
    it('should provide comprehensive dashboard data', async () => {
      // Setup test data
      await setupComprehensiveTestData();

      // Get dashboard data
      const dashboardData = await analyticsService.getDashboardData();

      // Verify all dashboard components are present
      expect(dashboardData).toHaveProperty('revenue_overview');
      expect(dashboardData).toHaveProperty('customer_health');
      expect(dashboardData).toHaveProperty('financial_reports');
      expect(dashboardData).toHaveProperty('cohort_analysis');
      expect(dashboardData).toHaveProperty('insights');
      expect(dashboardData).toHaveProperty('alerts');

      // Verify data structure
      expect(Array.isArray(dashboardData.insights)).toBe(true);
      expect(Array.isArray(dashboardData.alerts)).toBe(true);
      expect(typeof dashboardData.revenue_overview).toBe('object');
      expect(typeof dashboardData.customer_health).toBe('object');
    });

    it('should handle empty data scenarios', async () => {
      // Get dashboard data with no test data
      const dashboardData = await analyticsService.getDashboardData();

      // Should return valid structure even with no data
      expect(dashboardData).toHaveProperty('revenue_overview');
      expect(dashboardData).toHaveProperty('customer_health');
      expect(dashboardData).toHaveProperty('financial_reports');
      expect(dashboardData).toHaveProperty('cohort_analysis');
      expect(Array.isArray(dashboardData.insights)).toBe(true);
      expect(Array.isArray(dashboardData.alerts)).toBe(true);
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency across all analytics components', async () => {
      const business = await createTestBusiness('Consistency Test Business');
      await createTestSubscription(business.id, 'business', 'ACTIVE');
      await createTestPayment(business.id, 29900, 'succeeded');
      await createTestQueryLog(business.id, 'SUCCESS');

      // Calculate MRR
      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
      
      // Calculate LTV
      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
      
      // Predict churn
      const churnPrediction = await predictiveAnalyticsModels.predictChurn(business.id, 30);
      
      // Generate insights
      const insights = await insightsEngine.generateBusinessInsights();
      
      // Generate alerts
      const alerts = await insightsEngine.generateBusinessAlerts();

      // Verify data consistency
      expect(mrrData.total_mrr_cents).toBeGreaterThanOrEqual(0);
      expect(ltvData.business_id).toBe(business.id);
      expect(churnPrediction.business_id).toBe(business.id);
      expect(Array.isArray(insights)).toBe(true);
      expect(Array.isArray(alerts)).toBe(true);

      // Verify LTV data consistency
      expect(ltvData.total_revenue_cents).toBe(29900);
      expect(ltvData.current_mrr_cents).toBe(29900);
    });

    it('should handle concurrent analytics operations', async () => {
      const businesses = [];
      for (let i = 0; i < 5; i++) {
        const business = await createTestBusiness(`Concurrent Test Business ${i}`);
        await createTestSubscription(business.id, 'starter', 'ACTIVE');
        businesses.push(business);
      }

      // Run concurrent operations
      const operations = businesses.map(business => 
        Promise.all([
          revenueAnalyticsEngine.calculateCustomerLTV(business.id),
          predictiveAnalyticsModels.predictChurn(business.id, 30)
        ])
      );

      const results = await Promise.all(operations);

      // Verify all operations completed successfully
      expect(results.length).toBe(5);
      results.forEach(([ltvData, churnPrediction]) => {
        expect(ltvData.business_id).toBeDefined();
        expect(churnPrediction.business_id).toBeDefined();
        expect(churnPrediction.churn_probability).toBeGreaterThanOrEqual(0);
        expect(churnPrediction.churn_probability).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Performance Integration Tests', () => {
    it('should complete analytics processing within performance thresholds', async () => {
      // Setup larger dataset
      await setupLargeTestDataset();

      const startTime = Date.now();
      
      // Run analytics processing
      const processingStatus = await analyticsService.runAnalyticsProcessing();
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify performance thresholds
      expect(processingStatus.processing_time_ms).toBeLessThan(60000); // Less than 1 minute
      expect(totalTime).toBeLessThan(120000); // Less than 2 minutes total
      expect(processingStatus.mrr_calculation).toBe(true);
      expect(processingStatus.ltv_calculation).toBe(true);
    });

    it('should handle batch operations efficiently', async () => {
      // Create multiple businesses
      const businesses = [];
      for (let i = 0; i < 20; i++) {
        const business = await createTestBusiness(`Batch Test Business ${i}`);
        await createTestSubscription(business.id, 'starter', 'ACTIVE');
        businesses.push(business);
      }

      const startTime = Date.now();
      
      // Run batch churn prediction
      const predictions = await predictiveAnalyticsModels.batchPredictChurn(30);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify batch operation performance
      expect(predictions.length).toBe(20);
      expect(executionTime).toBeLessThan(30000); // Less than 30 seconds
    });
  });

  describe('Error Handling Integration Tests', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database connection error
      const originalQuery = prisma.$queryRaw;
      prisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      try {
        const processingStatus = await analyticsService.runAnalyticsProcessing();
        
        // Should handle error gracefully
        expect(processingStatus.last_processed).toBeInstanceOf(Date);
      } catch (error) {
        // Should throw meaningful error
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Database connection failed');
      } finally {
        // Restore original function
        prisma.$queryRaw = originalQuery;
      }
    });

    it('should handle invalid business IDs gracefully', async () => {
      const invalidBusinessId = 'invalid-uuid';
      
      try {
        await revenueAnalyticsEngine.calculateCustomerLTV(invalidBusinessId);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Business not found');
      }
    });

    it('should handle malformed data gracefully', async () => {
      // Create business with invalid subscription data
      const business = await createTestBusiness('Malformed Data Business');
      
      // Create subscription with invalid plan
      await prisma.subscription.create({
        data: {
          businessId: business.id,
          planId: 'invalid_plan',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      // Should handle gracefully
      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
      expect(ltvData.business_id).toBe(business.id);
      expect(ltvData.current_mrr_cents).toBe(0); // Invalid plan should default to 0
    });
  });

  describe('Data Export Integration Tests', () => {
    it('should export analytics data in multiple formats', async () => {
      await setupComprehensiveTestData();

      // Test different export formats
      const formats: ('csv' | 'json' | 'excel')[] = ['csv', 'json', 'excel'];
      
      for (const format of formats) {
        const exportResult = await analyticsService.exportAnalyticsData(format, 'all');
        
        expect(exportResult).toHaveProperty('download_url');
        expect(exportResult).toHaveProperty('file_size');
        expect(exportResult).toHaveProperty('expires_at');
        expect(exportResult.file_size).toBeGreaterThan(0);
        expect(exportResult.download_url).toContain(format);
      }
    });

    it('should handle date range filtering in exports', async () => {
      await setupComprehensiveTestData();

      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      const exportResult = await analyticsService.exportAnalyticsData(
        'json', 
        'revenue', 
        { start: startDate, end: endDate }
      );
      
      expect(exportResult).toHaveProperty('download_url');
      expect(exportResult).toHaveProperty('file_size');
      expect(exportResult.file_size).toBeGreaterThan(0);
    });
  });

  describe('Scheduling Integration Tests', () => {
    it('should schedule analytics processing correctly', async () => {
      // This would test integration with job scheduler
      // For now, we'll test the scheduling method exists
      await expect(analyticsService.scheduleAnalyticsProcessing()).resolves.not.toThrow();
    });
  });

  describe('Health Check Integration Tests', () => {
    it('should provide comprehensive health status', async () => {
      const performance = await analyticsService.getAnalyticsPerformance();
      
      expect(performance).toHaveProperty('processing_times');
      expect(performance).toHaveProperty('data_freshness');
      expect(performance).toHaveProperty('accuracy_metrics');
      expect(performance).toHaveProperty('system_health');
      
      expect(typeof performance.processing_times).toBe('object');
      expect(typeof performance.data_freshness).toBe('object');
      expect(typeof performance.accuracy_metrics).toBe('object');
      expect(typeof performance.system_health).toBe('object');
    });
  });
});

// ==============================================
// HELPER FUNCTIONS
// ==============================================

async function setupTestEnvironment(): Promise<void> {
  await cleanupTestEnvironment();
  
  // Create test plan definitions
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

async function cleanupTestEnvironment(): Promise<void> {
  // Clean up test data in reverse order of dependencies
  await prisma.$executeRaw`DELETE FROM business_alerts WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%')`;
  await prisma.$executeRaw`DELETE FROM business_insights WHERE insight_data::text LIKE '%Test%'`;
  await prisma.$executeRaw`DELETE FROM customer_predictions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%')`;
  await prisma.$executeRaw`DELETE FROM expansion_opportunities WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%')`;
  await prisma.$executeRaw`DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%')`;
  await prisma.$executeRaw`DELETE FROM churn_analysis WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%')`;
  await prisma.$executeRaw`DELETE FROM payment_history WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%')`;
  await prisma.$executeRaw`DELETE FROM query_logs WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%')`;
  await prisma.$executeRaw`DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%')`;
  await prisma.$executeRaw`DELETE FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Integration%' OR name LIKE '%Concurrent%' OR name LIKE '%Batch%' OR name LIKE '%Malformed%'`;
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

async function setupComprehensiveTestData(): Promise<void> {
  // Create multiple businesses with different characteristics
  const businesses = [];
  
  // High-value business
  const highValueBusiness = await createTestBusiness('High Value Business');
  await createTestSubscription(highValueBusiness.id, 'business', 'ACTIVE');
  await createTestPayment(highValueBusiness.id, 29900, 'succeeded');
  await createTestQueryLog(highValueBusiness.id, 'SUCCESS');
  businesses.push(highValueBusiness);
  
  // At-risk business
  const atRiskBusiness = await createTestBusiness('At Risk Business');
  await createTestSubscription(atRiskBusiness.id, 'pro', 'ACTIVE');
  await createTestPayment(atRiskBusiness.id, 9900, 'failed');
  await createTestPayment(atRiskBusiness.id, 9900, 'failed');
  await createTestQueryLog(atRiskBusiness.id, 'ERROR');
  businesses.push(atRiskBusiness);
  
  // New business
  const newBusiness = await createTestBusiness('New Business');
  await createTestSubscription(newBusiness.id, 'starter', 'ACTIVE');
  await createTestQueryLog(newBusiness.id, 'SUCCESS');
  businesses.push(newBusiness);
  
  // Free tier business
  const freeBusiness = await createTestBusiness('Free Business');
  await createTestSubscription(freeBusiness.id, 'free', 'ACTIVE');
  businesses.push(freeBusiness);
}

async function setupLargeTestDataset(): Promise<void> {
  // Create larger dataset for performance testing
  const businesses = [];
  
  for (let i = 0; i < 50; i++) {
    const business = await createTestBusiness(`Performance Test Business ${i}`);
    const planId = ['free', 'starter', 'pro', 'business'][i % 4];
    await createTestSubscription(business.id, planId, 'ACTIVE');
    
    if (planId !== 'free') {
      const planPrices = { starter: 2900, pro: 9900, business: 29900 };
      await createTestPayment(business.id, planPrices[planId as keyof typeof planPrices], 'succeeded');
    }
    
    // Create some query logs
    for (let j = 0; j < Math.floor(Math.random() * 10) + 1; j++) {
      await createTestQueryLog(business.id, Math.random() > 0.1 ? 'SUCCESS' : 'ERROR');
    }
    
    businesses.push(business);
  }
}

export default {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createTestBusiness,
  createTestSubscription,
  createTestPayment,
  createTestQueryLog,
  setupComprehensiveTestData,
  setupLargeTestDataset
};
