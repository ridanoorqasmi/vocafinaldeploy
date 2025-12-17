// lib/monitoring-alerting-system.ts
import { PrismaClient } from '@prisma/client';
import {
  SystemHealthMetrics,
  UsageQuotas,
  AlertDefinition,
  AlertHistory
} from './analytics-types';

export interface AlertCondition {
  metric_name: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'contains' | 'not_contains';
  threshold: number | string;
  time_window_minutes: number;
  evaluation_frequency_seconds: number;
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'in_app';
  config: {
    email?: string[];
    phone?: string[];
    slack_webhook?: string;
    webhook_url?: string;
    in_app_users?: string[];
  };
  enabled: boolean;
}

export interface EscalationRule {
  escalation_type: 'time_based' | 'frequency_based' | 'severity_based';
  condition: {
    time_minutes?: number;
    frequency_count?: number;
    severity_level?: 'low' | 'medium' | 'high' | 'critical';
  };
  action: {
    notify_additional_channels: string[];
    escalate_to: string[];
    auto_resolve: boolean;
  };
}

export interface SystemHealthStatus {
  overall_status: 'healthy' | 'warning' | 'critical';
  services: Array<{
    service_name: string;
    status: 'healthy' | 'warning' | 'critical' | 'down';
    last_check: Date;
    response_time_ms: number;
    error_rate: number;
    uptime_percentage: number;
  }>;
  metrics: Array<{
    metric_name: string;
    current_value: number;
    threshold: number;
    status: 'ok' | 'warning' | 'critical';
    trend: 'improving' | 'stable' | 'declining';
  }>;
  alerts: Array<{
    alert_id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    triggered_at: Date;
    acknowledged: boolean;
  }>;
}

export class MonitoringAlertingSystem {
  private prisma: PrismaClient;
  private activeAlerts: Map<string, AlertDefinition> = new Map();
  private alertHistory: Map<string, AlertHistory[]> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring system
   */
  private async initializeMonitoring(): Promise<void> {
    // Load active alert definitions
    await this.loadActiveAlerts();
    
    // Start monitoring intervals
    this.startHealthMonitoring();
    this.startAlertEvaluation();
  }

  /**
   * Load active alert definitions from database
   */
  private async loadActiveAlerts(): Promise<void> {
    try {
      const alerts = await this.prisma.alertDefinition.findMany({
        where: { active_status: true }
      }) as AlertDefinition[];

      this.activeAlerts.clear();
      alerts.forEach(alert => {
        this.activeAlerts.set(alert.id, alert);
      });

      console.log(`Loaded ${alerts.length} active alert definitions`);
    } catch (error) {
      console.error('Error loading active alerts:', error);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Start alert evaluation
   */
  private startAlertEvaluation(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.evaluateAlerts();
    }, 30000); // Evaluate every 30 seconds
  }

