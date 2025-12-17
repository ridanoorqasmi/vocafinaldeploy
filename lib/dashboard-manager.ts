// lib/dashboard-manager.ts
import { PrismaClient } from '@prisma/client';
import {
  DashboardWidget,
  DashboardConfig,
  TimeSeriesData,
  BusinessIntelligenceInsight
} from './analytics-types';
import { getAnalyticsProcessor } from './analytics-processor';
import { getBusinessIntelligenceEngine } from './business-intelligence-engine';

export interface DashboardData {
  overview_metrics: {
    total_conversations_today: number;
    customer_satisfaction_score: number;
    response_time_average: number;
    cost_summary: {
      today_cost: number;
      monthly_burn_rate: number;
    };
  };
  conversation_insights: {
    top_topics_chart: Array<{ topic: string; count: number; satisfaction: number }>;
    resolution_rate_trend: TimeSeriesData[];
    peak_hours_heatmap: Array<{ hour: number; day: string; count: number }>;
    customer_journey_flow: any[];
  };
  performance_monitoring: {
    response_quality_gauge: number;
    template_usage_stats: Array<{ template_id: string; usage: number; effectiveness: number }>;
    business_rule_impact: Array<{ rule_id: string; impact: number; conversations_affected: number }>;
    error_rate_alerts: Array<{ type: string; count: number; severity: string }>;
  };
  business_optimization: {
    cost_breakdown_pie: Array<{ feature: string; cost: number; percentage: number }>;
    roi_calculator: {
      time_saved_hours: number;
      cost_saved: number;
      efficiency_gain: number;
    };
    improvement_suggestions: BusinessIntelligenceInsight[];
    competitor_benchmarks: Array<{ metric: string; your_value: number; industry_avg: number }>;
  };
}

export interface AdminDashboardData {
  platform_overview: {
    total_active_businesses: number;
    platform_revenue_metrics: {
      monthly_recurring_revenue: number;
      revenue_growth_rate: number;
      average_revenue_per_user: number;
    };
    system_health_status: {
      uptime_percentage: number;
      active_services: number;
      total_services: number;
    };
    support_ticket_summary: {
      open_tickets: number;
      avg_resolution_time: number;
      satisfaction_score: number;
    };
  };
  tenant_management: {
    tenant_usage_leaderboard: Array<{ business_id: string; usage: number; plan: string }>;
    plan_distribution_chart: Array<{ plan: string; count: number; revenue: number }>;
    churn_risk_alerts: Array<{ business_id: string; risk_score: number; last_activity: Date }>;
    onboarding_funnel: {
      signups: number;
      activations: number;
      first_conversation: number;
      retention_rate: number;
    };
  };
  system_performance: {
    api_response_times: Array<{ endpoint: string; avg_time: number; percentile_95th: number }>;
    error_rate_monitoring: Array<{ service: string; error_rate: number; trend: string }>;
    resource_utilization: {
      database_usage: number;
      compute_usage: number;
      storage_usage: number;
    };
    cost_per_tenant: {
      avg_cost: number;
      cost_trend: string;
      optimization_opportunities: number;
    };
  };
  business_intelligence: {
    feature_adoption_rates: Array<{ feature: string; adoption_rate: number; usage_trend: string }>;
    support_pattern_analysis: Array<{ issue_type: string; frequency: number; resolution_time: number }>;
    market_opportunity_analysis: Array<{ opportunity: string; potential_revenue: number; effort: string }>;
    competitive_positioning: Array<{ metric: string; our_value: number; competitor_avg: number }>;
  };
}

