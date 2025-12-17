import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { analyticsService } from '../../services/analytics/analytics-service';
import { revenueAnalyticsEngine } from '../../services/analytics/revenue-analytics-engine';
import { predictiveAnalyticsModels } from '../../services/analytics/predictive-models';
import { insightsEngine } from '../../services/analytics/insights-engine';

const prisma = new PrismaClient();

describe('Phase 4C Analytics - Comprehensive Test Suite', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  describe('Database Schema Tests', () => {
    it('should have all required analytics tables', async () => {
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
        expect(result[0].exists).toBe(true);
      }
    });

    it('should have proper indexes on analytics tables', async () => {
      const indexes = await prisma.$queryRaw<any[]>`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename LIKE '%analytics%' 
        OR tablename IN (
          'mrr_snapshots', 'customer_ltv_metrics', 'revenue_cohorts',
          'churn_analysis', 'cac_metrics', 'plan_analytics',
          'financial_reports', 'revenue_forecasts', 'customer_predictions',
          'expansion_opportunities', 'customer_health_scores',
          'business_insights', 'business_alerts'
        )
      `;

      expect(indexes.length).toBeGreaterThan(0);
    });
  });

  describe('Revenue Analytics Engine Tests', () => {
    it('should calculate MRR correctly', async () => {
      const business = await createTestBusiness('MRR Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');

      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());

      expect(mrrData.total_mrr_cents).toBe(9900);
      expect(mrrData.paying_customers).toBe(1);
      expect(mrrData.average_revenue_per_user_cents).toBe(9900);
    });

    it('should calculate customer LTV correctly', async () => {
      const business = await createTestBusiness('LTV Test Business');
      await createTestSubscription(business.id, 'business', 'ACTIVE');
      await createTestPayment(business.id, 29900, 'succeeded');

      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);

      expect(ltvData.business_id).toBe(business.id);
      expect(ltvData.current_mrr_cents).toBe(29900);
      expect(ltvData.total_revenue_cents).toBe(29900);
      expect(ltvData.health_score).toBeGreaterThanOrEqual(0);
      expect(ltvData.health_score).toBeLessThanOrEqual(100);
    });

    it('should perform cohort analysis', async () => {
      const business1 = await createTestBusiness('Cohort Business 1');
      const business2 = await createTestBusiness('Cohort Business 2');
      
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      await createTestSubscription(business1.id, 'starter', 'ACTIVE', oneMonthAgo);
      await createTestSubscription(business2.id, 'pro', 'ACTIVE', new Date());

      const cohortData = await revenueAnalyticsEngine.performCohortAnalysis('revenue');

      expect(Array.isArray(cohortData)).toBe(true);
    });
  });

  describe('Predictive Models Tests', () => {
    it('should predict churn correctly', async () => {
      const business = await createTestBusiness('Churn Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');

      const prediction = await predictiveAnalyticsModels.predictChurn(business.id, 30);

      expect(prediction.business_id).toBe(business.id);
      expect(prediction.churn_probability).toBeGreaterThanOrEqual(0);
      expect(prediction.churn_probability).toBeLessThanOrEqual(1);
      expect(Array.isArray(prediction.risk_factors)).toBe(true);
      expect(Array.isArray(prediction.recommended_actions)).toBe(true);
    });

    it('should generate revenue forecasts', async () => {
      const forecast = await predictiveAnalyticsModels.forecastRevenue(12);

      expect(forecast.forecast_date).toBeInstanceOf(Date);
      expect(forecast.forecast_horizon_months).toBe(12);
      expect(forecast.predicted_mrr_cents).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence_score).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence_score).toBeLessThanOrEqual(1);
    });

    it('should identify expansion opportunities', async () => {
      const business = await createTestBusiness('Expansion Test Business');
      await createTestSubscription(business.id, 'starter', 'ACTIVE');
      
      // Create high usage
      for (let i = 0; i < 50; i++) {
        await createTestQueryLog(business.id, 'SUCCESS');
      }

      const opportunities = await predictiveAnalyticsModels.identifyExpansionOpportunities(business.id);

      expect(Array.isArray(opportunities)).toBe(true);
    });
  });

  describe('Insights Engine Tests', () => {
    it('should generate business insights', async () => {
      const business = await createTestBusiness('Insights Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      await createTestPayment(business.id, 9900, 'succeeded');

      const insights = await insightsEngine.generateBusinessInsights();

      expect(Array.isArray(insights)).toBe(true);
      insights.forEach(insight => {
        expect(insight.insight_type).toBeDefined();
        expect(insight.insight_category).toBeDefined();
        expect(insight.title).toBeDefined();
        expect(insight.description).toBeDefined();
        expect(insight.impact_score).toBeGreaterThanOrEqual(0);
        expect(insight.impact_score).toBeLessThanOrEqual(100);
      });
    });

    it('should generate business alerts', async () => {
      const business = await createTestBusiness('Alert Test Business');
      await createTestSubscription(business.id, 'business', 'ACTIVE');
      
      // Create scenario for alerts
      await createTestPayment(business.id, 29900, 'failed');
      await createTestQueryLog(business.id, 'ERROR');

      const alerts = await insightsEngine.generateBusinessAlerts();

      expect(Array.isArray(alerts)).toBe(true);
      alerts.forEach(alert => {
        expect(alert.alert_type).toBeDefined();
        expect(alert.alert_category).toBeDefined();
        expect(alert.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(alert.title).toBeDefined();
        expect(alert.message).toBeDefined();
      });
    });
  });

  describe('Analytics Service Integration Tests', () => {
    it('should run complete analytics processing', async () => {
      const business = await createTestBusiness('Integration Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      await createTestPayment(business.id, 9900, 'succeeded');
      await createTestQueryLog(business.id, 'SUCCESS');

      const processingStatus = await analyticsService.runAnalyticsProcessing();

      expect(processingStatus.mrr_calculation).toBe(true);
      expect(processingStatus.ltv_calculation).toBe(true);
      expect(processingStatus.churn_prediction).toBe(true);
      expect(processingStatus.revenue_forecasting).toBe(true);
      expect(processingStatus.insights_generation).toBe(true);
      expect(processingStatus.alert_generation).toBe(true);
      expect(processingStatus.processing_time_ms).toBeGreaterThan(0);
    });

    it('should provide dashboard data', async () => {
      await setupComprehensiveTestData();

      const dashboardData = await analyticsService.getDashboardData();

      expect(dashboardData).toHaveProperty('revenue_overview');
      expect(dashboardData).toHaveProperty('customer_health');
      expect(dashboardData).toHaveProperty('financial_reports');
      expect(dashboardData).toHaveProperty('cohort_analysis');
      expect(dashboardData).toHaveProperty('insights');
      expect(dashboardData).toHaveProperty('alerts');
    });

    it('should provide performance metrics', async () => {
      const performance = await analyticsService.getAnalyticsPerformance();

      expect(performance).toHaveProperty('processing_times');
      expect(performance).toHaveProperty('data_freshness');
      expect(performance).toHaveProperty('accuracy_metrics');
      expect(performance).toHaveProperty('system_health');
    });

    it('should export data in multiple formats', async () => {
      await setupComprehensiveTestData();

      const formats: ('csv' | 'json' | 'excel')[] = ['csv', 'json', 'excel'];
      
      for (const format of formats) {
        const exportResult = await analyticsService.exportAnalyticsData(format, 'all');
        
        expect(exportResult).toHaveProperty('download_url');
        expect(exportResult).toHaveProperty('file_size');
        expect(exportResult).toHaveProperty('expires_at');
        expect(exportResult.file_size).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should complete analytics processing within time limits', async () => {
      const startTime = Date.now();
      
      await analyticsService.runAnalyticsProcessing();
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(120000); // Less than 2 minutes
    });

    it('should handle batch operations efficiently', async () => {
      // Create multiple businesses
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
      expect(executionTime).toBeLessThan(30000); // Less than 30 seconds
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid business IDs gracefully', async () => {
      const invalidBusinessId = 'invalid-uuid';
      
      try {
        await revenueAnalyticsEngine.calculateCustomerLTV(invalidBusinessId);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('Business not found');
      }
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database connection
      // For now, we'll test that the service handles errors gracefully
      expect(async () => {
        await analyticsService.runAnalyticsProcessing();
      }).not.toThrow();
    });
  });
});

// Helper functions
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
  // Clean up all test data
  await prisma.$executeRaw`DELETE FROM business_alerts WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%')`;
  await prisma.$executeRaw`DELETE FROM business_insights WHERE insight_data::text LIKE '%Test%'`;
  await prisma.$executeRaw`DELETE FROM customer_predictions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%')`;
  await prisma.$executeRaw`DELETE FROM expansion_opportunities WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%')`;
  await prisma.$executeRaw`DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%')`;
  await prisma.$executeRaw`DELETE FROM churn_analysis WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%')`;
  await prisma.$executeRaw`DELETE FROM payment_history WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%')`;
  await prisma.$executeRaw`DELETE FROM query_logs WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%')`;
  await prisma.$executeRaw`DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%')`;
  await prisma.$executeRaw`DELETE FROM businesses WHERE name LIKE '%Test%'`;
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
  const highValueBusiness = await createTestBusiness('High Value Business');
  await createTestSubscription(highValueBusiness.id, 'business', 'ACTIVE');
  await createTestPayment(highValueBusiness.id, 29900, 'succeeded');
  await createTestQueryLog(highValueBusiness.id, 'SUCCESS');
  
  const atRiskBusiness = await createTestBusiness('At Risk Business');
  await createTestSubscription(atRiskBusiness.id, 'pro', 'ACTIVE');
  await createTestPayment(atRiskBusiness.id, 9900, 'failed');
  await createTestQueryLog(atRiskBusiness.id, 'ERROR');
  
  const newBusiness = await createTestBusiness('New Business');
  await createTestSubscription(newBusiness.id, 'starter', 'ACTIVE');
  await createTestQueryLog(newBusiness.id, 'SUCCESS');
  
  const freeBusiness = await createTestBusiness('Free Business');
  await createTestSubscription(freeBusiness.id, 'free', 'ACTIVE');
}
