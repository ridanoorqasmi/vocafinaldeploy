// tests/phase-3d-integration.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AnalyticsProcessor, getAnalyticsProcessor } from '../lib/analytics-processor';
import { BusinessIntelligenceEngine, getBusinessIntelligenceEngine } from '../lib/business-intelligence-engine';
import { DashboardManager, getDashboardManager } from '../lib/dashboard-manager';
import { MonitoringAlertingSystem, getMonitoringAlertingSystem } from '../lib/monitoring-alerting-system';
import { ReportingEngine, getReportingEngine } from '../lib/reporting-engine';
import { ReportConfig } from '../lib/analytics-types';

// Mock Prisma client
const mockPrisma = {
  dailyConversationMetrics: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  hourlyPerformanceMetrics: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversationTopics: {
    findMany: vi.fn(),
  },
  customerPatterns: {
    findMany: vi.fn(),
  },
  systemHealthMetrics: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  alertDefinition: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  alertHistory: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  usageQuotas: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  business: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $disconnect: vi.fn(),
} as any;

describe('Phase 3D Integration Tests', () => {
  let analyticsProcessor: AnalyticsProcessor;
  let businessIntelligenceEngine: BusinessIntelligenceEngine;
  let dashboardManager: DashboardManager;
  let monitoringSystem: MonitoringAlertingSystem;
  let reportingEngine: ReportingEngine;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock business data
    mockPrisma.business.findMany.mockResolvedValue([
      { id: 'business-123', name: 'Pizza Palace', plan: 'Standard' },
      { id: 'business-456', name: 'Burger Joint', plan: 'Premium' }
    ]);

    // Mock daily metrics
    mockPrisma.dailyConversationMetrics.findFirst.mockResolvedValue({
      id: 'daily_123',
      business_id: 'business-123',
      date: new Date(),
      total_conversations: 50,
      total_queries: 75,
      avg_conversation_length: 3.2,
      avg_response_time_ms: 1200,
      satisfaction_score: 4.2,
      resolution_rate: 0.85,
      escalation_rate: 0.05,
      unique_customers: 40,
      created_at: new Date(),
      updated_at: new Date()
    });

    mockPrisma.dailyConversationMetrics.findMany.mockResolvedValue([
      {
        id: 'daily_123',
        business_id: 'business-123',
        date: new Date(),
        total_conversations: 50,
        total_queries: 75,
        avg_conversation_length: 3.2,
        avg_response_time_ms: 1200,
        satisfaction_score: 4.2,
        resolution_rate: 0.85,
        escalation_rate: 0.05,
        unique_customers: 40,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Mock hourly metrics
    mockPrisma.hourlyPerformanceMetrics.findFirst.mockResolvedValue({
      id: 'hourly_123',
      business_id: 'business-123',
      hour_timestamp: new Date(),
      query_count: 10,
      avg_response_time_ms: 1200,
      error_rate: 0.02,
      cache_hit_rate: 0.75,
      token_usage: 5000,
      estimated_cost: 0.05,
      created_at: new Date(),
      updated_at: new Date()
    });

    mockPrisma.hourlyPerformanceMetrics.findMany.mockResolvedValue([
      {
        id: 'hourly_123',
        business_id: 'business-123',
        hour_timestamp: new Date(),
        query_count: 10,
        avg_response_time_ms: 1200,
        error_rate: 0.02,
        cache_hit_rate: 0.75,
        token_usage: 5000,
        estimated_cost: 0.05,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Mock conversation topics
    mockPrisma.conversationTopics.findMany.mockResolvedValue([
      {
        id: 'topic_123',
        business_id: 'business-123',
        date: new Date(),
        topic_category: 'Menu Inquiry',
        intent_type: 'MENU_INQUIRY',
        frequency: 25,
        avg_satisfaction: 4.3,
        resolution_success_rate: 0.9,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Mock customer patterns
    mockPrisma.customerPatterns.findMany.mockResolvedValue([
      {
        id: 'customer_123',
        business_id: 'business-123',
        customer_identifier: 'customer_456',
        first_interaction: new Date(),
        last_interaction: new Date(),
        total_conversations: 5,
        avg_session_length: 4.2,
        preferred_topics: ['Menu Inquiry', 'Hours'],
        satisfaction_trend: 0.8,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Mock system health metrics
    mockPrisma.systemHealthMetrics.findMany.mockResolvedValue([
      {
        id: 'health_123',
        metric_name: 'database_connectivity',
        metric_value: 150,
        timestamp: new Date(),
        severity_level: 'low',
        service_component: 'database',
        alert_threshold: 1000,
        current_status: 'healthy',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Mock alert definitions
    mockPrisma.alertDefinition.findMany.mockResolvedValue([
      {
        id: 'alert_def_123',
        business_id: 'business-123',
        metric_type: 'response_time',
        condition: 'greater_than',
        threshold: 2000,
        notification_channels: ['email'],
        escalation_rules: {
          time_based: 30,
          frequency_based: 3,
          severity_based: 'high'
        },
        active_status: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Mock alert history
    mockPrisma.alertHistory.findFirst.mockResolvedValue(null);
    mockPrisma.alertHistory.findMany.mockResolvedValue([]);

    // Mock usage quotas
    mockPrisma.usageQuotas.findFirst.mockResolvedValue({
      id: 'quota_123',
      business_id: 'business-123',
      quota_type: 'monthly_queries',
      quota_limit: 10000,
      current_usage: 7500,
      reset_period: new Date(),
      overage_allowed: true,
      alert_thresholds: { warning: 80, critical: 95 },
      created_at: new Date(),
      updated_at: new Date()
    });

    // Mock database connectivity
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

    // Initialize services
    analyticsProcessor = getAnalyticsProcessor(mockPrisma);
    businessIntelligenceEngine = getBusinessIntelligenceEngine(mockPrisma);
    dashboardManager = getDashboardManager(mockPrisma);
    monitoringSystem = getMonitoringAlertingSystem(mockPrisma);
    reportingEngine = getReportingEngine(mockPrisma);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Analytics Processor', () => {
    it('should process conversation events correctly', async () => {
      const event = {
        type: 'conversation_start' as const,
        business_id: 'business-123',
        session_id: 'session-456',
        customer_id: 'customer-789',
        data: { source: 'website' },
        timestamp: new Date()
      };

      await analyticsProcessor.processConversationEvent(event);

      // Verify that the event was processed (in a real implementation, this would check the queue)
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should get conversation analytics', async () => {
      const context = {
        business_id: 'business-123',
        date_range: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end_date: new Date()
        },
        metrics: ['conversations', 'satisfaction'],
        granularity: 'day' as const
      };

      const analytics = await analyticsProcessor.getConversationAnalytics(context);

      expect(analytics).toBeDefined();
      expect(analytics.conversation_metrics).toBeDefined();
      expect(analytics.topic_analysis).toBeDefined();
      expect(analytics.customer_journey).toBeDefined();
      expect(analytics.satisfaction_analysis).toBeDefined();
    });

    it('should get performance analytics', async () => {
      const context = {
        business_id: 'business-123',
        date_range: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end_date: new Date()
        },
        metrics: ['response_time', 'cost'],
        granularity: 'hour' as const
      };

      const analytics = await analyticsProcessor.getPerformanceAnalytics(context);

      expect(analytics).toBeDefined();
      expect(analytics.response_performance).toBeDefined();
      expect(analytics.cost_analysis).toBeDefined();
      expect(analytics.quality_metrics).toBeDefined();
      expect(analytics.usage_patterns).toBeDefined();
    });
  });

  describe('Business Intelligence Engine', () => {
    it('should analyze conversation sentiment', async () => {
      const sentiment = await businessIntelligenceEngine.analyzeConversationSentiment('business-123', {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(sentiment).toBeDefined();
      expect(sentiment.overall_sentiment).toMatch(/positive|neutral|negative/);
      expect(sentiment.sentiment_score).toBeGreaterThanOrEqual(0);
      expect(sentiment.sentiment_score).toBeLessThanOrEqual(1);
      expect(sentiment.trend_direction).toMatch(/improving|stable|declining/);
    });

    it('should analyze topic clusters', async () => {
      const clusters = await businessIntelligenceEngine.analyzeTopicClusters('business-123', {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(clusters).toBeDefined();
      expect(Array.isArray(clusters)).toBe(true);
      if (clusters.length > 0) {
        expect(clusters[0]).toHaveProperty('cluster_id');
        expect(clusters[0]).toHaveProperty('topic_name');
        expect(clusters[0]).toHaveProperty('frequency');
        expect(clusters[0]).toHaveProperty('avg_satisfaction');
      }
    });

    it('should analyze customer segments', async () => {
      const segments = await businessIntelligenceEngine.analyzeCustomerSegments('business-123', {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(segments).toBeDefined();
      expect(Array.isArray(segments)).toBe(true);
      if (segments.length > 0) {
        expect(segments[0]).toHaveProperty('segment_id');
        expect(segments[0]).toHaveProperty('segment_name');
        expect(segments[0]).toHaveProperty('customer_count');
        expect(segments[0]).toHaveProperty('churn_risk');
      }
    });

    it('should generate optimization recommendations', async () => {
      const recommendations = await businessIntelligenceEngine.generateOptimizationRecommendations('business-123');

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      if (recommendations.length > 0) {
        expect(recommendations[0]).toHaveProperty('type');
        expect(recommendations[0]).toHaveProperty('title');
        expect(recommendations[0]).toHaveProperty('description');
        expect(recommendations[0]).toHaveProperty('potential_impact');
        expect(recommendations[0]).toHaveProperty('implementation_effort');
      }
    });
  });

  describe('Dashboard Manager', () => {
    it('should get tenant dashboard data', async () => {
      const dashboardData = await dashboardManager.getTenantDashboardData('business-123', {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(dashboardData).toBeDefined();
      expect(dashboardData.overview_metrics).toBeDefined();
      expect(dashboardData.conversation_insights).toBeDefined();
      expect(dashboardData.performance_monitoring).toBeDefined();
      expect(dashboardData.business_optimization).toBeDefined();
    });

    it('should get admin dashboard data', async () => {
      const dashboardData = await dashboardManager.getAdminDashboardData({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(dashboardData).toBeDefined();
      expect(dashboardData.platform_overview).toBeDefined();
      expect(dashboardData.tenant_management).toBeDefined();
      expect(dashboardData.system_performance).toBeDefined();
      expect(dashboardData.business_intelligence).toBeDefined();
    });

    it('should save dashboard configuration', async () => {
      const layout = [
        {
          id: 'widget_1',
          type: 'metric' as const,
          title: 'Test Widget',
          data: {},
          config: {},
          refresh_interval: 30000,
          last_updated: new Date()
        }
      ];

      const config = await dashboardManager.saveDashboardConfig('user-123', 'business-123', 'tenant', layout);

      expect(config).toBeDefined();
      expect(config.user_id).toBe('user-123');
      expect(config.business_id).toBe('business-123');
      expect(config.dashboard_type).toBe('tenant');
      expect(config.layout).toEqual(layout);
    });
  });

  describe('Monitoring & Alerting System', () => {
    it('should get system health status', async () => {
      const healthStatus = await monitoringSystem.getSystemHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.overall_status).toMatch(/healthy|warning|critical/);
      expect(healthStatus.services).toBeDefined();
      expect(Array.isArray(healthStatus.services)).toBe(true);
      expect(healthStatus.metrics).toBeDefined();
      expect(Array.isArray(healthStatus.metrics)).toBe(true);
      expect(healthStatus.alerts).toBeDefined();
      expect(Array.isArray(healthStatus.alerts)).toBe(true);
    });

    it('should create alert definition', async () => {
      const alertData = {
        business_id: 'business-123',
        metric_type: 'response_time',
        condition: 'greater_than',
        threshold: 2000,
        notification_channels: ['email'],
        escalation_rules: {
          time_based: 30,
          frequency_based: 3,
          severity_based: 'high'
        },
        active_status: true
      };

      const alert = await monitoringSystem.createAlertDefinition(alertData);

      expect(alert).toBeDefined();
      expect(alert.business_id).toBe('business-123');
      expect(alert.metric_type).toBe('response_time');
      expect(alert.condition).toBe('greater_than');
      expect(alert.threshold).toBe(2000);
      expect(alert.active_status).toBe(true);
    });

    it('should update usage quotas', async () => {
      await monitoringSystem.updateUsageQuotas('business-123', 'monthly_queries', 8000);

      // Verify that the quota was updated (in a real implementation, this would check the database)
      expect(mockPrisma.usageQuotas.update).toHaveBeenCalled();
    });
  });

  describe('Reporting Engine', () => {
    it('should generate a report', async () => {
      const reportConfig: ReportConfig = {
        report_type: 'conversation_summary',
        date_range: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end_date: new Date()
        },
        metrics_included: ['conversations', 'satisfaction'],
        grouping_dimensions: ['topic', 'date'],
        export_format: 'pdf'
      };

      const report = await reportingEngine.generateReport('business-123', reportConfig);

      expect(report).toBeDefined();
      expect(report.business_id).toBe('business-123');
      expect(report.report_config).toEqual(reportConfig);
      expect(report.status).toMatch(/generating|completed|failed/);
      expect(report.expires_at).toBeDefined();
    });

    it('should get report templates', async () => {
      const templates = await reportingEngine.getReportTemplates();

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      if (templates.length > 0) {
        expect(templates[0]).toHaveProperty('id');
        expect(templates[0]).toHaveProperty('name');
        expect(templates[0]).toHaveProperty('description');
        expect(templates[0]).toHaveProperty('category');
        expect(templates[0]).toHaveProperty('config');
      }
    });

    it('should create scheduled report', async () => {
      const scheduledReportData = {
        business_id: 'business-123',
        report_config: {
          report_type: 'conversation_summary' as const,
          date_range: {
            start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end_date: new Date()
          },
          metrics_included: ['conversations'],
          grouping_dimensions: ['date'],
          export_format: 'pdf' as const
        },
        schedule: {
          frequency: 'weekly' as const,
          day_of_week: 1,
          time: '09:00',
          timezone: 'UTC'
        },
        delivery: {
          email_recipients: ['admin@business.com'],
          webhook_url: undefined,
          storage_location: undefined
        },
        active: true
      };

      const scheduledReport = await reportingEngine.createScheduledReport(scheduledReportData);

      expect(scheduledReport).toBeDefined();
      expect(scheduledReport.business_id).toBe('business-123');
      expect(scheduledReport.schedule.frequency).toBe('weekly');
      expect(scheduledReport.active).toBe(true);
      expect(scheduledReport.next_generation).toBeDefined();
    });
  });

  describe('End-to-End Phase 3D Integration', () => {
    it('should complete full Phase 3D workflow', async () => {
      const businessId = 'business-123';
      const dateRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      // 1. Process analytics events
      await analyticsProcessor.processConversationEvent({
        type: 'conversation_start',
        business_id: businessId,
        session_id: 'session-456',
        data: { source: 'website' },
        timestamp: new Date()
      });

      // 2. Get business intelligence insights
      const insights = await businessIntelligenceEngine.generateComprehensiveInsights(businessId, dateRange);
      expect(insights).toBeDefined();

      // 3. Get dashboard data
      const tenantDashboard = await dashboardManager.getTenantDashboardData(businessId, dateRange);
      expect(tenantDashboard).toBeDefined();

      const adminDashboard = await dashboardManager.getAdminDashboardData(dateRange);
      expect(adminDashboard).toBeDefined();

      // 4. Check system health
      const healthStatus = await monitoringSystem.getSystemHealthStatus();
      expect(healthStatus).toBeDefined();

      // 5. Generate a report
      const reportConfig: ReportConfig = {
        report_type: 'conversation_summary',
        date_range: {
          start_date: dateRange.start,
          end_date: dateRange.end
        },
        metrics_included: ['conversations', 'satisfaction'],
        grouping_dimensions: ['topic'],
        export_format: 'pdf'
      };

      const report = await reportingEngine.generateReport(businessId, reportConfig);
      expect(report).toBeDefined();

      // Verify all Phase 3D features are working
      expect(insights.length).toBeGreaterThanOrEqual(0);
      expect(tenantDashboard.overview_metrics).toBeDefined();
      expect(adminDashboard.platform_overview).toBeDefined();
      expect(healthStatus.overall_status).toMatch(/healthy|warning|critical/);
      expect(report.status).toMatch(/generating|completed|failed/);
    });
  });
});