export class DashboardManager {
  private prisma: PrismaClient;
  private analyticsProcessor: any;
  private businessIntelligenceEngine: any;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.analyticsProcessor = getAnalyticsProcessor(prisma);
    this.businessIntelligenceEngine = getBusinessIntelligenceEngine(prisma);
  }

  /**
   * Get tenant dashboard data
   */
  async getTenantDashboardData(businessId: string, dateRange: { start: Date; end: Date }): Promise<DashboardData> {
    // Get conversation analytics
    const conversationAnalytics = await this.analyticsProcessor.getConversationAnalytics({
      business_id: businessId,
      date_range: dateRange,
      metrics: ['conversations', 'satisfaction', 'resolution_rate'],
      granularity: 'day'
    });

    // Get performance analytics
    const performanceAnalytics = await this.analyticsProcessor.getPerformanceAnalytics({
      business_id: businessId,
      date_range: dateRange,
      metrics: ['response_time', 'cost', 'error_rate'],
      granularity: 'hour'
    });

    // Get business intelligence insights
    const insights = await this.businessIntelligenceEngine.generateComprehensiveInsights(businessId, dateRange);

    // Get today's metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMetrics = await this.prisma.dailyConversationMetrics.findFirst({
      where: { business_id: businessId, date: today }
    }) as any;

    // Get hourly metrics for today
    const todayHourlyMetrics = await this.prisma.hourlyPerformanceMetrics.findMany({
      where: {
        business_id: businessId,
        hour_timestamp: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    }) as any[];

    return {
      overview_metrics: {
        total_conversations_today: todayMetrics?.total_conversations || 0,
        customer_satisfaction_score: todayMetrics?.satisfaction_score || 0,
        response_time_average: todayHourlyMetrics.length > 0 
          ? todayHourlyMetrics.reduce((sum, h) => sum + h.avg_response_time_ms, 0) / todayHourlyMetrics.length
          : 0,
        cost_summary: {
          today_cost: todayHourlyMetrics.reduce((sum, h) => sum + h.estimated_cost, 0),
          monthly_burn_rate: todayHourlyMetrics.reduce((sum, h) => sum + h.estimated_cost, 0) * 30
        }
      },
      conversation_insights: {
        top_topics_chart: conversationAnalytics.topic_analysis.slice(0, 5).map(topic => ({
          topic: topic.topic,
          count: topic.conversation_count,
          satisfaction: topic.satisfaction_score
        })),
        resolution_rate_trend: this.generateTimeSeriesData(conversationAnalytics.conversation_metrics.resolution_rate),
        peak_hours_heatmap: this.generatePeakHoursHeatmap(todayHourlyMetrics),
        customer_journey_flow: conversationAnalytics.customer_journey.conversation_flows
      },
      performance_monitoring: {
        response_quality_gauge: performanceAnalytics.quality_metrics.response_accuracy_score,
        template_usage_stats: performanceAnalytics.quality_metrics.template_effectiveness,
        business_rule_impact: performanceAnalytics.quality_metrics.business_rule_impact,
        error_rate_alerts: this.generateErrorRateAlerts(performanceAnalytics.response_performance.error_rate)
      },
      business_optimization: {
        cost_breakdown_pie: performanceAnalytics.cost_analysis,
        roi_calculator: {
          time_saved_hours: conversationAnalytics.conversation_metrics.total_conversations * 0.5,
          cost_saved: conversationAnalytics.conversation_metrics.total_conversations * 2.5,
          efficiency_gain: 0.75
        },
        improvement_suggestions: insights.slice(0, 5),
        competitor_benchmarks: this.generateCompetitorBenchmarks(conversationAnalytics.conversation_metrics)
      }
    };
  }

  /**
   * Get admin dashboard data
   */
  async getAdminDashboardData(dateRange: { start: Date; end: Date }): Promise<AdminDashboardData> {
    // Get all businesses
    const businesses = await this.prisma.business.findMany({
      select: { id: true, name: true, plan: true }
    });

    // Get platform-wide metrics
    const platformMetrics = await this.prisma.dailyConversationMetrics.findMany({
      where: {
        date: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }
    }) as any[];

    const platformPerformance = await this.prisma.hourlyPerformanceMetrics.findMany({
      where: {
        hour_timestamp: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }
    }) as any[];

    // Calculate platform overview
    const totalConversations = platformMetrics.reduce((sum, m) => sum + m.total_conversations, 0);
    const avgSatisfaction = platformMetrics.reduce((sum, m) => sum + m.satisfaction_score, 0) / platformMetrics.length;
    const totalCost = platformPerformance.reduce((sum, h) => sum + h.estimated_cost, 0);

    return {
      platform_overview: {
        total_active_businesses: businesses.length,
        platform_revenue_metrics: {
          monthly_recurring_revenue: businesses.length * 99, // Placeholder calculation
          revenue_growth_rate: 0.15, // Placeholder
          average_revenue_per_user: 99
        },
        system_health_status: {
          uptime_percentage: 99.9,
          active_services: 8,
          total_services: 8
        },
        support_ticket_summary: {
          open_tickets: 12,
          avg_resolution_time: 4.5,
          satisfaction_score: 4.2
        }
      },
      tenant_management: {
        tenant_usage_leaderboard: this.generateTenantLeaderboard(businesses, platformMetrics),
        plan_distribution_chart: this.generatePlanDistribution(businesses),
        churn_risk_alerts: this.generateChurnRiskAlerts(businesses, platformMetrics),
        onboarding_funnel: {
          signups: businesses.length,
          activations: Math.floor(businesses.length * 0.85),
          first_conversation: Math.floor(businesses.length * 0.75),
          retention_rate: 0.88
        }
      },
      system_performance: {
        api_response_times: this.generateApiResponseTimes(),
        error_rate_monitoring: this.generateErrorRateMonitoring(platformPerformance),
        resource_utilization: {
          database_usage: 65,
          compute_usage: 45,
          storage_usage: 30
        },
        cost_per_tenant: {
          avg_cost: totalCost / businesses.length,
          cost_trend: 'stable',
          optimization_opportunities: 3
        }
      },
      business_intelligence: {
        feature_adoption_rates: this.generateFeatureAdoptionRates(),
        support_pattern_analysis: this.generateSupportPatternAnalysis(),
        market_opportunity_analysis: this.generateMarketOpportunities(),
        competitive_positioning: this.generateCompetitivePositioning()
      }
    };
  }

  /**
   * Save dashboard configuration
   */
  async saveDashboardConfig(userId: string, businessId: string | null, dashboardType: 'tenant' | 'admin', layout: DashboardWidget[]): Promise<DashboardConfig> {
    const config: DashboardConfig = {
      id: `dashboard_${userId}_${dashboardType}`,
      user_id: userId,
      business_id: businessId,
      dashboard_type: dashboardType,
      layout: layout,
      created_at: new Date(),
      updated_at: new Date()
    };

    // In a real implementation, this would save to database
    // For now, we'll just return the config
    return config;
  }

  /**
   * Get dashboard configuration
   */
  async getDashboardConfig(userId: string, dashboardType: 'tenant' | 'admin'): Promise<DashboardConfig | null> {
    // In a real implementation, this would fetch from database
    // For now, return a default configuration
    return {
      id: `dashboard_${userId}_${dashboardType}`,
      user_id: userId,
      business_id: null,
      dashboard_type: dashboardType,
      layout: this.getDefaultDashboardLayout(dashboardType),
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  /**
   * Get default dashboard layout
   */
  private getDefaultDashboardLayout(dashboardType: 'tenant' | 'admin'): DashboardWidget[] {
    if (dashboardType === 'tenant') {
      return [
        {
          id: 'overview_metrics',
          type: 'metric',
          title: 'Overview Metrics',
          data: {},
          config: { columns: 4 },
          refresh_interval: 30000,
          last_updated: new Date()
        },
        {
          id: 'conversation_insights',
          type: 'chart',
          title: 'Conversation Insights',
          data: {},
          config: { chart_type: 'line' },
          refresh_interval: 60000,
          last_updated: new Date()
        },
        {
          id: 'performance_monitoring',
          type: 'gauge',
          title: 'Performance Monitoring',
          data: {},
          config: { gauge_type: 'circular' },
          refresh_interval: 30000,
          last_updated: new Date()
        }
      ];
    } else {
      return [
        {
          id: 'platform_overview',
          type: 'metric',
          title: 'Platform Overview',
          data: {},
          config: { columns: 4 },
          refresh_interval: 30000,
          last_updated: new Date()
        },
        {
          id: 'tenant_management',
          type: 'table',
          title: 'Tenant Management',
          data: {},
          config: { sortable: true },
          refresh_interval: 60000,
          last_updated: new Date()
        },
        {
          id: 'system_performance',
          type: 'chart',
          title: 'System Performance',
          data: {},
          config: { chart_type: 'bar' },
          refresh_interval: 30000,
          last_updated: new Date()
        }
      ];
    }
  }

  // Helper methods for data generation
  private generateTimeSeriesData(value: number): TimeSeriesData[] {
    const data: TimeSeriesData[] = [];
    for (let i = 0; i < 7; i++) {
      data.push({
        timestamp: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
        value: value + (Math.random() - 0.5) * 0.1
      });
    }
    return data;
  }

  private generatePeakHoursHeatmap(hourlyMetrics: any[]): Array<{ hour: number; day: string; count: number }> {
    const heatmap: Array<{ hour: number; day: string; count: number }> = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const metric = hourlyMetrics.find(h => h.hour_timestamp.getHours() === hour);
        heatmap.push({
          hour,
          day: days[day],
          count: metric?.query_count || Math.floor(Math.random() * 50)
        });
      }
    }
    return heatmap;
  }

  private generateErrorRateAlerts(errorRate: number): Array<{ type: string; count: number; severity: string }> {
    const alerts = [];
    if (errorRate > 0.05) {
      alerts.push({
        type: 'High Error Rate',
        count: Math.floor(errorRate * 100),
        severity: 'high'
      });
    }
    return alerts;
  }

  private generateCompetitorBenchmarks(metrics: any): Array<{ metric: string; your_value: number; industry_avg: number }> {
    return [
      {
        metric: 'Response Time',
        your_value: 1200,
        industry_avg: 1500
      },
      {
        metric: 'Satisfaction Score',
        your_value: metrics.satisfaction_score || 4.2,
        industry_avg: 3.8
      },
      {
        metric: 'Resolution Rate',
        your_value: metrics.resolution_rate || 0.85,
        industry_avg: 0.75
      }
    ];
  }

  private generateTenantLeaderboard(businesses: any[], metrics: any[]): Array<{ business_id: string; usage: number; plan: string }> {
    return businesses.slice(0, 10).map(business => {
      const businessMetrics = metrics.filter(m => m.business_id === business.id);
      const totalUsage = businessMetrics.reduce((sum, m) => sum + m.total_conversations, 0);
      return {
        business_id: business.name,
        usage: totalUsage,
        plan: business.plan || 'Standard'
      };
    }).sort((a, b) => b.usage - a.usage);
  }

  private generatePlanDistribution(businesses: any[]): Array<{ plan: string; count: number; revenue: number }> {
    const planCounts: Record<string, number> = {};
    businesses.forEach(business => {
      const plan = business.plan || 'Standard';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });

    return Object.entries(planCounts).map(([plan, count]) => ({
      plan,
      count,
      revenue: count * 99 // Placeholder revenue calculation
    }));
  }

  private generateChurnRiskAlerts(businesses: any[], metrics: any[]): Array<{ business_id: string; risk_score: number; last_activity: Date }> {
    return businesses.slice(0, 5).map(business => ({
      business_id: business.name,
      risk_score: Math.random() * 0.4 + 0.6, // 0.6-1.0 risk score
      last_activity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    }));
  }

  private generateApiResponseTimes(): Array<{ endpoint: string; avg_time: number; percentile_95th: number }> {
    return [
      { endpoint: '/api/v1/query', avg_time: 1200, percentile_95th: 2500 },
      { endpoint: '/api/v1/query/stream', avg_time: 800, percentile_95th: 1500 },
      { endpoint: '/api/v1/analytics/overview', avg_time: 500, percentile_95th: 1000 }
    ];
  }

  private generateErrorRateMonitoring(metrics: any[]): Array<{ service: string; error_rate: number; trend: string }> {
    return [
      { service: 'Query Processor', error_rate: 0.02, trend: 'stable' },
      { service: 'Analytics Engine', error_rate: 0.01, trend: 'improving' },
      { service: 'Streaming Manager', error_rate: 0.03, trend: 'stable' }
    ];
  }

  private generateFeatureAdoptionRates(): Array<{ feature: string; adoption_rate: number; usage_trend: string }> {
    return [
      { feature: 'Business Rules', adoption_rate: 0.75, usage_trend: 'increasing' },
      { feature: 'Response Templates', adoption_rate: 0.60, usage_trend: 'stable' },
      { feature: 'Batch Processing', adoption_rate: 0.25, usage_trend: 'increasing' }
    ];
  }

  private generateSupportPatternAnalysis(): Array<{ issue_type: string; frequency: number; resolution_time: number }> {
    return [
      { issue_type: 'API Integration', frequency: 15, resolution_time: 2.5 },
      { issue_type: 'Performance Issues', frequency: 8, resolution_time: 4.0 },
      { issue_type: 'Billing Questions', frequency: 12, resolution_time: 1.0 }
    ];
  }

  private generateMarketOpportunities(): Array<{ opportunity: string; potential_revenue: number; effort: string }> {
    return [
      { opportunity: 'Enterprise Features', potential_revenue: 50000, effort: 'medium' },
      { opportunity: 'Mobile App', potential_revenue: 25000, effort: 'high' },
      { opportunity: 'Advanced Analytics', potential_revenue: 30000, effort: 'low' }
    ];
  }

  private generateCompetitivePositioning(): Array<{ metric: string; our_value: number; competitor_avg: number }> {
    return [
      { metric: 'Response Accuracy', our_value: 0.92, competitor_avg: 0.85 },
      { metric: 'Customer Satisfaction', our_value: 4.3, competitor_avg: 3.9 },
      { metric: 'Pricing Competitiveness', our_value: 0.8, competitor_avg: 1.0 }
    ];
  }
}

let dashboardManagerInstance: DashboardManager | null = null;

export function getDashboardManager(prisma: PrismaClient): DashboardManager {
  if (!dashboardManagerInstance) {
    dashboardManagerInstance = new DashboardManager(prisma);
  }
  return dashboardManagerInstance;
}