  /**
   * Perform system health checks
   */
  private async performHealthChecks(): Promise<void> {
    const healthMetrics: SystemHealthMetrics[] = [];

    // Check database connectivity
    const dbStartTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const dbResponseTime = Date.now() - dbStartTime;
      
      healthMetrics.push({
        id: `db_connectivity_${Date.now()}`,
        metric_name: 'database_connectivity',
        metric_value: dbResponseTime,
        timestamp: new Date(),
        severity_level: dbResponseTime > 1000 ? 'high' : dbResponseTime > 500 ? 'medium' : 'low',
        service_component: 'database',
        alert_threshold: 1000,
        current_status: dbResponseTime > 1000 ? 'critical' : dbResponseTime > 500 ? 'warning' : 'healthy',
        created_at: new Date(),
        updated_at: new Date()
      });
    } catch (error) {
      healthMetrics.push({
        id: `db_connectivity_${Date.now()}`,
        metric_name: 'database_connectivity',
        metric_value: -1,
        timestamp: new Date(),
        severity_level: 'critical',
        service_component: 'database',
        alert_threshold: 1000,
        current_status: 'critical',
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Check API response times (simulated)
    const apiResponseTime = Math.random() * 2000; // Simulated response time
    healthMetrics.push({
      id: `api_response_${Date.now()}`,
      metric_name: 'api_response_time',
      metric_value: apiResponseTime,
      timestamp: new Date(),
      severity_level: apiResponseTime > 1500 ? 'high' : apiResponseTime > 1000 ? 'medium' : 'low',
      service_component: 'api',
      alert_threshold: 1500,
      current_status: apiResponseTime > 1500 ? 'critical' : apiResponseTime > 1000 ? 'warning' : 'healthy',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Check memory usage (simulated)
    const memoryUsage = Math.random() * 100; // Simulated memory usage percentage
    healthMetrics.push({
      id: `memory_usage_${Date.now()}`,
      metric_name: 'memory_usage_percentage',
      metric_value: memoryUsage,
      timestamp: new Date(),
      severity_level: memoryUsage > 90 ? 'high' : memoryUsage > 80 ? 'medium' : 'low',
      service_component: 'system',
      alert_threshold: 90,
      current_status: memoryUsage > 90 ? 'critical' : memoryUsage > 80 ? 'warning' : 'healthy',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Save health metrics
    for (const metric of healthMetrics) {
      try {
        await this.prisma.systemHealthMetrics.create({ data: metric });
      } catch (error) {
        console.error('Error saving health metric:', error);
      }
    }
  }

  /**
   * Evaluate all active alerts
   */
  private async evaluateAlerts(): Promise<void> {
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      try {
        await this.evaluateAlert(alert);
      } catch (error) {
        console.error(`Error evaluating alert ${alertId}:`, error);
      }
    }
  }

  /**
   * Evaluate a specific alert
   */
  private async evaluateAlert(alert: AlertDefinition): Promise<void> {
    // Get recent metrics for the alert condition
    const recentMetrics = await this.prisma.systemHealthMetrics.findMany({
      where: {
        metric_name: alert.metric_type,
        timestamp: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    }) as SystemHealthMetrics[];

    if (recentMetrics.length === 0) {
      return; // No recent data
    }

    // Check if alert condition is met
    const conditionMet = this.checkAlertCondition(alert, recentMetrics);
    
    if (conditionMet) {
      await this.triggerAlert(alert, recentMetrics[0]);
    } else {
      // Check if we need to resolve an existing alert
      await this.checkAlertResolution(alert.id);
    }
  }

  /**
   * Check if alert condition is met
   */
  private checkAlertCondition(alert: AlertDefinition, metrics: SystemHealthMetrics[]): boolean {
    const latestMetric = metrics[0];
    const threshold = alert.threshold;

    switch (alert.condition) {
      case 'greater_than':
        return latestMetric.metric_value > threshold;
      case 'less_than':
        return latestMetric.metric_value < threshold;
      case 'equals':
        return latestMetric.metric_value === threshold;
      case 'not_equals':
        return latestMetric.metric_value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(alert: AlertDefinition, metric: SystemHealthMetrics): Promise<void> {
    // Check if alert is already active
    const existingAlert = await this.prisma.alertHistory.findFirst({
      where: {
        alert_id: alert.id,
        resolved_at: null
      }
    });

    if (existingAlert) {
      return; // Alert already active
    }

    // Create alert history record
    const alertHistory: AlertHistory = {
      id: `alert_${alert.id}_${Date.now()}`,
      alert_id: alert.id,
      triggered_at: new Date(),
      severity: this.determineSeverity(metric),
      message: this.generateAlertMessage(alert, metric),
      notification_sent: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    try {
      await this.prisma.alertHistory.create({ data: alertHistory });
      
      // Send notifications
      await this.sendNotifications(alert, alertHistory);
      
      console.log(`Alert triggered: ${alert.id} - ${alertHistory.message}`);
    } catch (error) {
      console.error('Error creating alert history:', error);
    }
  }

  /**
   * Check if alert should be resolved
   */
  private async checkAlertResolution(alertId: string): Promise<void> {
    const activeAlert = await this.prisma.alertHistory.findFirst({
      where: {
        alert_id: alertId,
        resolved_at: null
      }
    });

    if (activeAlert) {
      // Check if condition is no longer met for a sustained period
      const recentMetrics = await this.prisma.systemHealthMetrics.findMany({
        where: {
          metric_name: activeAlert.alert_id, // This should be the metric type
          timestamp: {
            gte: new Date(Date.now() - 2 * 60 * 1000) // Last 2 minutes
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 5
      });

      if (recentMetrics.length >= 3) {
        // Check if all recent metrics are within normal range
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
          const allNormal = recentMetrics.every(metric => 
            !this.checkAlertCondition(alert, [metric])
          );

          if (allNormal) {
            await this.resolveAlert(activeAlert.id);
          }
        }
      }
    }
  }

  /**
   * Resolve an alert
   */
  private async resolveAlert(alertHistoryId: string): Promise<void> {
    try {
      await this.prisma.alertHistory.update({
        where: { id: alertHistoryId },
        data: {
          resolved_at: new Date(),
          resolution_action: 'Automatic resolution - condition no longer met',
          updated_at: new Date()
        }
      });

      console.log(`Alert resolved: ${alertHistoryId}`);
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: AlertDefinition, alertHistory: AlertHistory): Promise<void> {
    // In a real implementation, this would send actual notifications
    // For now, we'll just log the notification
    
    console.log(`Sending notifications for alert ${alert.id}:`);
    console.log(`- Channels: ${alert.notification_channels.join(', ')}`);
    console.log(`- Message: ${alertHistory.message}`);
    console.log(`- Severity: ${alertHistory.severity}`);

    // Update notification status
    try {
      await this.prisma.alertHistory.update({
        where: { id: alertHistory.id },
        data: {
          notification_sent: true,
          updated_at: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }

  /**
   * Determine alert severity based on metric
   */
  private determineSeverity(metric: SystemHealthMetrics): 'low' | 'medium' | 'high' | 'critical' {
    return metric.severity_level;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(alert: AlertDefinition, metric: SystemHealthMetrics): string {
    return `${alert.metric_type} alert: ${metric.metric_name} is ${metric.metric_value} (threshold: ${alert.threshold})`;
  }

  /**
   * Get current system health status
   */
  async getSystemHealthStatus(): Promise<SystemHealthStatus> {
    // Get recent health metrics
    const recentMetrics = await this.prisma.systemHealthMetrics.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      orderBy: { timestamp: 'desc' }
    }) as SystemHealthMetrics[];

    // Get active alerts
    const activeAlerts = await this.prisma.alertHistory.findMany({
      where: { resolved_at: null },
      orderBy: { triggered_at: 'desc' }
    }) as AlertHistory[];

    // Determine overall status
    const criticalMetrics = recentMetrics.filter(m => m.current_status === 'critical');
    const warningMetrics = recentMetrics.filter(m => m.current_status === 'warning');
    
    let overallStatus: 'healthy' | 'warning' | 'critical';
    if (criticalMetrics.length > 0) {
      overallStatus = 'critical';
    } else if (warningMetrics.length > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'healthy';
    }

    // Group metrics by service
    const serviceGroups = recentMetrics.reduce((groups, metric) => {
      const service = metric.service_component;
      if (!groups[service]) {
        groups[service] = [];
      }
      groups[service].push(metric);
      return groups;
    }, {} as Record<string, SystemHealthMetrics[]>);

    const services = Object.entries(serviceGroups).map(([serviceName, metrics]) => {
      const latestMetric = metrics[0];
      const avgResponseTime = metrics.reduce((sum, m) => sum + m.metric_value, 0) / metrics.length;
      const errorRate = metrics.filter(m => m.current_status === 'critical').length / metrics.length;
      
      let status: 'healthy' | 'warning' | 'critical' | 'down';
      if (errorRate > 0.5) {
        status = 'down';
      } else if (errorRate > 0.2) {
        status = 'critical';
      } else if (errorRate > 0) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      return {
        service_name: serviceName,
        status,
        last_check: latestMetric.timestamp,
        response_time_ms: avgResponseTime,
        error_rate: errorRate,
        uptime_percentage: (1 - errorRate) * 100
      };
    });

    return {
      overall_status: overallStatus,
      services,
      metrics: recentMetrics.map(metric => ({
        metric_name: metric.metric_name,
        current_value: metric.metric_value,
        threshold: metric.alert_threshold,
        status: metric.current_status === 'healthy' ? 'ok' : 
                metric.current_status === 'warning' ? 'warning' : 'critical',
        trend: 'stable' // Would need historical comparison
      })),
      alerts: activeAlerts.map(alert => ({
        alert_id: alert.alert_id,
        severity: alert.severity,
        message: alert.message,
        triggered_at: alert.triggered_at,
        acknowledged: false // Would need acknowledgment tracking
      }))
    };
  }

  /**
   * Create a new alert definition
   */
  async createAlertDefinition(alertData: Omit<AlertDefinition, 'id' | 'created_at' | 'updated_at'>): Promise<AlertDefinition> {
    const newAlert: AlertDefinition = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ...alertData,
      created_at: new Date(),
      updated_at: new Date()
    };

    try {
      await this.prisma.alertDefinition.create({ data: newAlert });
      this.activeAlerts.set(newAlert.id, newAlert);
      
      console.log(`Created alert definition: ${newAlert.id}`);
      return newAlert;
    } catch (error) {
      console.error('Error creating alert definition:', error);
      throw error;
    }
  }

  /**
   * Update usage quotas and check for quota alerts
   */
  async updateUsageQuotas(businessId: string, quotaType: string, usage: number): Promise<void> {
    try {
      const quota = await this.prisma.usageQuotas.findFirst({
        where: { business_id: businessId, quota_type: quotaType }
      }) as UsageQuotas | null;

      if (quota) {
        const updatedQuota = await this.prisma.usageQuotas.update({
          where: { id: quota.id },
          data: {
            current_usage: usage,
            updated_at: new Date()
          }
        }) as UsageQuotas;

        // Check for quota alerts
        await this.checkQuotaAlerts(updatedQuota);
      }
    } catch (error) {
      console.error('Error updating usage quotas:', error);
    }
  }

  /**
   * Check for quota-related alerts
   */
  private async checkQuotaAlerts(quota: UsageQuotas): Promise<void> {
    const usagePercentage = quota.current_usage / quota.quota_limit;
    
    if (usagePercentage >= quota.alert_thresholds.critical / 100) {
      // Trigger critical quota alert
      await this.triggerQuotaAlert(quota, 'critical', usagePercentage);
    } else if (usagePercentage >= quota.alert_thresholds.warning / 100) {
      // Trigger warning quota alert
      await this.triggerQuotaAlert(quota, 'warning', usagePercentage);
    }
  }

  /**
   * Trigger quota alert
   */
  private async triggerQuotaAlert(quota: UsageQuotas, severity: 'warning' | 'critical', usagePercentage: number): Promise<void> {
    const alertMessage = `${quota.quota_type} quota ${severity} alert: ${(usagePercentage * 100).toFixed(1)}% used (${quota.current_usage}/${quota.quota_limit})`;
    
    console.log(`Quota alert for business ${quota.business_id}: ${alertMessage}`);
    
    // In a real implementation, this would create an alert history record
    // and send notifications to the business
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

let monitoringAlertingSystemInstance: MonitoringAlertingSystem | null = null;

export function getMonitoringAlertingSystem(prisma: PrismaClient): MonitoringAlertingSystem {
  if (!monitoringAlertingSystemInstance) {
    monitoringAlertingSystemInstance = new MonitoringAlertingSystem(prisma);
  }
  return monitoringAlertingSystemInstance;
}
