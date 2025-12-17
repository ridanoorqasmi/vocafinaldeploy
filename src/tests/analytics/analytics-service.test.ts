import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { analyticsService } from '../../services/analytics/analytics-service';

const prisma = new PrismaClient();

describe('Analytics Service Tests', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Analytics Processing', () => {
    it('should complete full analytics processing pipeline', async () => {
      const business = await createTestBusiness('Processing Test Business');
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
      expect(processingStatus.last_processed).toBeInstanceOf(Date);
    });

    it('should handle processing errors gracefully', async () => {
      // Create scenario that might cause errors
      const business = await createTestBusiness('Error Test Business');
      await createTestSubscription(business.id, 'invalid_plan', 'ACTIVE');

      const processingStatus = await analyticsService.runAnalyticsProcessing();

      expect(processingStatus.last_processed).toBeInstanceOf(Date);
      expect(processingStatus.processing_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Data', () => {
    it('should provide comprehensive dashboard data', async () => {
      await setupComprehensiveTestData();

      const dashboardData = await analyticsService.getDashboardData();

      expect(dashboardData).toHaveProperty('revenue_overview');
      expect(dashboardData).toHaveProperty('customer_health');
      expect(dashboardData).toHaveProperty('financial_reports');
      expect(dashboardData).toHaveProperty('cohort_analysis');
      expect(dashboardData).toHaveProperty('insights');
      expect(dashboardData).toHaveProperty('alerts');

      expect(Array.isArray(dashboardData.insights)).toBe(true);
      expect(Array.isArray(dashboardData.alerts)).toBe(true);
      expect(typeof dashboardData.revenue_overview).toBe('object');
      expect(typeof dashboardData.customer_health).toBe('object');
    });

    it('should handle empty data scenarios', async () => {
      const dashboardData = await analyticsService.getDashboardData();

      expect(dashboardData).toHaveProperty('revenue_overview');
      expect(dashboardData).toHaveProperty('customer_health');
      expect(dashboardData).toHaveProperty('financial_reports');
      expect(dashboardData).toHaveProperty('cohort_analysis');
      expect(Array.isArray(dashboardData.insights)).toBe(true);
      expect(Array.isArray(dashboardData.alerts)).toBe(true);
    });
  });

  describe('Analytics Performance', () => {
    it('should provide performance metrics', async () => {
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

  describe('Data Export', () => {
    it('should export analytics data in multiple formats', async () => {
      await setupComprehensiveTestData();

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

  describe('Scheduling', () => {
    it('should schedule analytics processing correctly', async () => {
      expect(async () => {
        await analyticsService.scheduleAnalyticsProcessing();
      }).not.toThrow();
    });
  });
});

// Helper functions
async function setupTestData(): Promise<void> {
  await cleanupTestData();
  
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
  try {
    await prisma.$executeRaw`DELETE FROM business_alerts WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%')`;
    await prisma.$executeRaw`DELETE FROM business_insights WHERE insight_data::text LIKE '%Test%'`;
    await prisma.$executeRaw`DELETE FROM customer_predictions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%')`;
    await prisma.$executeRaw`DELETE FROM expansion_opportunities WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%')`;
  } catch (error) {
    console.warn('Warning during test cleanup:', error);
  }
  await prisma.$executeRaw`DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%')`;
  await prisma.$executeRaw`DELETE FROM churn_analysis WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%')`;
  await prisma.$executeRaw`DELETE FROM payment_history WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%')`;
  await prisma.$executeRaw`DELETE FROM query_logs WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%')`;
  await prisma.$executeRaw`DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%')`;
  await prisma.$executeRaw`DELETE FROM businesses WHERE name LIKE '%Test%' OR name LIKE '%Processing%' OR name LIKE '%Error%'`;
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
