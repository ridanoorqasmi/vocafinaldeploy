/**
 * Phase 4B: Real-Time Usage Tracking Service
 * High-performance usage tracking with Redis caching and atomic counters
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface UsageCounter {
  business_id: string;
  quota_type: string;
  current_usage: number;
  limit: number;
  reset_date: Date;
  last_updated: Date;
}

export interface UsageEvent {
  business_id: string;
  event_type: 'query' | 'embedding' | 'api_call' | 'storage';
  quantity: number;
  tokens_consumed?: number;
  cost_cents?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface UsageAnalytics {
  business_id: string;
  period_start: Date;
  period_end: Date;
  total_usage: Record<string, number>;
  peak_usage: Record<string, number>;
  average_daily_usage: Record<string, number>;
  cost_breakdown: Record<string, number>;
  trends: Record<string, {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentage_change: number;
  }>;
}

export interface UsageForecast {
  business_id: string;
  quota_type: string;
  forecast_date: Date;
  predicted_usage: number;
  confidence_score: number;
  model_version: string;
  factors: Record<string, number>;
}

export class UsageTrackingService {
  private prisma: PrismaClient;
  private redis: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_INTERVAL = 5000; // 5 seconds

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
  }

  /**
   * Record usage event with real-time counter updates
   */
  async recordUsageEvent(event: UsageEvent): Promise<void> {
    try {
      // Update real-time counters in Redis
      await this.updateRealtimeCounters(event);

      // Store event in database (async)
      this.storeUsageEvent(event).catch(error => {
        console.error('Failed to store usage event:', error);
      });

      // Check for alerts (async)
      this.checkUsageAlerts(event.business_id, event.event_type).catch(error => {
        console.error('Failed to check usage alerts:', error);
      });

    } catch (error) {
      console.error('Usage tracking error:', error);
      // Don't throw - usage tracking should not break main operations
    }
  }

  /**
   * Get current usage status with caching
   */
  async getCurrentUsageStatus(businessId: string): Promise<UsageCounter[]> {
    try {
      // Try to get from cache first
      const cacheKey = `usage:${businessId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database and cache
      const quotas = await this.prisma.usage_quotas.findMany({
        where: { business_id: businessId }
      });

      const counters: UsageCounter[] = quotas.map(quota => ({
        business_id: quota.business_id,
        quota_type: quota.quota_type,
        current_usage: quota.quota_used,
        limit: quota.quota_limit,
        reset_date: quota.reset_date,
        last_updated: quota.updated_at
      }));

      // Cache for 1 hour
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(counters));

      return counters;

    } catch (error) {
      console.error('Get usage status error:', error);
      return [];
    }
  }

  /**
   * Check if business can perform operation (with caching)
   */
  async canPerformOperation(
    businessId: string,
    operationType: string,
    estimatedQuantity: number = 1
  ): Promise<{
    allowed: boolean;
    remaining: number;
    reason?: string;
  }> {
    try {
      const quotaType = this.getQuotaTypeForOperation(operationType);
      const counters = await this.getCurrentUsageStatus(businessId);
      const counter = counters.find(c => c.quota_type === quotaType);

      if (!counter) {
        return { allowed: false, remaining: 0, reason: 'No quota found for operation' };
      }

      const remaining = counter.limit - counter.current_usage;
      const allowed = remaining >= estimatedQuantity;

      return {
        allowed,
        remaining: Math.max(0, remaining),
        reason: allowed ? undefined : `Insufficient quota. Need ${estimatedQuantity}, have ${remaining}`
      };

    } catch (error) {
      console.error('Can perform operation check error:', error);
      return { allowed: true, remaining: 1000, reason: 'System error - allowing operation' };
    }
  }

  /**
   * Get usage analytics for a business
   */
  async getUsageAnalytics(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<UsageAnalytics> {
    try {
      // Get usage events for the period
      const events = await this.prisma.usage_events.findMany({
        where: {
          business_id: businessId,
          created_at: {
            gte: periodStart,
            lte: periodEnd
          }
        },
        orderBy: { created_at: 'asc' }
      });

      // Calculate analytics
      const totalUsage = this.calculateTotalUsage(events);
      const peakUsage = this.calculatePeakUsage(events, periodStart, periodEnd);
      const averageDailyUsage = this.calculateAverageDailyUsage(events, periodStart, periodEnd);
      const costBreakdown = this.calculateCostBreakdown(events);
      const trends = await this.calculateTrends(businessId, periodStart, periodEnd);

      return {
        business_id: businessId,
        period_start: periodStart,
        period_end: periodEnd,
        total_usage: totalUsage,
        peak_usage: peakUsage,
        average_daily_usage: averageDailyUsage,
        cost_breakdown: costBreakdown,
        trends
      };

    } catch (error) {
      console.error('Usage analytics error:', error);
      throw error;
    }
  }

  /**
   * Generate usage forecast
   */
  async generateUsageForecast(
    businessId: string,
    quotaType: string,
    forecastDate: Date
  ): Promise<UsageForecast> {
    try {
      // Get historical usage data
      const historicalData = await this.getHistoricalUsage(businessId, quotaType, 30); // Last 30 days

      // Simple linear regression for forecasting
      const forecast = this.calculateLinearForecast(historicalData, forecastDate);

      // Calculate confidence score based on data quality
      const confidenceScore = this.calculateConfidenceScore(historicalData);

      return {
        business_id: businessId,
        quota_type: quotaType,
        forecast_date: forecastDate,
        predicted_usage: forecast.predicted,
        confidence_score: confidenceScore,
        model_version: 'v1.0',
        factors: forecast.factors
      };

    } catch (error) {
      console.error('Usage forecast error:', error);
      throw error;
    }
  }

  /**
   * Batch process usage events for performance
   */
  async batchProcessUsageEvents(): Promise<void> {
    try {
      // Get pending events from Redis queue
      const pendingEvents = await this.getPendingEvents();
      
      if (pendingEvents.length === 0) return;

      // Process in batches
      for (let i = 0; i < pendingEvents.length; i += this.BATCH_SIZE) {
        const batch = pendingEvents.slice(i, i + this.BATCH_SIZE);
        await this.processBatch(batch);
      }

    } catch (error) {
      console.error('Batch processing error:', error);
    }
  }

  /**
   * Reset usage counters for new billing period
   */
  async resetUsageCounters(businessId: string): Promise<void> {
    try {
      // Get current quotas
      const quotas = await this.prisma.usage_quotas.findMany({
        where: { business_id: businessId }
      });

      // Reset counters in database
      for (const quota of quotas) {
        await this.prisma.usage_quotas.update({
          where: { id: quota.id },
          data: {
            quota_used: 0,
            quota_overage: 0,
            last_reset_date: quota.reset_date,
            reset_date: this.getNextResetDate(quota.reset_date),
            updated_at: new Date()
          }
        });
      }

      // Clear cache
      const cacheKey = `usage:${businessId}`;
      await this.redis.del(cacheKey);

      // Log reset event
      await this.prisma.usage_events.create({
        data: {
          business_id: businessId,
          event_type: 'quota_reset',
          quantity: 1,
          metadata: {
            reset_type: 'billing_period',
            timestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Reset usage counters error:', error);
      throw error;
    }
  }

  // Private helper methods

  private async updateRealtimeCounters(event: UsageEvent): Promise<void> {
    const quotaType = this.getQuotaTypeForOperation(event.event_type);
    const counterKey = `counter:${event.business_id}:${quotaType}`;
    
    // Use Redis atomic increment
    const newValue = await this.redis.incrby(counterKey, event.quantity);
    
    // Set expiration if this is the first increment
    if (newValue === event.quantity) {
      await this.redis.expire(counterKey, this.CACHE_TTL);
    }

    // Update last activity timestamp
    await this.redis.hset(`activity:${event.business_id}`, quotaType, Date.now());
  }

  private async storeUsageEvent(event: UsageEvent): Promise<void> {
    // Store in database
    await this.prisma.usage_events.create({
      data: {
        business_id: event.business_id,
        event_type: event.event_type,
        quantity: event.quantity,
        tokens_consumed: event.tokens_consumed,
        cost_cents: event.cost_cents,
        metadata: event.metadata
      }
    });

    // Update usage quotas
    const quotaType = this.getQuotaTypeForOperation(event.event_type);
    await this.prisma.usage_quotas.upsert({
      where: {
        business_id_quota_type: {
          business_id: event.business_id,
          quota_type: quotaType
        }
      },
      update: {
        quota_used: { increment: event.quantity }
      },
      create: {
        business_id: event.business_id,
        plan_id: 'free', // Default plan
        quota_type: quotaType,
        quota_limit: 100, // Default limit
        quota_used: event.quantity,
        reset_date: this.getNextResetDate(new Date())
      }
    });
  }

  private async checkUsageAlerts(businessId: string, eventType: string): Promise<void> {
    const quotaType = this.getQuotaTypeForOperation(eventType);
    const counters = await this.getCurrentUsageStatus(businessId);
    const counter = counters.find(c => c.quota_type === quotaType);

    if (!counter) return;

    const percentage = (counter.current_usage / counter.limit) * 100;

    // Check alert thresholds
    if (percentage >= 75 && percentage < 90) {
      await this.createAlert(businessId, 'approaching_limit', quotaType, 75);
    } else if (percentage >= 90 && percentage < 100) {
      await this.createAlert(businessId, 'approaching_limit', quotaType, 90);
    } else if (percentage >= 100) {
      await this.createAlert(businessId, 'limit_exceeded', quotaType, 100);
    }
  }

  private async createAlert(
    businessId: string,
    alertType: string,
    quotaType: string,
    threshold: number
  ): Promise<void> {
    // Check if alert already exists
    const existingAlert = await this.prisma.usage_alerts.findFirst({
      where: {
        business_id: businessId,
        alert_type: alertType,
        quota_type: quotaType,
        threshold_percentage: threshold,
        resolved_at: null
      }
    });

    if (!existingAlert) {
      await this.prisma.usage_alerts.create({
        data: {
          business_id: businessId,
          alert_type: alertType,
          quota_type: quotaType,
          threshold_percentage: threshold
        }
      });
    }
  }

  private getQuotaTypeForOperation(eventType: string): string {
    const mapping = {
      'query': 'queries',
      'embedding': 'embeddings',
      'api_call': 'api_calls',
      'storage': 'storage'
    };
    return mapping[eventType] || 'queries';
  }

  private getNextResetDate(currentResetDate: Date): Date {
    const nextMonth = new Date(currentResetDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  }

  private calculateTotalUsage(events: any[]): Record<string, number> {
    const totals: Record<string, number> = {};
    
    for (const event of events) {
      const quotaType = this.getQuotaTypeForOperation(event.event_type);
      totals[quotaType] = (totals[quotaType] || 0) + event.quantity;
    }

    return totals;
  }

  private calculatePeakUsage(events: any[], periodStart: Date, periodEnd: Date): Record<string, number> {
    const hourlyUsage: Record<string, Record<string, number>> = {};
    
    for (const event of events) {
      const quotaType = this.getQuotaTypeForOperation(event.event_type);
      const hour = new Date(event.created_at).toISOString().slice(0, 13);
      
      if (!hourlyUsage[quotaType]) {
        hourlyUsage[quotaType] = {};
      }
      
      hourlyUsage[quotaType][hour] = (hourlyUsage[quotaType][hour] || 0) + event.quantity;
    }

    const peaks: Record<string, number> = {};
    for (const quotaType in hourlyUsage) {
      const hours = Object.values(hourlyUsage[quotaType]);
      peaks[quotaType] = Math.max(...hours);
    }

    return peaks;
  }

  private calculateAverageDailyUsage(events: any[], periodStart: Date, periodEnd: Date): Record<string, number> {
    const dailyUsage: Record<string, Record<string, number>> = {};
    
    for (const event of events) {
      const quotaType = this.getQuotaTypeForOperation(event.event_type);
      const day = new Date(event.created_at).toISOString().slice(0, 10);
      
      if (!dailyUsage[quotaType]) {
        dailyUsage[quotaType] = {};
      }
      
      dailyUsage[quotaType][day] = (dailyUsage[quotaType][day] || 0) + event.quantity;
    }

    const averages: Record<string, number> = {};
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    
    for (const quotaType in dailyUsage) {
      const days = Object.values(dailyUsage[quotaType]);
      const total = days.reduce((sum, day) => sum + day, 0);
      averages[quotaType] = Math.round(total / daysDiff);
    }

    return averages;
  }

  private calculateCostBreakdown(events: any[]): Record<string, number> {
    const costs: Record<string, number> = {};
    
    for (const event of events) {
      const quotaType = this.getQuotaTypeForOperation(event.event_type);
      const cost = event.cost_cents || 0;
      costs[quotaType] = (costs[quotaType] || 0) + cost;
    }

    return costs;
  }

  private async calculateTrends(
    businessId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Record<string, { direction: string; percentage_change: number }>> {
    // Get previous period for comparison
    const periodLength = periodEnd.getTime() - periodStart.getTime();
    const previousPeriodStart = new Date(periodStart.getTime() - periodLength);
    const previousPeriodEnd = new Date(periodStart.getTime());

    const [currentEvents, previousEvents] = await Promise.all([
      this.prisma.usage_events.findMany({
        where: {
          business_id: businessId,
          created_at: { gte: periodStart, lte: periodEnd }
        }
      }),
      this.prisma.usage_events.findMany({
        where: {
          business_id: businessId,
          created_at: { gte: previousPeriodStart, lte: previousPeriodEnd }
        }
      })
    ]);

    const currentUsage = this.calculateTotalUsage(currentEvents);
    const previousUsage = this.calculateTotalUsage(previousEvents);

    const trends: Record<string, { direction: string; percentage_change: number }> = {};

    for (const quotaType in currentUsage) {
      const current = currentUsage[quotaType];
      const previous = previousUsage[quotaType] || 0;
      
      const percentageChange = previous === 0 ? 100 : ((current - previous) / previous) * 100;
      
      let direction = 'stable';
      if (percentageChange > 10) direction = 'increasing';
      else if (percentageChange < -10) direction = 'decreasing';

      trends[quotaType] = {
        direction,
        percentage_change: Math.round(percentageChange * 100) / 100
      };
    }

    return trends;
  }

  private async getHistoricalUsage(
    businessId: string,
    quotaType: string,
    days: number
  ): Promise<Array<{ date: Date; usage: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.prisma.usage_events.findMany({
      where: {
        business_id: businessId,
        event_type: this.getEventTypeForQuota(quotaType),
        created_at: { gte: startDate }
      },
      orderBy: { created_at: 'asc' }
    });

    // Group by day
    const dailyUsage: Record<string, number> = {};
    for (const event of events) {
      const day = new Date(event.created_at).toISOString().slice(0, 10);
      dailyUsage[day] = (dailyUsage[day] || 0) + event.quantity;
    }

    return Object.entries(dailyUsage).map(([date, usage]) => ({
      date: new Date(date),
      usage
    }));
  }

  private getEventTypeForQuota(quotaType: string): string {
    const mapping = {
      'queries': 'query',
      'embeddings': 'embedding',
      'api_calls': 'api_call',
      'storage': 'storage'
    };
    return mapping[quotaType] || 'query';
  }

  private calculateLinearForecast(
    historicalData: Array<{ date: Date; usage: number }>,
    forecastDate: Date
  ): { predicted: number; factors: Record<string, number> } {
    if (historicalData.length < 2) {
      return { predicted: 0, factors: {} };
    }

    // Simple linear regression
    const n = historicalData.length;
    const x = historicalData.map((_, i) => i);
    const y = historicalData.map(d => d.usage);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const daysFromStart = Math.ceil((forecastDate.getTime() - historicalData[0].date.getTime()) / (1000 * 60 * 60 * 24));
    const predicted = Math.max(0, slope * daysFromStart + intercept);

    return {
      predicted: Math.round(predicted),
      factors: {
        slope,
        intercept,
        data_points: n,
        correlation: this.calculateCorrelation(x, y)
      }
    };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateConfidenceScore(historicalData: Array<{ date: Date; usage: number }>): number {
    if (historicalData.length < 3) return 0.3;
    if (historicalData.length < 7) return 0.5;
    if (historicalData.length < 14) return 0.7;
    return 0.9;
  }

  private async getPendingEvents(): Promise<UsageEvent[]> {
    // This would get events from a Redis queue
    // For now, return empty array
    return [];
  }

  private async processBatch(events: UsageEvent[]): Promise<void> {
    // Process batch of events
    for (const event of events) {
      await this.storeUsageEvent(event);
    }
  }
}
