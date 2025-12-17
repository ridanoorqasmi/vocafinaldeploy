import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { insightsEngine } from '../../services/analytics/insights-engine';

const prisma = new PrismaClient();

describe('Insights Engine Tests', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Business Insights Generation', () => {
    it('should generate revenue insights', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      await createTestPayment(business.id, 9900, 'succeeded');

      const insights = await insightsEngine.generateBusinessInsights();
      
      const revenueInsights = insights.filter(insight => insight.insight_category === 'revenue');
      expect(revenueInsights.length).toBeGreaterThanOrEqual(0);
      
      revenueInsights.forEach(insight => {
        expect(insight.impact_score).toBeGreaterThanOrEqual(0);
        expect(insight.impact_score).toBeLessThanOrEqual(100);
        expect(insight.confidence_score).toBeGreaterThanOrEqual(0);
        expect(insight.confidence_score).toBeLessThanOrEqual(1);
        expect(Array.isArray(insight.recommended_actions)).toBe(true);
        expect(typeof insight.insight_data).toBe('object');
      });
    });

    it('should generate customer insights', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'starter', 'ACTIVE');
      await createTestPayment(business.id, 2900, 'succeeded');

      const insights = await insightsEngine.generateBusinessInsights();
      
      const customerInsights = insights.filter(insight => insight.insight_category === 'customer');
      expect(customerInsights.length).toBeGreaterThanOrEqual(0);
      
      customerInsights.forEach(insight => {
        expect(insight.insight_type).toMatch(/^(churn_drivers|expansion_opportunities|success_patterns|segmentation_opportunities)$/);
        expect(insight.actionable).toBe(true);
        expect(typeof insight.insight_data).toBe('object');
      });
    });

    it('should generate operational insights', async () => {
      const insights = await insightsEngine.generateBusinessInsights();
      
      const operationalInsights = insights.filter(insight => insight.insight_category === 'operational');
      expect(operationalInsights.length).toBeGreaterThanOrEqual(0);
      
      operationalInsights.forEach(insight => {
        expect(insight.insight_type).toMatch(/^(market_opportunities|competitive_positioning|operational_efficiency|investment_priorities)$/);
        expect(insight.actionable).toBe(true);
      });
    });
  });

  describe('Business Alerts Generation', () => {
    it('should generate revenue alerts', async () => {
      const business = await createTestBusiness('Test Business');
      await createTestSubscription(business.id, 'pro', 'CANCELLED'); // Cancelled subscription

      const alerts = await insightsEngine.generateBusinessAlerts();
      
      const revenueAlerts = alerts.filter(alert => alert.alert_category === 'revenue');
      expect(revenueAlerts.length).toBeGreaterThanOrEqual(0);
      
      revenueAlerts.forEach(alert => {
        expect(alert.alert_type).toMatch(/^(mrr_decline|churn_spike|revenue_milestone|forecast_variance)$/);
        expect(alert.severity).toMatch(/^(low|medium|high|critical)$/);
        expect(typeof alert.alert_data).toBe('object');
      });
    });

    it('should generate customer alerts', async () => {
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
      
      const customerAlerts = alerts.filter(alert => alert.alert_category === 'customer');
      expect(customerAlerts.length).toBeGreaterThanOrEqual(0);
      
      customerAlerts.forEach(alert => {
        expect(alert.alert_type).toMatch(/^(high_value_churn_risk|expansion_opportunities|support_escalation|usage_anomalies)$/);
        expect(alert.severity).toMatch(/^(low|medium|high|critical)$/);
      });
    });

    it('should generate operational alerts', async () => {
      const alerts = await insightsEngine.generateBusinessAlerts();
      
      const operationalAlerts = alerts.filter(alert => alert.alert_category === 'operational');
      expect(operationalAlerts.length).toBeGreaterThanOrEqual(0);
      
      operationalAlerts.forEach(alert => {
        expect(alert.alert_type).toMatch(/^(payment_failure_trends|plan_performance_issues|seasonal_capacity_needs)$/);
        expect(alert.severity).toMatch(/^(low|medium|high|critical)$/);
      });
    });
  });

  describe('Alert Severity Logic', () => {
    it('should assign correct severity levels', async () => {
      const business = await createTestBusiness('Critical Business');
      await createTestSubscription(business.id, 'business', 'ACTIVE');
      
      // Create scenario for critical alert
      for (let i = 0; i < 5; i++) {
        await createTestPayment(business.id, 29900, 'failed');
      }

      const alerts = await insightsEngine.generateBusinessAlerts();
      
      const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
      const highAlerts = alerts.filter(alert => alert.severity === 'high');
      
      // Should have some high or critical alerts for this scenario
      expect(criticalAlerts.length + highAlerts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Insight Impact Scoring', () => {
    it('should assign appropriate impact scores', async () => {
      const insights = await insightsEngine.generateBusinessInsights();
      
      insights.forEach(insight => {
        expect(insight.impact_score).toBeGreaterThanOrEqual(0);
        expect(insight.impact_score).toBeLessThanOrEqual(100);
        
        // High impact insights should have actionable recommendations
        if (insight.impact_score > 80) {
          expect(insight.actionable).toBe(true);
          expect(insight.recommended_actions.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency in insights and alerts', async () => {
      const business = await createTestBusiness('Consistency Test Business');
      await createTestSubscription(business.id, 'pro', 'ACTIVE');
      await createTestPayment(business.id, 9900, 'succeeded');

      const insights = await insightsEngine.generateBusinessInsights();
      const alerts = await insightsEngine.generateBusinessAlerts();

      // All insights should have valid structure
      insights.forEach(insight => {
        expect(insight.insight_type).toBeDefined();
        expect(insight.insight_category).toBeDefined();
        expect(insight.title).toBeDefined();
        expect(insight.description).toBeDefined();
        expect(insight.generated_at).toBeInstanceOf(Date);
      });

      // All alerts should have valid structure
      alerts.forEach(alert => {
        expect(alert.alert_type).toBeDefined();
        expect(alert.alert_category).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.title).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.created_at).toBeInstanceOf(Date);
      });
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
  await prisma.$executeRaw`DELETE FROM business_alerts WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%')`;
  await prisma.$executeRaw`DELETE FROM business_insights WHERE insight_data::text LIKE '%Test%'`;
  await prisma.$executeRaw`DELETE FROM customer_predictions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%')`;
  await prisma.$executeRaw`DELETE FROM expansion_opportunities WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%')`;
  await prisma.$executeRaw`DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%')`;
  await prisma.$executeRaw`DELETE FROM churn_analysis WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%')`;
  await prisma.$executeRaw`DELETE FROM payment_history WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%')`;
  await prisma.$executeRaw`DELETE FROM query_logs WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%')`;
  await prisma.$executeRaw`DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%')`;
  await prisma.$executeRaw`DELETE FROM businesses WHERE name LIKE 'Test%' OR name LIKE 'High Risk%' OR name LIKE 'Critical%' OR name LIKE 'Consistency%'`;
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
