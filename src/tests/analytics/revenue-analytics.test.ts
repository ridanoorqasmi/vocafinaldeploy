import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { revenueAnalyticsEngine } from '../../services/analytics/revenue-analytics-engine';
import { setupTestEnvironment, teardownTestEnvironment, prisma } from './test-setup';

describe('Revenue Analytics Engine Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('MRR Calculation', () => {
    it('should calculate MRR correctly for active subscriptions', async () => {
      const business1 = await createTestBusiness('Test Business 1');
      const business2 = await createTestBusiness('Test Business 2');
      
      await createTestSubscription(business1.id, 'starter', 'ACTIVE');
      await createTestSubscription(business2.id, 'pro', 'ACTIVE');

      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());

      expect(mrrData.total_mrr_cents).toBe(12800); // $29 + $99
      expect(mrrData.paying_customers).toBe(2);
      expect(mrrData.average_revenue_per_user_cents).toBe(6400);
    });

    it('should handle no active subscriptions', async () => {
      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
      
      expect(mrrData.total_mrr_cents).toBe(0);
      expect(mrrData.paying_customers).toBe(0);
      expect(mrrData.average_revenue_per_user_cents).toBe(0);
    });

    it('should store MRR snapshot correctly', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');

      const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
      await revenueAnalyticsEngine.storeMRRSnapshot(mrrData, new Date());

      const storedSnapshot = await prisma.$queryRaw<any[]>`
        SELECT * FROM mrr_snapshots 
        WHERE snapshot_date = CURRENT_DATE
      `;

      expect(storedSnapshot.length).toBe(1);
      expect(storedSnapshot[0].total_mrr_cents).toBe(mrrData.total_mrr_cents);
    });
  });

  describe('Customer LTV Calculation', () => {
    it('should calculate LTV metrics correctly', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      await createTestPayment(business.id, 9900, 'succeeded');

      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);

      expect(ltvData.business_id).toBe(business.id);
      expect(ltvData.current_mrr_cents).toBe(9900);
      expect(ltvData.total_revenue_cents).toBe(9900);
      expect(ltvData.churn_probability).toBeGreaterThanOrEqual(0);
      expect(ltvData.churn_probability).toBeLessThanOrEqual(1);
      expect(ltvData.health_score).toBeGreaterThanOrEqual(0);
      expect(ltvData.health_score).toBeLessThanOrEqual(100);
      expect(['champion', 'loyal', 'at_risk', 'critical']).toContain(ltvData.segment);
    });

    it('should handle business with no payment history', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'free', 'ACTIVE');

      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);

      expect(ltvData.total_revenue_cents).toBe(0);
      expect(ltvData.current_mrr_cents).toBe(0);
    });

    it('should store LTV metrics correctly', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'starter', 'ACTIVE');

      const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
      await revenueAnalyticsEngine.storeCustomerLTV(ltvData);

      const storedLTV = await prisma.$queryRaw<any[]>`
        SELECT * FROM customer_ltv_metrics 
        WHERE business_id = ${business.id}::UUID
      `;

      expect(storedLTV.length).toBe(1);
      expect(storedLTV[0].business_id).toBe(business.id);
    });
  });

  describe('Cohort Analysis', () => {
    it('should perform cohort analysis correctly', async () => {
      const business1 = await createTestBusiness('Cohort Business 1');
      const business2 = await createTestBusiness('Cohort Business 2');
      
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

  describe('Churn Analysis', () => {
    it('should analyze churn risk correctly', async () => {
      const business = await createTestBusiness('Churn Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      await createTestPayment(business.id, 9900, 'failed');
      await createTestQueryLog(business.id, 'ERROR');

      const churnAnalysis = await revenueAnalyticsEngine.analyzeChurnRisk(business.id);

      expect(churnAnalysis.business_id).toBe(business.id);
      expect(churnAnalysis.churn_probability).toBeGreaterThanOrEqual(0);
      expect(churnAnalysis.churn_probability).toBeLessThanOrEqual(1);
      expect(typeof churnAnalysis.churn_risk_factors).toBe('object');
      expect(typeof churnAnalysis.recommended_actions).toBe('object');
      expect(['increasing', 'stable', 'declining']).toContain(churnAnalysis.usage_trend);
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
    await prisma.$executeRaw`DELETE FROM business_alerts WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%')`;
    await prisma.$executeRaw`DELETE FROM business_insights WHERE insight_data::text LIKE '%Test%'`;
    await prisma.$executeRaw`DELETE FROM customer_predictions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%')`;
    await prisma.$executeRaw`DELETE FROM expansion_opportunities WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%')`;
    await prisma.$executeRaw`DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%')`;
    await prisma.$executeRaw`DELETE FROM churn_analysis WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%')`;
    await prisma.$executeRaw`DELETE FROM payment_history WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%')`;
    await prisma.$executeRaw`DELETE FROM query_logs WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%')`;
    await prisma.$executeRaw`DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%')`;
    await prisma.$executeRaw`DELETE FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Cohort%' OR name LIKE 'Churn%'`;
  } catch (error) {
    // Ignore cleanup errors for tables that might not exist
    console.warn('Warning during test cleanup:', error.message);
  }
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
      responseTime: 100,
      metadata: { tokensUsed: 100, costCents: 1 }
    }
  });
}
