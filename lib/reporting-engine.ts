// lib/reporting-engine.ts
import { PrismaClient } from '@prisma/client';
import {
  ReportConfig,
  GeneratedReport,
  TimeSeriesData,
  BusinessIntelligenceInsight
} from './analytics-types';
import { getAnalyticsProcessor } from './analytics-processor';
import { getBusinessIntelligenceEngine } from './business-intelligence-engine';
import { getDashboardManager } from './dashboard-manager';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'conversation_analysis' | 'performance_metrics' | 'cost_analysis' | 'business_intelligence' | 'custom';
  config: Partial<ReportConfig>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReportSection {
  section_id: string;
  title: string;
  content_type: 'text' | 'chart' | 'table' | 'metric' | 'insight';
  data: any;
  config: Record<string, any>;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'excel';
  include_charts: boolean;
  include_raw_data: boolean;
  compression: boolean;
  password_protected: boolean;
  custom_styling?: {
    logo_url?: string;
    color_scheme?: string;
    font_family?: string;
  };
}

export interface ScheduledReport {
  id: string;
  business_id: string;
  report_config: ReportConfig;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    day_of_week?: number; // 0-6 for weekly
    day_of_month?: number; // 1-31 for monthly
    time: string; // HH:MM format
    timezone: string;
  };
  delivery: {
    email_recipients: string[];
    webhook_url?: string;
    storage_location?: string;
  };
  active: boolean;
  last_generated?: Date;
  next_generation?: Date;
  created_at: Date;
  updated_at: Date;
}

