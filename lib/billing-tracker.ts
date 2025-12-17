/**
 * Billing Tracker - Tracks API calls, voice minutes, and other usage metrics
 * Integrates with the dashboard billing overview section
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface BillingUsage {
  apiCalls: number;
  minutesUsed: number;
  cost: number;
  breakdown: {
    apiCalls: { count: number; cost: number };
    voiceMinutes: { count: number; cost: number };
    aiQueries: { count: number; cost: number };
    storage: { count: number; cost: number };
  };
}

export interface UsageEvent {
  businessId: string;
  eventType: 'api_call' | 'voice_minute' | 'ai_query' | 'storage_mb';
  quantity: number;
  metadata?: Record<string, any>;
}

export class BillingTracker {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Record a usage event
   */
  async recordUsage(event: UsageEvent): Promise<void> {
    try {
      const unitPriceCents = this.getUnitPrice(event.eventType);
      const totalCostCents = Math.round(event.quantity * unitPriceCents);

      // Record in usage_events table
      await this.prisma.usageEvent.create({
        data: {
          business_id: event.businessId,
          event_type: event.eventType,
          quantity: event.quantity,
          cost_cents: totalCostCents,
          metadata: event.metadata || {}
        }
      });

      console.log(`Recorded usage: ${event.eventType} - ${event.quantity} units - $${(totalCostCents / 100).toFixed(2)}`);
    } catch (error) {
      console.error('Failed to record usage:', error);
      // Don't throw - billing tracking should not break main functionality
    }
  }

  /**
   * Record API call usage
   */
  async recordApiCall(businessId: string, metadata?: Record<string, any>): Promise<void> {
    await this.recordUsage({
      businessId,
      eventType: 'api_call',
      quantity: 1,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Record voice minute usage
   */
  async recordVoiceMinutes(businessId: string, minutes: number, metadata?: Record<string, any>): Promise<void> {
    await this.recordUsage({
      businessId,
      eventType: 'voice_minute',
      quantity: minutes,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Record AI query usage
   */
  async recordAiQuery(businessId: string, metadata?: Record<string, any>): Promise<void> {
    await this.recordUsage({
      businessId,
      eventType: 'ai_query',
      quantity: 1,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Get billing usage for a business
   */
  async getBillingUsage(businessId: string, period: 'current_month' | 'last_30_days' = 'current_month'): Promise<BillingUsage> {
    try {
      const startDate = this.getPeriodStartDate(period);
      const endDate = new Date();

      // Get usage events for the period
      const usageEvents = await this.prisma.usageEvent.findMany({
        where: {
          business_id: businessId,
          created_at: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          event_type: true,
          quantity: true,
          cost_cents: true
        }
      });

      // Aggregate usage by type
      const breakdown = {
        apiCalls: { count: 0, cost: 0 },
        voiceMinutes: { count: 0, cost: 0 },
        aiQueries: { count: 0, cost: 0 },
        storage: { count: 0, cost: 0 }
      };

      let totalApiCalls = 0;
      let totalMinutes = 0;
      let totalCost = 0;

      for (const event of usageEvents) {
        const cost = Number(event.cost_cents) / 100;
        totalCost += cost;

        switch (event.event_type) {
          case 'api_call':
            totalApiCalls += Number(event.quantity);
            breakdown.apiCalls.count += Number(event.quantity);
            breakdown.apiCalls.cost += cost;
            break;
          case 'voice_minute':
            totalMinutes += Number(event.quantity);
            breakdown.voiceMinutes.count += Number(event.quantity);
            breakdown.voiceMinutes.cost += cost;
            break;
          case 'ai_query':
            breakdown.aiQueries.count += Number(event.quantity);
            breakdown.aiQueries.cost += cost;
            break;
          case 'storage_mb':
            breakdown.storage.count += Number(event.quantity);
            breakdown.storage.cost += cost;
            break;
        }
      }

      return {
        apiCalls: totalApiCalls,
        minutesUsed: totalMinutes,
        cost: totalCost,
        breakdown
      };
    } catch (error) {
      console.error('Failed to get billing usage:', error);
      return {
        apiCalls: 0,
        minutesUsed: 0,
        cost: 0,
        breakdown: {
          apiCalls: { count: 0, cost: 0 },
          voiceMinutes: { count: 0, cost: 0 },
          aiQueries: { count: 0, cost: 0 },
          storage: { count: 0, cost: 0 }
        }
      };
    }
  }

  /**
   * Get usage trends for analytics
   */
  async getUsageTrends(businessId: string, days: number = 30): Promise<Array<{
    date: string;
    apiCalls: number;
    voiceMinutes: number;
    cost: number;
  }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const usageEvents = await this.prisma.usageEvent.findMany({
        where: {
          business_id: businessId,
          created_at: {
            gte: startDate
          }
        },
        select: {
          event_type: true,
          quantity: true,
          cost_cents: true,
          created_at: true
        },
        orderBy: {
          created_at: 'asc'
        }
      });

      // Group by date
      const dailyUsage = new Map<string, { apiCalls: number; voiceMinutes: number; cost: number }>();

      for (const event of usageEvents) {
        const date = event.created_at.toISOString().split('T')[0];
        if (!dailyUsage.has(date)) {
          dailyUsage.set(date, { apiCalls: 0, voiceMinutes: 0, cost: 0 });
        }

        const dayData = dailyUsage.get(date)!;
        const cost = Number(event.cost_cents) / 100;

        switch (event.event_type) {
          case 'api_call':
            dayData.apiCalls += Number(event.quantity);
            break;
          case 'voice_minute':
            dayData.voiceMinutes += Number(event.quantity);
            break;
        }
        dayData.cost += cost;
      }

      // Convert to array and fill missing dates
      const trends = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        trends.unshift({
          date: dateStr,
          apiCalls: dailyUsage.get(dateStr)?.apiCalls || 0,
          voiceMinutes: dailyUsage.get(dateStr)?.voiceMinutes || 0,
          cost: dailyUsage.get(dateStr)?.cost || 0
        });
      }

      return trends;
    } catch (error) {
      console.error('Failed to get usage trends:', error);
      return [];
    }
  }

  /**
   * Get unit price for event type
   */
  private getUnitPrice(eventType: string): number {
    const prices = {
      'api_call': 1,      // $0.01 per API call
      'voice_minute': 2,  // $0.02 per voice minute
      'ai_query': 5,      // $0.05 per AI query
      'storage_mb': 0.1  // $0.001 per MB
    };

    return Math.round((prices[eventType] || 1) * 100); // Convert to cents
  }

  /**
   * Get period start date
   */
  private getPeriodStartDate(period: 'current_month' | 'last_30_days'): Date {
    const now = new Date();
    
    if (period === 'current_month') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      return startDate;
    }
  }

  /**
   * Clean up old usage events (optional maintenance)
   */
  async cleanupOldEvents(olderThanDays: number = 365): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      await this.prisma.usageEvent.deleteMany({
        where: {
          created_at: {
            lt: cutoffDate
          }
        }
      });

      console.log(`Cleaned up usage events older than ${olderThanDays} days`);
    } catch (error) {
      console.error('Failed to cleanup old events:', error);
    }
  }
}

// Global instance
export const billingTracker = new BillingTracker();
