import { Router } from 'express';
import { z } from 'zod';
import { analyticsService } from '../../services/analytics/analytics-service';
import { revenueAnalyticsEngine } from '../../services/analytics/revenue-analytics-engine';
import { predictiveAnalyticsModels } from '../../services/analytics/predictive-models';
import { insightsEngine } from '../../services/analytics/insights-engine';
import dashboardRoutes from './dashboard';

const router = Router();

// ==============================================
// MAIN ANALYTICS API ROUTES
// ==============================================

// Include dashboard routes
router.use('/', dashboardRoutes);

// ==============================================
// ANALYTICS PROCESSING ENDPOINTS
// ==============================================

/**
 * Run comprehensive analytics processing
 * POST /api/v1/analytics/process
 */
router.post('/process', async (req, res) => {
  try {
    const processingStatus = await analyticsService.runAnalyticsProcessing();
    res.json({
      success: true,
      message: 'Analytics processing completed successfully',
      processing_status: processingStatus
    });
  } catch (error) {
    console.error('Analytics processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Analytics processing failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get analytics processing status
 * GET /api/v1/analytics/status
 */
router.get('/status', async (req, res) => {
  try {
    const performance = await analyticsService.getAnalyticsPerformance();
    res.json({
      success: true,
      performance
    });
  } catch (error) {
    console.error('Failed to get analytics status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get comprehensive dashboard data
 * GET /api/v1/analytics/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = await analyticsService.getDashboardData();
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Failed to get dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// REVENUE ANALYTICS ENDPOINTS
// ==============================================

/**
 * Calculate MRR for specific date
 * GET /api/v1/analytics/revenue/mrr?date=2024-01-01
 */
router.get('/revenue/mrr', async (req, res) => {
  try {
    const dateParam = req.query.date as string;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    
    const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(targetDate);
    res.json({
      success: true,
      data: mrrData
    });
  } catch (error) {
    console.error('Failed to calculate MRR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate MRR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get customer LTV metrics
 * GET /api/v1/analytics/customers/:businessId/ltv
 */
router.get('/customers/:businessId/ltv', async (req, res) => {
  try {
    const { businessId } = req.params;
    const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(businessId);
    res.json({
      success: true,
      data: ltvData
    });
  } catch (error) {
    console.error('Failed to calculate customer LTV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate customer LTV',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Perform cohort analysis
 * GET /api/v1/analytics/cohorts?type=revenue
 */
router.get('/cohorts', async (req, res) => {
  try {
    const cohortType = (req.query.type as 'revenue' | 'retention') || 'revenue';
    const cohortData = await revenueAnalyticsEngine.performCohortAnalysis(cohortType);
    res.json({
      success: true,
      data: cohortData
    });
  } catch (error) {
    console.error('Failed to perform cohort analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform cohort analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// PREDICTIVE ANALYTICS ENDPOINTS
// ==============================================

/**
 * Predict customer churn
 * GET /api/v1/analytics/predictions/churn/:businessId?horizon=30
 */
router.get('/predictions/churn/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const horizon = parseInt(req.query.horizon as string) || 30;
    
    const prediction = await predictiveAnalyticsModels.predictChurn(businessId, horizon);
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Failed to predict churn:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict churn',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get revenue forecast
 * GET /api/v1/analytics/forecasts/revenue?horizon=12
 */
router.get('/forecasts/revenue', async (req, res) => {
  try {
    const horizon = parseInt(req.query.horizon as string) || 12;
    const forecast = await predictiveAnalyticsModels.forecastRevenue(horizon);
    res.json({
      success: true,
      data: forecast
    });
  } catch (error) {
    console.error('Failed to generate revenue forecast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate revenue forecast',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Identify expansion opportunities
 * GET /api/v1/analytics/opportunities/:businessId
 */
router.get('/opportunities/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const opportunities = await predictiveAnalyticsModels.identifyExpansionOpportunities(businessId);
    res.json({
      success: true,
      data: opportunities
    });
  } catch (error) {
    console.error('Failed to identify expansion opportunities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to identify expansion opportunities',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// INSIGHTS AND ALERTS ENDPOINTS
// ==============================================

/**
 * Generate business insights
 * POST /api/v1/analytics/insights/generate
 */
router.post('/insights/generate', async (req, res) => {
  try {
    const insights = await insightsEngine.generateBusinessInsights();
    res.json({
      success: true,
      message: `Generated ${insights.length} business insights`,
      data: insights
    });
  } catch (error) {
    console.error('Failed to generate insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate insights',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate business alerts
 * POST /api/v1/analytics/alerts/generate
 */
router.post('/alerts/generate', async (req, res) => {
  try {
    const alerts = await insightsEngine.generateBusinessAlerts();
    res.json({
      success: true,
      message: `Generated ${alerts.length} business alerts`,
      data: alerts
    });
  } catch (error) {
    console.error('Failed to generate alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate alerts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get recent insights
 * GET /api/v1/analytics/insights?limit=20&category=revenue
 */
router.get('/insights', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;
    
    let query = `
      SELECT *
      FROM business_insights
      WHERE generated_at >= NOW() - INTERVAL '30 days'
    `;
    
    if (category) {
      query += ` AND insight_category = '${category}'`;
    }
    
    query += ` ORDER BY generated_at DESC LIMIT ${limit}`;
    
    const insights = await prisma.$queryRawUnsafe(query);
    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error('Failed to get insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get insights',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get recent alerts
 * GET /api/v1/analytics/alerts?limit=20&severity=high&unresolved=true
 */
router.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const severity = req.query.severity as string;
    const unresolved = req.query.unresolved === 'true';
    
    let query = `
      SELECT *
      FROM business_alerts
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;
    
    if (severity) {
      query += ` AND severity = '${severity}'`;
    }
    
    if (unresolved) {
      query += ` AND resolved_at IS NULL`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ${limit}`;
    
    const alerts = await prisma.$queryRawUnsafe(query);
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alerts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Acknowledge alert
 * PUT /api/v1/analytics/alerts/:alertId/acknowledge
 */
router.put('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    await prisma.$executeRaw`
      UPDATE business_alerts
      SET acknowledged_at = NOW()
      WHERE id = ${alertId}::UUID
    `;
    
    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    console.error('Failed to acknowledge alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Resolve alert
 * PUT /api/v1/analytics/alerts/:alertId/resolve
 */
router.put('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    await prisma.$executeRaw`
      UPDATE business_alerts
      SET resolved_at = NOW()
      WHERE id = ${alertId}::UUID
    `;
    
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    console.error('Failed to resolve alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// DATA EXPORT ENDPOINTS
// ==============================================

/**
 * Export analytics data
 * GET /api/v1/analytics/export?format=csv&type=revenue&start_date=2024-01-01&end_date=2024-01-31
 */
router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format as 'csv' | 'json' | 'excel') || 'json';
    const dataType = (req.query.type as 'revenue' | 'customers' | 'financial' | 'all') || 'all';
    const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
    const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
    
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;
    
    const exportResult = await analyticsService.exportAnalyticsData(format, dataType, dateRange);
    
    res.json({
      success: true,
      data: exportResult
    });
  } catch (error) {
    console.error('Failed to export analytics data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// BATCH OPERATIONS ENDPOINTS
// ==============================================

/**
 * Batch predict churn for all customers
 * POST /api/v1/analytics/predictions/batch-churn
 */
router.post('/predictions/batch-churn', async (req, res) => {
  try {
    const horizon = parseInt(req.body.horizon) || 30;
    const predictions = await predictiveAnalyticsModels.batchPredictChurn(horizon);
    
    res.json({
      success: true,
      message: `Generated ${predictions.length} churn predictions`,
      data: predictions
    });
  } catch (error) {
    console.error('Failed to batch predict churn:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch predict churn',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Batch calculate LTV for all customers
 * POST /api/v1/analytics/customers/batch-ltv
 */
router.post('/customers/batch-ltv', async (req, res) => {
  try {
    const businesses = await prisma.business.findMany({
      where: {
        subscriptions: {
          some: { status: 'ACTIVE' }
        }
      },
      select: { id: true }
    });

    const ltvResults = [];
    for (const business of businesses) {
      try {
        const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
        await revenueAnalyticsEngine.storeCustomerLTV(ltvData);
        ltvResults.push(ltvData);
      } catch (error) {
        console.error(`Failed to calculate LTV for business ${business.id}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Calculated LTV for ${ltvResults.length} customers`,
      data: ltvResults
    });
  } catch (error) {
    console.error('Failed to batch calculate LTV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch calculate LTV',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// SCHEDULING ENDPOINTS
// ==============================================

/**
 * Schedule analytics processing
 * POST /api/v1/analytics/schedule
 */
router.post('/schedule', async (req, res) => {
  try {
    await analyticsService.scheduleAnalyticsProcessing();
    res.json({
      success: true,
      message: 'Analytics processing scheduled successfully'
    });
  } catch (error) {
    console.error('Failed to schedule analytics processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule analytics processing',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==============================================
// HEALTH CHECK ENDPOINTS
// ==============================================

/**
 * Analytics system health check
 * GET /api/v1/analytics/health
 */
router.get('/health', async (req, res) => {
  try {
    const performance = await analyticsService.getAnalyticsPerformance();
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        database: 'connected',
        revenue_engine: 'operational',
        predictive_models: 'operational',
        insights_engine: 'operational'
      },
      performance
    };
    
    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    console.error('Analytics health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Analytics health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;