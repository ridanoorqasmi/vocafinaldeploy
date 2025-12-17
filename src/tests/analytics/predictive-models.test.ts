import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { predictiveAnalyticsModels } from '../../services/analytics/predictive-models';

const prisma = new PrismaClient();

describe('Predictive Analytics Models Tests', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Churn Prediction', () => {
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
      const business = await createTestBusiness('High Risk Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      
      // Create multiple failed payments
      await createTestPayment(business.id, 9900, 'failed');
      await createTestPayment(business.id, 9900, 'failed');
      
      // Create error logs
      await createTestQueryLog(business.id, 'ERROR');

      const prediction = await predictiveAnalyticsModels.predictChurn(business.id, 30);

      expect(prediction.churn_probability).toBeGreaterThan(0.5);
      expect(prediction.risk_factors.length).toBeGreaterThan(0);
      expect(prediction.recommended_actions.length).toBeGreaterThan(0);
    });

    it('should store churn prediction correctly', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'starter', 'ACTIVE');

      const prediction = await predictiveAnalyticsModels.predictChurn(business.id, 30);
      await predictiveAnalyticsModels.storeChurnPrediction(prediction);

      const storedPrediction = await prisma.$queryRaw<any[]>`
        SELECT * FROM customer_predictions 
        WHERE business_id = ${business.id}::UUID
        AND prediction_type = 'churn'
      `;

      expect(storedPrediction.length).toBe(1);
      expect(storedPrediction[0].business_id).toBe(business.id);
    });
  });

  describe('Revenue Forecasting', () => {
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
      expect(forecast.growth_rate).toBeGreaterThanOrEqual(-1);
      expect(Array.isArray(forecast.key_assumptions)).toBe(true);
    });

    it('should store revenue forecast correctly', async () => {
      const forecast = await predictiveAnalyticsModels.forecastRevenue(6);
      await predictiveAnalyticsModels.storeRevenueForecast(forecast);

      const storedForecast = await prisma.$queryRaw<any[]>`
        SELECT * FROM revenue_forecasts 
        WHERE forecast_horizon_months = 6
        ORDER BY forecast_date DESC
        LIMIT 1
      `;

      expect(storedForecast.length).toBe(1);
      expect(storedForecast[0].predicted_mrr_cents).toBe(forecast.predicted_mrr_cents);
    });
  });

  describe('Expansion Opportunities', () => {
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

    it('should store expansion opportunities correctly', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'starter', 'ACTIVE');

      const opportunities = await predictiveAnalyticsModels.identifyExpansionOpportunities(business.id);
      await predictiveAnalyticsModels.storeExpansionOpportunities(opportunities);

      const storedOpportunities = await prisma.$queryRaw<any[]>`
        SELECT * FROM expansion_opportunities 
        WHERE business_id = ${business.id}::UUID
      `;

      expect(storedOpportunities.length).toBe(opportunities.length);
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch churn predictions efficiently', async () => {
      // Create multiple businesses
      const businesses = [];
      for (let i = 0; i < 5; i++) {
        const business = await createTestBusiness(`Batch Test Business ${i}`);
        await createTestSubscription(business.id, 'starter', 'ACTIVE');
        businesses.push(business);
      }

      const startTime = Date.now();
      const predictions = await predictiveAnalyticsModels.batchPredictChurn(30);
      const endTime = Date.now();

      expect(predictions.length).toBe(5);
      expect(endTime - startTime).toBeLessThan(30000); // Less than 30 seconds
      
      predictions.forEach(prediction => {
        expect(prediction.churn_probability).toBeGreaterThanOrEqual(0);
        expect(prediction.churn_probability).toBeLessThanOrEqual(1);
      });
    });
  });
});

// Helper functions (same as revenue-analytics.test.ts)
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
    await prisma.$executeRaw`DELETE FROM business_alerts WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%')`;
    await prisma.$executeRaw`DELETE FROM business_insights WHERE insight_data::text LIKE '%Test%'`;
    await prisma.$executeRaw`DELETE FROM customer_predictions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%')`;
    await prisma.$executeRaw`DELETE FROM expansion_opportunities WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%')`;
  } catch (error) {
    console.warn('Warning during test cleanup:', error);
  }
  await prisma.$executeRaw`DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%')`;
  await prisma.$executeRaw`DELETE FROM churn_analysis WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%')`;
  await prisma.$executeRaw`DELETE FROM payment_history WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%')`;
  await prisma.$executeRaw`DELETE FROM query_logs WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%')`;
  await prisma.$executeRaw`DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%')`;
  await prisma.$executeRaw`DELETE FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'Batch%' OR name LIKE 'High Risk%'`;
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