export class ReportingEngine {
  private prisma: PrismaClient;
  private analyticsProcessor: any;
  private businessIntelligenceEngine: any;
  private dashboardManager: any;
  private reportQueue: Map<string, GeneratedReport> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.analyticsProcessor = getAnalyticsProcessor(prisma);
    this.businessIntelligenceEngine = getBusinessIntelligenceEngine(prisma);
    this.dashboardManager = getDashboardManager(prisma);
  }

  /**
   * Generate a custom report
   */
  async generateReport(businessId: string, reportConfig: ReportConfig): Promise<GeneratedReport> {
    const reportId = `report_${businessId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const report: GeneratedReport = {
      id: reportId,
      business_id: businessId,
      report_config: reportConfig,
      status: 'generating',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      created_at: new Date()
    };

    // Add to queue
    this.reportQueue.set(reportId, report);

    try {
      // Generate report content based on type
      const reportContent = await this.generateReportContent(businessId, reportConfig);
      
      // Process export format
      const exportResult = await this.processExport(reportContent, reportConfig.export_format);
      
      // Update report status
      report.status = 'completed';
      report.download_url = exportResult.download_url;
      report.file_size_mb = exportResult.file_size_mb;
      report.completed_at = new Date();

      console.log(`Report generated successfully: ${reportId}`);
      return report;
    } catch (error) {
      console.error(`Error generating report ${reportId}:`, error);
      report.status = 'failed';
      report.completed_at = new Date();
      throw error;
    }
  }

  /**
   * Generate report content based on configuration
   */
  private async generateReportContent(businessId: string, config: ReportConfig): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];

    // Add executive summary
    sections.push({
      section_id: 'executive_summary',
      title: 'Executive Summary',
      content_type: 'text',
      data: await this.generateExecutiveSummary(businessId, config),
      config: {}
    });

    // Add sections based on report type
    switch (config.report_type) {
      case 'conversation_summary':
        sections.push(...await this.generateConversationSections(businessId, config));
        break;
      case 'performance_analysis':
        sections.push(...await this.generatePerformanceSections(businessId, config));
        break;
      case 'cost_optimization':
        sections.push(...await this.generateCostSections(businessId, config));
        break;
      case 'custom':
        sections.push(...await this.generateCustomSections(businessId, config));
        break;
    }

    // Add business intelligence insights
    sections.push({
      section_id: 'business_intelligence',
      title: 'Business Intelligence Insights',
      content_type: 'insight',
      data: await this.businessIntelligenceEngine.generateComprehensiveInsights(businessId, config.date_range),
      config: {}
    });

    // Add recommendations
    sections.push({
      section_id: 'recommendations',
      title: 'Recommendations',
      content_type: 'text',
      data: await this.generateRecommendations(businessId, config),
      config: {}
    });

    return sections;
  }

  /**
   * Generate executive summary
   */
  private async generateExecutiveSummary(businessId: string, config: ReportConfig): Promise<string> {
    const analytics = await this.analyticsProcessor.getConversationAnalytics({
      business_id: businessId,
      date_range: config.date_range,
      metrics: ['conversations', 'satisfaction', 'resolution_rate'],
      granularity: 'day'
    });

    const performance = await this.analyticsProcessor.getPerformanceAnalytics({
      business_id: businessId,
      date_range: config.date_range,
      metrics: ['response_time', 'cost', 'error_rate'],
      granularity: 'hour'
    });

    return `
# Executive Summary

## Key Metrics (${config.date_range.start_date.toDateString()} - ${config.date_range.end_date.toDateString()})

- **Total Conversations**: ${analytics.conversation_metrics.total_conversations}
- **Customer Satisfaction**: ${analytics.conversation_metrics.avg_conversation_length.toFixed(2)}/5.0
- **Resolution Rate**: ${(analytics.conversation_metrics.resolution_rate * 100).toFixed(1)}%
- **Average Response Time**: ${performance.response_performance.avg_response_time_ms.toFixed(0)}ms
- **Total Cost**: $${performance.cost_analysis.reduce((sum, cost) => sum + cost.cost, 0).toFixed(2)}

## Key Insights

${analytics.conversation_metrics.total_conversations > 0 ? 
  `Your AI chatbot handled ${analytics.conversation_metrics.total_conversations} conversations during this period, with a ${(analytics.conversation_metrics.resolution_rate * 100).toFixed(1)}% resolution rate.` : 
  'No conversations recorded during this period.'}

The system maintained an average response time of ${performance.response_performance.avg_response_time_ms.toFixed(0)}ms, which is ${performance.response_performance.avg_response_time_ms < 1000 ? 'excellent' : 'acceptable'} performance.

## Recommendations

Based on the analysis, we recommend focusing on improving response quality and optimizing cost efficiency through better caching strategies.
    `.trim();
  }

  /**
   * Generate conversation analysis sections
   */
  private async generateConversationSections(businessId: string, config: ReportConfig): Promise<ReportSection[]> {
    const analytics = await this.analyticsProcessor.getConversationAnalytics({
      business_id: businessId,
      date_range: config.date_range,
      metrics: ['conversations', 'satisfaction', 'resolution_rate'],
      granularity: 'day'
    });

    return [
      {
        section_id: 'conversation_volume',
        title: 'Conversation Volume Analysis',
        content_type: 'chart',
        data: {
          chart_type: 'line',
          data: this.generateTimeSeriesData(analytics.conversation_metrics.total_conversations),
          x_axis: 'Date',
          y_axis: 'Conversations'
        },
        config: { chart_height: 400 }
      },
      {
        section_id: 'topic_analysis',
        title: 'Topic Analysis',
        content_type: 'table',
        data: {
          headers: ['Topic', 'Frequency', 'Satisfaction Score', 'Resolution Rate'],
          rows: analytics.topic_analysis.map(topic => [
            topic.topic,
            topic.conversation_count,
            topic.satisfaction_score.toFixed(2),
            `${(topic.resolution_success_rate * 100).toFixed(1)}%`
          ])
        },
        config: { sortable: true }
      },
      {
        section_id: 'satisfaction_trends',
        title: 'Customer Satisfaction Trends',
        content_type: 'chart',
        data: {
          chart_type: 'bar',
          data: analytics.satisfaction_analysis.satisfaction_by_topic,
          x_axis: 'Topic',
          y_axis: 'Satisfaction Score'
        },
        config: { chart_height: 300 }
      }
    ];
  }

  /**
   * Generate performance analysis sections
   */
  private async generatePerformanceSections(businessId: string, config: ReportConfig): Promise<ReportSection[]> {
    const performance = await this.analyticsProcessor.getPerformanceAnalytics({
      business_id: businessId,
      date_range: config.date_range,
      metrics: ['response_time', 'cost', 'error_rate'],
      granularity: 'hour'
    });

    return [
      {
        section_id: 'response_time_analysis',
        title: 'Response Time Analysis',
        content_type: 'metric',
        data: {
          metrics: [
            { label: 'Average Response Time', value: `${performance.response_performance.avg_response_time_ms.toFixed(0)}ms` },
            { label: '95th Percentile', value: `${performance.response_performance['95th_percentile_response_time'].toFixed(0)}ms` },
            { label: 'Cache Hit Rate', value: `${(performance.response_performance.cache_hit_rate * 100).toFixed(1)}%` },
            { label: 'Error Rate', value: `${(performance.response_performance.error_rate * 100).toFixed(2)}%` }
          ]
        },
        config: { layout: 'grid' }
      },
      {
        section_id: 'cost_breakdown',
        title: 'Cost Breakdown',
        content_type: 'chart',
        data: {
          chart_type: 'pie',
          data: performance.cost_analysis,
          label_field: 'feature',
          value_field: 'cost'
        },
        config: { chart_height: 300 }
      },
      {
        section_id: 'usage_patterns',
        title: 'Usage Patterns',
        content_type: 'chart',
        data: {
          chart_type: 'heatmap',
          data: performance.usage_patterns.peak_hours,
          x_axis: 'Hour',
          y_axis: 'Day'
        },
        config: { chart_height: 400 }
      }
    ];
  }

  /**
   * Generate cost optimization sections
   */
  private async generateCostSections(businessId: string, config: ReportConfig): Promise<ReportSection[]> {
    const performance = await this.analyticsProcessor.getPerformanceAnalytics({
      business_id: businessId,
      date_range: config.date_range,
      metrics: ['cost', 'token_usage'],
      granularity: 'day'
    });

    const insights = await this.businessIntelligenceEngine.generateOptimizationRecommendations(businessId);

    return [
      {
        section_id: 'cost_summary',
        title: 'Cost Summary',
        content_type: 'metric',
        data: {
          metrics: [
            { label: 'Total Cost', value: `$${performance.cost_analysis.reduce((sum, cost) => sum + cost.cost, 0).toFixed(2)}` },
            { label: 'Cost per Conversation', value: `$${(performance.cost_analysis.reduce((sum, cost) => sum + cost.cost, 0) / 100).toFixed(3)}` },
            { label: 'Token Usage', value: `${performance.cost_analysis.reduce((sum, cost) => sum + cost.token_usage, 0).toLocaleString()}` },
            { label: 'Monthly Projection', value: `$${(performance.cost_analysis.reduce((sum, cost) => sum + cost.cost, 0) * 30).toFixed(2)}` }
          ]
        },
        config: { layout: 'grid' }
      },
      {
        section_id: 'optimization_recommendations',
        title: 'Cost Optimization Recommendations',
        content_type: 'table',
        data: {
          headers: ['Recommendation', 'Potential Savings', 'Implementation Effort', 'Confidence'],
          rows: insights.map(rec => [
            rec.title,
            rec.estimated_savings ? `$${rec.estimated_savings.toFixed(2)}` : 'N/A',
            rec.implementation_effort,
            `${(rec.confidence_score * 100).toFixed(0)}%`
          ])
        },
        config: { sortable: true }
      }
    ];
  }

  /**
   * Generate custom sections based on configuration
   */
  private async generateCustomSections(businessId: string, config: ReportConfig): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];

    // Generate sections based on included metrics
    for (const metric of config.metrics_included) {
      switch (metric) {
        case 'conversations':
          sections.push(...await this.generateConversationSections(businessId, config));
          break;
        case 'performance':
          sections.push(...await this.generatePerformanceSections(businessId, config));
          break;
        case 'cost':
          sections.push(...await this.generateCostSections(businessId, config));
          break;
      }
    }

    return sections;
  }

  /**
   * Generate recommendations section
   */
  private async generateRecommendations(businessId: string, config: ReportConfig): Promise<string> {
    const insights = await this.businessIntelligenceEngine.generateComprehensiveInsights(businessId, config.date_range);
    const optimizations = await this.businessIntelligenceEngine.generateOptimizationRecommendations(businessId);

    let recommendations = '# Recommendations\n\n';

    if (insights.length > 0) {
      recommendations += '## Priority Actions\n\n';
      insights.slice(0, 3).forEach((insight, index) => {
        recommendations += `${index + 1}. **${insight.title}**\n`;
        recommendations += `   - ${insight.description}\n`;
        if (insight.recommended_action) {
          recommendations += `   - Action: ${insight.recommended_action}\n`;
        }
        recommendations += `   - Impact Score: ${insight.impact_score}/10\n\n`;
      });
    }

    if (optimizations.length > 0) {
      recommendations += '## Optimization Opportunities\n\n';
      optimizations.slice(0, 3).forEach((opt, index) => {
        recommendations += `${index + 1}. **${opt.title}**\n`;
        recommendations += `   - ${opt.description}\n`;
        if (opt.estimated_savings) {
          recommendations += `   - Potential Savings: $${opt.estimated_savings.toFixed(2)}\n`;
        }
        recommendations += `   - Implementation Effort: ${opt.implementation_effort}\n\n`;
      });
    }

    return recommendations;
  }

  /**
   * Process export format
   */
  private async processExport(content: ReportSection[], format: string): Promise<{ download_url: string; file_size_mb: number }> {
    // In a real implementation, this would generate actual files
    // For now, we'll simulate the export process
    
    const fileName = `report_${Date.now()}.${format}`;
    const downloadUrl = `/api/v1/reports/download/${fileName}`;
    
    // Simulate file size based on content
    const estimatedSize = content.length * 0.1; // 0.1 MB per section
    
    return {
      download_url: downloadUrl,
      file_size_mb: estimatedSize
    };
  }

  /**
   * Create a scheduled report
   */
  async createScheduledReport(scheduledReportData: Omit<ScheduledReport, 'id' | 'created_at' | 'updated_at'>): Promise<ScheduledReport> {
    const scheduledReport: ScheduledReport = {
      id: `scheduled_${scheduledReportData.business_id}_${Date.now()}`,
      ...scheduledReportData,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Calculate next generation time
    scheduledReport.next_generation = this.calculateNextGenerationTime(scheduledReport.schedule);

    // In a real implementation, this would save to database and set up cron job
    console.log(`Created scheduled report: ${scheduledReport.id}`);
    console.log(`Next generation: ${scheduledReport.next_generation}`);

    return scheduledReport;
  }

  /**
   * Calculate next generation time for scheduled report
   */
  private calculateNextGenerationTime(schedule: ScheduledReport['schedule']): Date {
    const now = new Date();
    const nextGen = new Date(now);

    switch (schedule.frequency) {
      case 'daily':
        nextGen.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        const daysUntilNextWeek = (schedule.day_of_week || 0) - now.getDay();
        nextGen.setDate(now.getDate() + (daysUntilNextWeek <= 0 ? daysUntilNextWeek + 7 : daysUntilNextWeek));
        break;
      case 'monthly':
        nextGen.setMonth(now.getMonth() + 1);
        nextGen.setDate(schedule.day_of_month || 1);
        break;
      case 'quarterly':
        nextGen.setMonth(now.getMonth() + 3);
        nextGen.setDate(1);
        break;
    }

    // Set time
    const [hours, minutes] = schedule.time.split(':').map(Number);
    nextGen.setHours(hours, minutes, 0, 0);

    return nextGen;
  }

  /**
   * Get report templates
   */
  async getReportTemplates(category?: string): Promise<ReportTemplate[]> {
    // In a real implementation, this would fetch from database
    const templates: ReportTemplate[] = [
      {
        id: 'conversation_summary_template',
        name: 'Conversation Summary Report',
        description: 'Comprehensive analysis of conversation volume, topics, and satisfaction',
        category: 'conversation_analysis',
        config: {
          report_type: 'conversation_summary',
          metrics_included: ['conversations', 'satisfaction', 'topics'],
          export_format: 'pdf'
        },
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'performance_analysis_template',
        name: 'Performance Analysis Report',
        description: 'Detailed performance metrics and system health analysis',
        category: 'performance_metrics',
        config: {
          report_type: 'performance_analysis',
          metrics_included: ['response_time', 'error_rate', 'cache_hit_rate'],
          export_format: 'excel'
        },
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'cost_optimization_template',
        name: 'Cost Optimization Report',
        description: 'Cost analysis and optimization recommendations',
        category: 'cost_analysis',
        config: {
          report_type: 'cost_optimization',
          metrics_included: ['cost', 'token_usage', 'efficiency'],
          export_format: 'pdf'
        },
        created_by: 'system',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    return category ? templates.filter(t => t.category === category) : templates;
  }

  /**
   * Helper method to generate time series data
   */
  private generateTimeSeriesData(baseValue: number): TimeSeriesData[] {
    const data: TimeSeriesData[] = [];
    for (let i = 0; i < 7; i++) {
      data.push({
        timestamp: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
        value: baseValue + (Math.random() - 0.5) * baseValue * 0.2
      });
    }
    return data;
  }
}

let reportingEngineInstance: ReportingEngine | null = null;

export function getReportingEngine(prisma: PrismaClient): ReportingEngine {
  if (!reportingEngineInstance) {
    reportingEngineInstance = new ReportingEngine(prisma);
  }
  return reportingEngineInstance;
}
