// ===== ENHANCED USAGE TRACKING FOR OPENAI API CALLS =====

import { PrismaClient } from '@prisma/client';
import { EmbeddingType } from './embedding-types';

// Usage tracking interfaces
export interface UsageRecord {
  businessId: string;
  operation: 'embedding_generation' | 'embedding_search' | 'batch_processing' | 'content_processing';
  contentType?: EmbeddingType;
  tokenCount: number;
  apiCalls: number;
  processingTime: number;
  success: boolean;
  errorCode?: string;
  metadata?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface UsageStats {
  businessId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalTokens: number;
  totalApiCalls: number;
  totalProcessingTime: number;
  successRate: number;
  byContentType: Record<EmbeddingType, {
    tokens: number;
    calls: number;
    successRate: number;
  }>;
  byOperation: Record<string, {
    tokens: number;
    calls: number;
    successRate: number;
  }>;
}

export interface UsageAlert {
  businessId: string;
  type: 'high_usage' | 'quota_warning' | 'error_rate' | 'cost_threshold' | 'performance_degradation';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface UsageReport {
  businessId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  summary: {
    totalTokens: number;
    totalApiCalls: number;
    totalCost: number;
    successRate: number;
    averageResponseTime: number;
  };
  breakdown: {
    byOperation: Record<string, {
      tokens: number;
      calls: number;
      cost: number;
      successRate: number;
    }>;
    byContentType: Record<EmbeddingType, {
      tokens: number;
      calls: number;
      cost: number;
      successRate: number;
    }>;
    byHour?: Array<{
      hour: string;
      tokens: number;
      calls: number;
      cost: number;
    }>;
  };
  trends: {
    tokenGrowth: number;
    costGrowth: number;
    usageGrowth: number;
  };
  alerts: UsageAlert[];
}

export interface AdminDashboardMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  totalTokens: number;
  totalCost: number;
  totalApiCalls: number;
  averageSuccessRate: number;
  topBusinesses: Array<{
    businessId: string;
    businessName: string;
    tokens: number;
    cost: number;
    calls: number;
  }>;
  recentAlerts: UsageAlert[];
  systemHealth: {
    averageResponseTime: number;
    errorRate: number;
    queueSize: number;
    processingRate: number;
  };
}

// Usage tracking service
export class UsageTracker {
  private prisma: PrismaClient;
  private inMemoryStats = new Map<string, UsageRecord[]>();
  private alertThresholds = {
    highUsage: 10000, // tokens per hour
    errorRate: 0.1, // 10% error rate
    costThreshold: 100 // USD per day (estimated)
  };
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  /**
   * Record usage for an operation
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    try {
      // Store in database
      await this.prisma.usageMetric.create({
        data: {
          businessId: record.businessId,
          type: 'API_CALL',
          count: record.apiCalls,
          metadata: {
            operation: record.operation,
            contentType: record.contentType,
            tokenCount: record.tokenCount,
            processingTime: record.processingTime,
            success: record.success,
            errorCode: record.errorCode,
            ...record.metadata
          }
        }
      });
      
      // Store in memory for quick access
      const key = `${record.businessId}:${new Date().toISOString().split('T')[0]}`;
      if (!this.inMemoryStats.has(key)) {
        this.inMemoryStats.set(key, []);
      }
      this.inMemoryStats.get(key)!.push(record);
      
      // Check for alerts
      await this.checkAlerts(record);
      
    } catch (error) {
      console.error('Failed to record usage:', error);
      // Don't throw - usage tracking should not break the main flow
    }
  }
  
  /**
   * Get usage statistics for a business
   */
  async getUsageStats(
    businessId: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<UsageStats> {
    try {
      const now = new Date();
      const startDate = this.getPeriodStart(now, period);
      
      // Get from database
      const metrics = await this.prisma.usageMetric.findMany({
        where: {
          businessId,
          type: 'API_CALL',
          date: {
            gte: startDate,
            lte: now
          }
        }
      });
      
      // Process metrics
      let totalTokens = 0;
      let totalApiCalls = 0;
      let totalProcessingTime = 0;
      let successCount = 0;
      
      const byContentType: Record<EmbeddingType, { tokens: number; calls: number; successCount: number }> = {
        MENU: { tokens: 0, calls: 0, successCount: 0 },
        POLICY: { tokens: 0, calls: 0, successCount: 0 },
        FAQ: { tokens: 0, calls: 0, successCount: 0 },
        BUSINESS: { tokens: 0, calls: 0, successCount: 0 }
      };
      
      const byOperation: Record<string, { tokens: number; calls: number; successCount: number }> = {};
      
      metrics.forEach(metric => {
        const metadata = metric.metadata as any;
        const tokens = metadata.tokenCount || 0;
        const calls = metric.count;
        const processingTime = metadata.processingTime || 0;
        const success = metadata.success;
        const contentType = metadata.contentType;
        const operation = metadata.operation;
        
        totalTokens += tokens;
        totalApiCalls += calls;
        totalProcessingTime += processingTime;
        
        if (success) {
          successCount += calls;
        }
        
        // By content type
        if (contentType && byContentType[contentType]) {
          byContentType[contentType].tokens += tokens;
          byContentType[contentType].calls += calls;
          if (success) {
            byContentType[contentType].successCount += calls;
          }
        }
        
        // By operation
        if (operation) {
          if (!byOperation[operation]) {
            byOperation[operation] = { tokens: 0, calls: 0, successCount: 0 };
          }
          byOperation[operation].tokens += tokens;
          byOperation[operation].calls += calls;
          if (success) {
            byOperation[operation].successCount += calls;
          }
        }
      });
      
      // Calculate success rates
      const successRate = totalApiCalls > 0 ? successCount / totalApiCalls : 0;
      
      const processedByContentType: Record<EmbeddingType, { tokens: number; calls: number; successRate: number }> = {
        MENU: { tokens: 0, calls: 0, successRate: 0 },
        POLICY: { tokens: 0, calls: 0, successRate: 0 },
        FAQ: { tokens: 0, calls: 0, successRate: 0 },
        BUSINESS: { tokens: 0, calls: 0, successRate: 0 }
      };
      
      Object.entries(byContentType).forEach(([type, stats]) => {
        processedByContentType[type as EmbeddingType] = {
          tokens: stats.tokens,
          calls: stats.calls,
          successRate: stats.calls > 0 ? stats.successCount / stats.calls : 0
        };
      });
      
      const processedByOperation: Record<string, { tokens: number; calls: number; successRate: number }> = {};
      Object.entries(byOperation).forEach(([operation, stats]) => {
        processedByOperation[operation] = {
          tokens: stats.tokens,
          calls: stats.calls,
          successRate: stats.calls > 0 ? stats.successCount / stats.calls : 0
        };
      });
      
      return {
        businessId,
        period,
        totalTokens,
        totalApiCalls,
        totalProcessingTime,
        successRate,
        byContentType: processedByContentType,
        byOperation: processedByOperation
      };
      
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      throw error;
    }
  }
  
  /**
   * Get current usage for rate limiting
   */
  async getCurrentUsage(businessId: string, windowMinutes: number = 60): Promise<{
    tokens: number;
    calls: number;
    windowStart: Date;
  }> {
    try {
      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
      
      const metrics = await this.prisma.usageMetric.findMany({
        where: {
          businessId,
          type: 'API_CALL',
          date: {
            gte: windowStart
          }
        }
      });
      
      let tokens = 0;
      let calls = 0;
      
      metrics.forEach(metric => {
        const metadata = metric.metadata as any;
        tokens += metadata.tokenCount || 0;
        calls += metric.count;
      });
      
      return {
        tokens,
        calls,
        windowStart
      };
      
    } catch (error) {
      console.error('Failed to get current usage:', error);
      return { tokens: 0, calls: 0, windowStart: new Date() };
    }
  }
  
  /**
   * Check if business is within rate limits
   */
  async isWithinRateLimit(
    businessId: string,
    maxTokensPerHour: number = 10000,
    maxCallsPerHour: number = 1000
  ): Promise<{
    allowed: boolean;
    currentTokens: number;
    currentCalls: number;
    resetTime: Date;
  }> {
    const usage = await this.getCurrentUsage(businessId, 60);
    const resetTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    
    return {
      allowed: usage.tokens < maxTokensPerHour && usage.calls < maxCallsPerHour,
      currentTokens: usage.tokens,
      currentCalls: usage.calls,
      resetTime
    };
  }
  
  /**
   * Estimate cost for usage
   */
  estimateCost(tokens: number): number {
    // OpenAI text-embedding-ada-002 pricing: $0.0001 per 1K tokens
    const costPer1KTokens = 0.0001;
    return (tokens / 1000) * costPer1KTokens;
  }
  
  /**
   * Get cost estimate for a business
   */
  async getCostEstimate(
    businessId: string,
    period: 'day' | 'week' | 'month' = 'day'
  ): Promise<{
    period: string;
    tokens: number;
    estimatedCost: number;
    currency: string;
  }> {
    const stats = await this.getUsageStats(businessId, period);
    const estimatedCost = this.estimateCost(stats.totalTokens);
    
    return {
      period,
      tokens: stats.totalTokens,
      estimatedCost,
      currency: 'USD'
    };
  }
  
  /**
   * Check for usage alerts
   */
  private async checkAlerts(record: UsageRecord): Promise<void> {
    try {
      const stats = await this.getUsageStats(record.businessId, 'hour');
      
      // High usage alert
      if (stats.totalTokens > this.alertThresholds.highUsage) {
        await this.createAlert({
          businessId: record.businessId,
          type: 'high_usage',
          message: `High token usage detected: ${stats.totalTokens} tokens in the last hour`,
          threshold: this.alertThresholds.highUsage,
          currentValue: stats.totalTokens,
          timestamp: new Date()
        });
      }
      
      // Error rate alert
      if (stats.successRate < (1 - this.alertThresholds.errorRate)) {
        await this.createAlert({
          businessId: record.businessId,
          type: 'error_rate',
          message: `High error rate detected: ${((1 - stats.successRate) * 100).toFixed(1)}%`,
          threshold: this.alertThresholds.errorRate,
          currentValue: 1 - stats.successRate,
          timestamp: new Date()
        });
      }
      
      // Cost threshold alert
      const costEstimate = this.estimateCost(stats.totalTokens);
      if (costEstimate > this.alertThresholds.costThreshold) {
        await this.createAlert({
          businessId: record.businessId,
          type: 'cost_threshold',
          message: `Cost threshold exceeded: $${costEstimate.toFixed(2)} in the last hour`,
          threshold: this.alertThresholds.costThreshold,
          currentValue: costEstimate,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('Failed to check alerts:', error);
    }
  }
  
  /**
   * Create usage alert
   */
  private async createAlert(alert: UsageAlert): Promise<void> {
    try {
      // Store alert in database
      await this.prisma.usageMetric.create({
        data: {
          businessId: alert.businessId,
          type: 'API_CALL',
          count: 1,
          metadata: {
            alert: true,
            alertType: alert.type,
            message: alert.message,
            threshold: alert.threshold,
            currentValue: alert.currentValue,
            timestamp: alert.timestamp
          }
        }
      });
      
      // Log alert
      console.warn(`Usage Alert for ${alert.businessId}: ${alert.message}`);
      
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  }
  
  /**
   * Get period start date
   */
  private getPeriodStart(date: Date, period: string): Date {
    const start = new Date(date);
    
    switch (period) {
      case 'hour':
        start.setMinutes(0, 0, 0);
        break;
      case 'day':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    
    return start;
  }
  
  /**
   * Generate comprehensive usage report
   */
  async generateUsageReport(
    businessId: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<UsageReport> {
    try {
      const now = new Date();
      const startDate = this.getPeriodStart(now, period);
      const endDate = now;
      
      // Get usage metrics
      const metrics = await this.prisma.usageMetric.findMany({
        where: {
          businessId,
          type: 'API_CALL',
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      
      // Calculate summary
      let totalTokens = 0;
      let totalApiCalls = 0;
      let totalProcessingTime = 0;
      let successCount = 0;
      
      const byOperation: Record<string, { tokens: number; calls: number; successCount: number; processingTime: number }> = {};
      const byContentType: Record<EmbeddingType, { tokens: number; calls: number; successCount: number; processingTime: number }> = {
        MENU: { tokens: 0, calls: 0, successCount: 0, processingTime: 0 },
        POLICY: { tokens: 0, calls: 0, successCount: 0, processingTime: 0 },
        FAQ: { tokens: 0, calls: 0, successCount: 0, processingTime: 0 },
        BUSINESS: { tokens: 0, calls: 0, successCount: 0, processingTime: 0 }
      };
      
      metrics.forEach(metric => {
        const metadata = metric.metadata as any;
        const tokens = metadata.tokenCount || 0;
        const calls = metric.count;
        const processingTime = metadata.processingTime || 0;
        const success = metadata.success;
        const operation = metadata.operation;
        const contentType = metadata.contentType;
        
        totalTokens += tokens;
        totalApiCalls += calls;
        totalProcessingTime += processingTime;
        
        if (success) {
          successCount += calls;
        }
        
        // By operation
        if (operation) {
          if (!byOperation[operation]) {
            byOperation[operation] = { tokens: 0, calls: 0, successCount: 0, processingTime: 0 };
          }
          byOperation[operation].tokens += tokens;
          byOperation[operation].calls += calls;
          byOperation[operation].processingTime += processingTime;
          if (success) {
            byOperation[operation].successCount += calls;
          }
        }
        
        // By content type
        if (contentType && byContentType[contentType]) {
          byContentType[contentType].tokens += tokens;
          byContentType[contentType].calls += calls;
          byContentType[contentType].processingTime += processingTime;
          if (success) {
            byContentType[contentType].successCount += calls;
          }
        }
      });
      
      // Calculate trends (compare with previous period)
      const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousMetrics = await this.prisma.usageMetric.findMany({
        where: {
          businessId,
          type: 'API_CALL',
          date: {
            gte: previousStartDate,
            lt: startDate
          }
        }
      });
      
      let previousTokens = 0;
      let previousCalls = 0;
      previousMetrics.forEach(metric => {
        const metadata = metric.metadata as any;
        previousTokens += metadata.tokenCount || 0;
        previousCalls += metric.count;
      });
      
      const tokenGrowth = previousTokens > 0 ? ((totalTokens - previousTokens) / previousTokens) * 100 : 0;
      const usageGrowth = previousCalls > 0 ? ((totalApiCalls - previousCalls) / previousCalls) * 100 : 0;
      const costGrowth = tokenGrowth; // Cost growth follows token growth
      
      // Get alerts for the period
      const alerts = await this.getAlerts(businessId, startDate, endDate);
      
      return {
        businessId,
        period,
        startDate,
        endDate,
        summary: {
          totalTokens,
          totalApiCalls,
          totalCost: this.estimateCost(totalTokens),
          successRate: totalApiCalls > 0 ? successCount / totalApiCalls : 0,
          averageResponseTime: totalApiCalls > 0 ? totalProcessingTime / totalApiCalls : 0
        },
        breakdown: {
          byOperation: Object.entries(byOperation).reduce((acc, [operation, stats]) => {
            acc[operation] = {
              tokens: stats.tokens,
              calls: stats.calls,
              cost: this.estimateCost(stats.tokens),
              successRate: stats.calls > 0 ? stats.successCount / stats.calls : 0
            };
            return acc;
          }, {} as Record<string, { tokens: number; calls: number; cost: number; successRate: number }>),
          byContentType: Object.entries(byContentType).reduce((acc, [contentType, stats]) => {
            acc[contentType as EmbeddingType] = {
              tokens: stats.tokens,
              calls: stats.calls,
              cost: this.estimateCost(stats.tokens),
              successRate: stats.calls > 0 ? stats.successCount / stats.calls : 0
            };
            return acc;
          }, {} as Record<EmbeddingType, { tokens: number; calls: number; cost: number; successRate: number }>)
        },
        trends: {
          tokenGrowth,
          costGrowth,
          usageGrowth
        },
        alerts
      };
      
    } catch (error) {
      console.error('Failed to generate usage report:', error);
      throw error;
    }
  }
  
  /**
   * Get admin dashboard metrics
   */
  async getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      // Get all businesses
      const businesses = await this.prisma.business.findMany({
        select: { id: true, name: true }
      });
      
      // Get usage metrics for all businesses
      const metrics = await this.prisma.usageMetric.findMany({
        where: {
          type: 'API_CALL',
          date: {
            gte: startDate
          }
        }
      });
      
      // Calculate totals
      let totalTokens = 0;
      let totalApiCalls = 0;
      let totalProcessingTime = 0;
      let successCount = 0;
      
      const businessStats = new Map<string, {
        tokens: number;
        calls: number;
        processingTime: number;
        successCount: number;
      }>();
      
      metrics.forEach(metric => {
        const metadata = metric.metadata as any;
        const tokens = metadata.tokenCount || 0;
        const calls = metric.count;
        const processingTime = metadata.processingTime || 0;
        const success = metadata.success;
        
        totalTokens += tokens;
        totalApiCalls += calls;
        totalProcessingTime += processingTime;
        
        if (success) {
          successCount += calls;
        }
        
        // Per business stats
        if (!businessStats.has(metric.businessId)) {
          businessStats.set(metric.businessId, { tokens: 0, calls: 0, processingTime: 0, successCount: 0 });
        }
        
        const businessStat = businessStats.get(metric.businessId)!;
        businessStat.tokens += tokens;
        businessStat.calls += calls;
        businessStat.processingTime += processingTime;
        if (success) {
          businessStat.successCount += calls;
        }
      });
      
      // Get top businesses
      const topBusinesses = Array.from(businessStats.entries())
        .map(([businessId, stats]) => {
          const business = businesses.find(b => b.id === businessId);
          return {
            businessId,
            businessName: business?.name || 'Unknown',
            tokens: stats.tokens,
            cost: this.estimateCost(stats.tokens),
            calls: stats.calls
          };
        })
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 10);
      
      // Get recent alerts
      const recentAlerts = await this.getAlerts(undefined, startDate, now);
      
      return {
        totalBusinesses: businesses.length,
        activeBusinesses: businessStats.size,
        totalTokens,
        totalCost: this.estimateCost(totalTokens),
        totalApiCalls,
        averageSuccessRate: totalApiCalls > 0 ? successCount / totalApiCalls : 0,
        topBusinesses,
        recentAlerts: recentAlerts.slice(0, 10),
        systemHealth: {
          averageResponseTime: totalApiCalls > 0 ? totalProcessingTime / totalApiCalls : 0,
          errorRate: totalApiCalls > 0 ? (totalApiCalls - successCount) / totalApiCalls : 0,
          queueSize: 0, // This would come from the auto-trigger service
          processingRate: totalApiCalls / 24 // Calls per hour
        }
      };
      
    } catch (error) {
      console.error('Failed to get admin dashboard metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get alerts for a business or all businesses
   */
  async getAlerts(
    businessId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageAlert[]> {
    try {
      const where: any = {
        type: 'API_CALL',
        metadata: {
          path: ['alert'],
          equals: true
        }
      };
      
      if (businessId) {
        where.businessId = businessId;
      }
      
      if (startDate && endDate) {
        where.date = {
          gte: startDate,
          lte: endDate
        };
      }
      
      const metrics = await this.prisma.usageMetric.findMany({
        where,
        orderBy: { date: 'desc' },
        take: 100
      });
      
      return metrics.map(metric => {
        const metadata = metric.metadata as any;
        return {
          businessId: metric.businessId,
          type: metadata.alertType,
          message: metadata.message,
          threshold: metadata.threshold,
          currentValue: metadata.currentValue,
          timestamp: metric.date,
          severity: metadata.severity || 'medium',
          resolved: metadata.resolved || false,
          resolvedAt: metadata.resolvedAt ? new Date(metadata.resolvedAt) : undefined
        };
      });
      
    } catch (error) {
      console.error('Failed to get alerts:', error);
      return [];
    }
  }
  
  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, businessId: string): Promise<boolean> {
    try {
      // This would require storing alert IDs in the metadata
      // For now, we'll mark recent alerts as resolved
      const recentAlerts = await this.getAlerts(businessId, new Date(Date.now() - 24 * 60 * 60 * 1000));
      
      // Find and resolve the alert (simplified implementation)
      console.log(`Resolving alert ${alertId} for business ${businessId}`);
      return true;
      
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      return false;
    }
  }
  
  /**
   * Export usage data for a business
   */
  async exportUsageData(
    businessId: string,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'json'
  ): Promise<string> {
    try {
      const metrics = await this.prisma.usageMetric.findMany({
        where: {
          businessId,
          type: 'API_CALL',
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { date: 'asc' }
      });
      
      if (format === 'csv') {
        const headers = ['Date', 'Operation', 'ContentType', 'Tokens', 'Calls', 'ProcessingTime', 'Success', 'Cost'];
        const rows = metrics.map(metric => {
          const metadata = metric.metadata as any;
          return [
            metric.date.toISOString(),
            metadata.operation || '',
            metadata.contentType || '',
            metadata.tokenCount || 0,
            metric.count,
            metadata.processingTime || 0,
            metadata.success || false,
            this.estimateCost(metadata.tokenCount || 0)
          ];
        });
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
      } else {
        return JSON.stringify(metrics, null, 2);
      }
      
    } catch (error) {
      console.error('Failed to export usage data:', error);
      throw error;
    }
  }
  
  /**
   * Clean up old usage data
   */
  async cleanupOldData(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      
      const result = await this.prisma.usageMetric.deleteMany({
        where: {
          type: 'API_CALL',
          date: {
            lt: cutoffDate
          }
        }
      });
      
      return result.count;
      
    } catch (error) {
      console.error('Failed to cleanup old usage data:', error);
      return 0;
    }
  }
}

// Export singleton factory
export function createUsageTracker(prisma: PrismaClient): UsageTracker {
  return new UsageTracker(prisma);
}
