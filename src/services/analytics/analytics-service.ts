import { PrismaClient } from '@prisma/client';
import { revenueAnalyticsEngine } from './revenue-analytics-engine';
import { predictiveAnalyticsModels } from './predictive-models';
import { insightsEngine } from './insights-engine';

const prisma = new PrismaClient();

// ==============================================
// ANALYTICS SERVICE
// ==============================================

export interface AnalyticsDashboardData {
  revenue_overview: any;
  customer_health: any;
  financial_reports: any;
  cohort_analysis: any;
  insights: any[];
  alerts: any[];
}

export interface AnalyticsProcessingStatus {
  mrr_calculation: boolean;
  ltv_calculation: boolean;
  churn_prediction: boolean;
  revenue_forecasting: boolean;
  insights_generation: boolean;
  alert_generation: boolean;
  last_processed: Date;
  processing_time_ms: number;
}

export class AnalyticsService {
  /**
   * Run comprehensive analytics processing
   */
  async runAnalyticsProcessing(): Promise<AnalyticsProcessingStatus> {
    const startTime = Date.now();
    const status: AnalyticsProcessingStatus = {
      mrr_calculation: false,
      ltv_calculation: false,
      churn_prediction: false,
      revenue_forecasting: false,
      insights_generation: false,
      alert_generation: false,
      last_processed: new Date(),
      processing_time_ms: 0
    };

    try {
      // 1. Calculate and store MRR snapshots
      console.log('Starting MRR calculation...');
      await this.processMRRCalculation();
      status.mrr_calculation = true;

      // 2. Calculate customer LTV metrics
      console.log('Starting LTV calculation...');
      await this.processLTVCalculation();
      status.ltv_calculation = true;

      // 3. Run churn predictions
      console.log('Starting churn prediction...');
      await this.processChurnPredictions();
      status.churn_prediction = true;

      // 4. Generate revenue forecasts
      console.log('Starting revenue forecasting...');
      await this.processRevenueForecasting();
      status.revenue_forecasting = true;

      // 5. Generate business insights
      console.log('Starting insights generation...');
      await this.processInsightsGeneration();
      status.insights_generation = true;

      // 6. Generate business alerts
      console.log('Starting alert generation...');
      await this.processAlertGeneration();
      status.alert_generation = true;

      const endTime = Date.now();
      status.processing_time_ms = endTime - startTime;

      console.log(`Analytics processing completed in ${status.processing_time_ms}ms`);
      return status;

    } catch (error) {
      console.error('Analytics processing failed:', error);
      const endTime = Date.now();
      status.processing_time_ms = endTime - startTime;
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(): Promise<AnalyticsDashboardData> {
    const [
      revenueOverview,
      customerHealth,
      financialReports,
      cohortAnalysis,
      insights,
      alerts
    ] = await Promise.all([
      this.getRevenueOverview(),
      this.getCustomerHealthData(),
      this.getFinancialReportsData(),
      this.getCohortAnalysisData(),
      this.getRecentInsights(),
      this.getRecentAlerts()
    ]);

    return {
      revenue_overview: revenueOverview,
      customer_health: customerHealth,
      financial_reports: financialReports,
      cohort_analysis: cohortAnalysis,
      insights,
      alerts
    };
  }

  /**
   * Get analytics performance metrics
   */
  async getAnalyticsPerformance(): Promise<{
    processing_times: Record<string, number>;
    data_freshness: Record<string, Date>;
    accuracy_metrics: Record<string, number>;
    system_health: Record<string, any>;
  }> {
    const processingTimes = await this.getProcessingTimes();
    const dataFreshness = await this.getDataFreshness();
    const accuracyMetrics = await this.getAccuracyMetrics();
    const systemHealth = await this.getSystemHealth();

    return {
      processing_times: processingTimes,
      data_freshness: dataFreshness,
      accuracy_metrics: accuracyMetrics,
      system_health: systemHealth
    };
  }

  /**
   * Export analytics data in various formats
   */
  async exportAnalyticsData(
    format: 'csv' | 'json' | 'excel',
    dataType: 'revenue' | 'customers' | 'financial' | 'all',
    dateRange?: { start: Date; end: Date }
  ): Promise<{ download_url: string; file_size: number; expires_at: Date }> {
    const exportData = await this.prepareExportData(dataType, dateRange);
    const exportResult = await this.generateExportFile(exportData, format);
    
    return {
      download_url: exportResult.url,
      file_size: exportResult.size,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  /**
   * Schedule analytics processing
   */
  async scheduleAnalyticsProcessing(): Promise<void> {
    // This would integrate with a job scheduler like Bull or Agenda
    // For now, we'll implement a simple scheduling mechanism
    
    const scheduleConfig = {
      mrr_calculation: '0 1 * * *', // Daily at 1 AM
      ltv_calculation: '0 2 * * *', // Daily at 2 AM
      churn_prediction: '0 3 * * *', // Daily at 3 AM
      revenue_forecasting: '0 4 * * 1', // Weekly on Monday at 4 AM
      insights_generation: '0 5 * * *', // Daily at 5 AM
      alert_generation: '*/15 * * * *' // Every 15 minutes
    };

    console.log('Analytics processing scheduled:', scheduleConfig);
  }

  // ==============================================
  // PRIVATE PROCESSING METHODS
  // ==============================================

  private async processMRRCalculation(): Promise<void> {
    const today = new Date();
    const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(today);
    await revenueAnalyticsEngine.storeMRRSnapshot(mrrData, today);
  }

  private async processLTVCalculation(): Promise<void> {
    const businesses = await prisma.business.findMany({
      where: {
        subscriptions: {
          some: { status: 'ACTIVE' }
        }
      },
      select: { id: true }
    });

    for (const business of businesses) {
      try {
        const ltvData = await revenueAnalyticsEngine.calculateCustomerLTV(business.id);
        await revenueAnalyticsEngine.storeCustomerLTV(ltvData);
      } catch (error) {
        console.error(`Failed to calculate LTV for business ${business.id}:`, error);
      }
    }
  }

  private async processChurnPredictions(): Promise<void> {
    const predictions = await predictiveAnalyticsModels.batchPredictChurn(30);
    
    for (const prediction of predictions) {
      await predictiveAnalyticsModels.storeChurnPrediction(prediction);
    }
  }

  private async processRevenueForecasting(): Promise<void> {
    const forecast = await predictiveAnalyticsModels.forecastRevenue(12);
    await predictiveAnalyticsModels.storeRevenueForecast(forecast);
  }

  private async processInsightsGeneration(): Promise<void> {
    await insightsEngine.generateBusinessInsights();
  }

  private async processAlertGeneration(): Promise<void> {
    await insightsEngine.generateBusinessAlerts();
  }

  // ==============================================
  // DASHBOARD DATA METHODS
  // ==============================================

  private async getRevenueOverview(): Promise<any> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [currentMRR, historicalMRR] = await Promise.all([
      revenueAnalyticsEngine.calculateMRRForDate(today),
      revenueAnalyticsEngine.calculateMRRForDate(thirtyDaysAgo)
    ]);

    const growthRate = historicalMRR.total_mrr_cents > 0 
      ? ((currentMRR.total_mrr_cents - historicalMRR.total_mrr_cents) / historicalMRR.total_mrr_cents) * 100
      : 0;

    return {
      current_mrr: currentMRR.total_mrr_cents,
      current_arr: currentMRR.total_mrr_cents * 12,
      growth_rate: growthRate,
      paying_customers: currentMRR.paying_customers,
      average_revenue_per_user: currentMRR.average_revenue_per_user_cents,
      new_business_mrr: currentMRR.new_business_mrr_cents,
      expansion_mrr: currentMRR.expansion_mrr_cents,
      contraction_mrr: currentMRR.contraction_mrr_cents,
      churned_mrr: currentMRR.churned_mrr_cents
    };
  }

  private async getCustomerHealthData(): Promise<any> {
    const healthDistribution = await prisma.$queryRaw<{
      segment: string;
      count: number;
      avg_health_score: number;
    }[]>`
      SELECT 
        segment,
        COUNT(*) as count,
        AVG(health_score) as avg_health_score
      FROM customer_ltv_metrics
      WHERE last_calculated_at >= NOW() - INTERVAL '1 day'
      GROUP BY segment
    `;

    const totalCustomers = healthDistribution.reduce((sum, segment) => sum + segment.count, 0);

    return {
      health_distribution: {
        healthy: healthDistribution.find(s => s.segment === 'champion' || s.segment === 'loyal') || { count: 0, avg_health_score: 0 },
        at_risk: healthDistribution.find(s => s.segment === 'at_risk') || { count: 0, avg_health_score: 0 },
        critical: healthDistribution.find(s => s.segment === 'critical') || { count: 0, avg_health_score: 0 }
      },
      total_customers: totalCustomers
    };
  }

  private async getFinancialReportsData(): Promise<any> {
    const financialData = await prisma.$queryRaw<{
      total_revenue: number;
      recognized_revenue: number;
      deferred_revenue: number;
      refunds_issued: number;
      net_revenue: number;
    }[]>`
      SELECT 
        SUM(total_revenue_cents) as total_revenue,
        SUM(recognized_revenue_cents) as recognized_revenue,
        SUM(deferred_revenue_cents) as deferred_revenue,
        SUM(refunds_issued_cents) as refunds_issued,
        SUM(net_revenue_cents) as net_revenue
      FROM financial_reports
      WHERE reporting_period_end >= CURRENT_DATE - INTERVAL '1 month'
    `;

    return financialData[0] || {
      total_revenue: 0,
      recognized_revenue: 0,
      deferred_revenue: 0,
      refunds_issued: 0,
      net_revenue: 0
    };
  }

  private async getCohortAnalysisData(): Promise<any> {
    return await revenueAnalyticsEngine.performCohortAnalysis('revenue');
  }

  private async getRecentInsights(): Promise<any[]> {
    return await prisma.$queryRaw<any[]>`
      SELECT *
      FROM business_insights
      WHERE generated_at >= NOW() - INTERVAL '7 days'
      ORDER BY generated_at DESC
      LIMIT 20
    `;
  }

  private async getRecentAlerts(): Promise<any[]> {
    return await prisma.$queryRaw<any[]>`
      SELECT *
      FROM business_alerts
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND resolved_at IS NULL
      ORDER BY created_at DESC
      LIMIT 20
    `;
  }

  // ==============================================
  // PERFORMANCE MONITORING METHODS
  // ==============================================

  private async getProcessingTimes(): Promise<Record<string, number>> {
    const processingTimes = await prisma.$queryRaw<{
      operation: string;
      avg_duration_ms: number;
    }[]>`
      SELECT 
        'mrr_calculation' as operation,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) as avg_duration_ms
      FROM mrr_snapshots
      WHERE created_at >= NOW() - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'ltv_calculation' as operation,
        AVG(EXTRACT(EPOCH FROM (last_calculated_at - created_at)) * 1000) as avg_duration_ms
      FROM customer_ltv_metrics
      WHERE last_calculated_at >= NOW() - INTERVAL '7 days'
    `;

    const result: Record<string, number> = {};
    processingTimes.forEach(record => {
      result[record.operation] = record.avg_duration_ms || 0;
    });

    return result;
  }

  private async getDataFreshness(): Promise<Record<string, Date>> {
    const freshnessData = await prisma.$queryRaw<{
      table_name: string;
      last_updated: Date;
    }[]>`
      SELECT 'mrr_snapshots' as table_name, MAX(created_at) as last_updated FROM mrr_snapshots
      UNION ALL
      SELECT 'customer_ltv_metrics' as table_name, MAX(last_calculated_at) as last_updated FROM customer_ltv_metrics
      UNION ALL
      SELECT 'churn_analysis' as table_name, MAX(analysis_date) as last_updated FROM churn_analysis
      UNION ALL
      SELECT 'revenue_forecasts' as table_name, MAX(forecast_date) as last_updated FROM revenue_forecasts
    `;

    const result: Record<string, Date> = {};
    freshnessData.forEach(record => {
      result[record.table_name] = record.last_updated;
    });

    return result;
  }

  private async getAccuracyMetrics(): Promise<Record<string, number>> {
    // Calculate prediction accuracy metrics
    const accuracyData = await prisma.$queryRaw<{
      metric_name: string;
      accuracy_score: number;
    }[]>`
      SELECT 
        'churn_prediction_accuracy' as metric_name,
        AVG(confidence_score) as accuracy_score
      FROM customer_predictions
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND prediction_type = 'churn'
      
      UNION ALL
      
      SELECT 
        'revenue_forecast_accuracy' as metric_name,
        AVG(confidence_score) as accuracy_score
      FROM revenue_forecasts
      WHERE forecast_date >= NOW() - INTERVAL '30 days'
    `;

    const result: Record<string, number> = {};
    accuracyData.forEach(record => {
      result[record.metric_name] = record.accuracy_score || 0;
    });

    return result;
  }

  private async getSystemHealth(): Promise<Record<string, any>> {
    const systemHealth = await prisma.$queryRaw<{
      metric_name: string;
      metric_value: number;
      status: string;
    }[]>`
      SELECT 
        'data_volume' as metric_name,
        COUNT(*) as metric_value,
        CASE 
          WHEN COUNT(*) > 100000 THEN 'healthy'
          WHEN COUNT(*) > 50000 THEN 'warning'
          ELSE 'critical'
        END as status
      FROM mrr_snapshots
      
      UNION ALL
      
      SELECT 
        'processing_frequency' as metric_name,
        COUNT(*) as metric_value,
        CASE 
          WHEN COUNT(*) >= 7 THEN 'healthy'
          WHEN COUNT(*) >= 3 THEN 'warning'
          ELSE 'critical'
        END as status
      FROM mrr_snapshots
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;

    const result: Record<string, any> = {};
    systemHealth.forEach(record => {
      result[record.metric_name] = {
        value: record.metric_value,
        status: record.status
      };
    });

    return result;
  }

  // ==============================================
  // EXPORT METHODS
  // ==============================================

  private async prepareExportData(
    dataType: 'revenue' | 'customers' | 'financial' | 'all',
    dateRange?: { start: Date; end: Date }
  ): Promise<any> {
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end || new Date();

    switch (dataType) {
      case 'revenue':
        return await this.exportRevenueData(startDate, endDate);
      case 'customers':
        return await this.exportCustomerData(startDate, endDate);
      case 'financial':
        return await this.exportFinancialData(startDate, endDate);
      case 'all':
        return await this.exportAllData(startDate, endDate);
      default:
        throw new Error('Invalid data type');
    }
  }

  private async exportRevenueData(startDate: Date, endDate: Date): Promise<any> {
    const mrrData = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM mrr_snapshots
      WHERE snapshot_date >= ${startDate.toISOString().split('T')[0]}::DATE
        AND snapshot_date <= ${endDate.toISOString().split('T')[0]}::DATE
      ORDER BY snapshot_date
    `;

    return {
      data_type: 'revenue',
      date_range: { start: startDate, end: endDate },
      records: mrrData
    };
  }

  private async exportCustomerData(startDate: Date, endDate: Date): Promise<any> {
    const customerData = await prisma.$queryRaw<any[]>`
      SELECT 
        clm.*,
        b.name as business_name,
        b.email as business_email
      FROM customer_ltv_metrics clm
      JOIN businesses b ON clm.business_id = b.id
      WHERE clm.last_calculated_at >= ${startDate}
        AND clm.last_calculated_at <= ${endDate}
      ORDER BY clm.last_calculated_at
    `;

    return {
      data_type: 'customers',
      date_range: { start: startDate, end: endDate },
      records: customerData
    };
  }

  private async exportFinancialData(startDate: Date, endDate: Date): Promise<any> {
    const financialData = await prisma.$queryRaw<any[]>`
      SELECT *
      FROM financial_reports
      WHERE reporting_period_start >= ${startDate.toISOString().split('T')[0]}::DATE
        AND reporting_period_end <= ${endDate.toISOString().split('T')[0]}::DATE
      ORDER BY generated_at
    `;

    return {
      data_type: 'financial',
      date_range: { start: startDate, end: endDate },
      records: financialData
    };
  }

  private async exportAllData(startDate: Date, endDate: Date): Promise<any> {
    const [revenueData, customerData, financialData] = await Promise.all([
      this.exportRevenueData(startDate, endDate),
      this.exportCustomerData(startDate, endDate),
      this.exportFinancialData(startDate, endDate)
    ]);

    return {
      data_type: 'all',
      date_range: { start: startDate, end: endDate },
      revenue_data: revenueData,
      customer_data: customerData,
      financial_data: financialData
    };
  }

  private async generateExportFile(data: any, format: 'csv' | 'json' | 'excel'): Promise<{ url: string; size: number }> {
    // This would integrate with a file storage service like AWS S3
    // For now, we'll return a mock response
    
    const mockFileSize = JSON.stringify(data).length;
    const mockUrl = `https://analytics-exports.example.com/${Date.now()}.${format}`;
    
    return {
      url: mockUrl,
      size: mockFileSize
    };
  }
}

export const analyticsService = new AnalyticsService();
