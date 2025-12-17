// ===== ANALYTICS LOGGER SERVICE =====

import { PrismaClient, QueryLog as PrismaQueryLog, Conversation as PrismaConversation } from '@prisma/client';
import { 
  QueryLogEntry, 
  QueryAnalytics, 
  SessionAnalytics,
  QueryIntent,
  ProcessingMetrics 
} from './query-types';

export interface AnalyticsLoggerConfig {
  enableDetailedLogging: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  logRetentionDays: number;
  batchLogSize: number;
  flushIntervalMs: number;
}

export interface LogEntry {
  businessId: string;
  conversationId?: string;
  sessionId?: string;
  queryText: string;
  intentDetected?: QueryIntent;
  contextRetrieved?: Record<string, any>;
  responseGenerated?: string;
  processingTimeMs?: number;
  tokenUsage?: number;
  confidenceScore?: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'RATE_LIMITED';
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  processingMetrics?: ProcessingMetrics;
}

export interface AnalyticsQuery {
  businessId?: string;
  startDate?: Date;
  endDate?: Date;
  intent?: QueryIntent;
  status?: string;
  limit?: number;
  offset?: number;
}

export class AnalyticsLogger {
  private prisma: PrismaClient;
  private config: AnalyticsLoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushInterval?: NodeJS.Timeout;

  constructor(prisma: PrismaClient, config?: Partial<AnalyticsLoggerConfig>) {
    this.prisma = prisma;
    this.config = {
      enableDetailedLogging: true,
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '30'),
      batchLogSize: parseInt(process.env.BATCH_LOG_SIZE || '100'),
      flushIntervalMs: parseInt(process.env.FLUSH_INTERVAL_MS || '5000'),
      ...config
    };

    // Start flush interval
    this.startFlushInterval();
  }

  /**
   * Log a query entry
   */
  async logQuery(entry: LogEntry): Promise<void> {
    if (!this.config.enableDetailedLogging) {
      return;
    }

    // Add to buffer
    this.logBuffer.push(entry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.batchLogSize) {
      await this.flushLogs();
    }
  }

  /**
   * Log processing metrics
   */
  async logProcessingMetrics(
    businessId: string,
    sessionId: string,
    metrics: ProcessingMetrics
  ): Promise<void> {
    if (!this.config.enablePerformanceTracking) {
      return;
    }

    const entry: LogEntry = {
      businessId,
      sessionId,
      queryText: 'Processing metrics',
      status: 'SUCCESS',
      processingMetrics: metrics,
      metadata: {
        type: 'performance_metrics',
        totalSteps: metrics.steps.length,
        totalDuration: metrics.duration
      }
    };

    await this.logQuery(entry);
  }

  /**
   * Log error with context
   */
  async logError(
    businessId: string,
    sessionId: string,
    error: Error,
    context?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enableErrorTracking) {
      return;
    }

    const entry: LogEntry = {
      businessId,
      sessionId,
      queryText: context?.queryText || 'Error occurred',
      status: 'ERROR',
      errorMessage: error.message,
      metadata: {
        type: 'error',
        errorName: error.name,
        errorStack: error.stack,
        ...context
      }
    };

    await this.logQuery(entry);
  }

  /**
   * Get query analytics for a business
   */
  async getQueryAnalytics(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<QueryAnalytics> {
    const whereClause: any = { businessId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const [
      totalQueries,
      successfulQueries,
      failedQueries,
      intentDistribution,
      errorDistribution,
      topQueries,
      averageMetrics
    ] = await Promise.all([
      this.prisma.queryLog.count({ where: whereClause }),
      this.prisma.queryLog.count({ 
        where: { ...whereClause, status: 'SUCCESS' } 
      }),
      this.prisma.queryLog.count({ 
        where: { ...whereClause, status: { not: 'SUCCESS' } } 
      }),
      this.getIntentDistribution(businessId, startDate, endDate),
      this.getErrorDistribution(businessId, startDate, endDate),
      this.getTopQueries(businessId, startDate, endDate),
      this.getAverageMetrics(businessId, startDate, endDate)
    ]);

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      averageProcessingTime: averageMetrics.processingTime,
      averageConfidence: averageMetrics.confidence,
      intentDistribution,
      errorDistribution,
      topQueries
    };
  }

  /**
   * Get session analytics for a business
   */
  async getSessionAnalytics(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<SessionAnalytics> {
    const whereClause: any = { businessId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const [
      totalSessions,
      activeSessions,
      sessionMetrics,
      completionMetrics
    ] = await Promise.all([
      this.prisma.conversation.count({ where: whereClause }),
      this.prisma.conversation.count({ 
        where: { ...whereClause, isActive: true } 
      }),
      this.getSessionMetrics(businessId, startDate, endDate),
      this.getCompletionMetrics(businessId, startDate, endDate)
    ]);

    return {
      totalSessions,
      activeSessions,
      averageSessionDuration: sessionMetrics.averageDuration,
      averageQueriesPerSession: sessionMetrics.averageQueries,
      sessionCompletionRate: completionMetrics.completionRate
    };
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(businessId: string): Promise<{
    queriesLastHour: number;
    activeSessions: number;
    averageResponseTime: number;
    errorRate: number;
    topIntents: Array<{ intent: QueryIntent; count: number }>;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [
      queriesLastHour,
      activeSessions,
      recentMetrics,
      recentIntents
    ] = await Promise.all([
      this.prisma.queryLog.count({
        where: {
          businessId,
          createdAt: { gte: oneHourAgo }
        }
      }),
      this.prisma.conversation.count({
        where: {
          businessId,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      }),
      this.getAverageMetrics(businessId, oneHourAgo),
      this.getIntentDistribution(businessId, oneHourAgo)
    ]);

    const topIntents = Object.entries(recentIntents)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([intent, count]) => ({ intent: intent as QueryIntent, count }));

    return {
      queriesLastHour,
      activeSessions,
      averageResponseTime: recentMetrics.processingTime,
      errorRate: recentMetrics.errorRate,
      topIntents
    };
  }

  /**
   * Search query logs with filters
   */
  async searchQueryLogs(query: AnalyticsQuery): Promise<{
    logs: QueryLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const whereClause: any = {};

    if (query.businessId) whereClause.businessId = query.businessId;
    if (query.intent) whereClause.intentDetected = query.intent;
    if (query.status) whereClause.status = query.status;
    
    if (query.startDate || query.endDate) {
      whereClause.createdAt = {};
      if (query.startDate) whereClause.createdAt.gte = query.startDate;
      if (query.endDate) whereClause.createdAt.lte = query.endDate;
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const [logs, total] = await Promise.all([
      this.prisma.queryLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.queryLog.count({ where: whereClause })
    ]);

    return {
      logs: logs.map(this.mapPrismaToLogEntry),
      total,
      hasMore: offset + logs.length < total
    };
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date(Date.now() - this.config.logRetentionDays * 24 * 60 * 60 * 1000);
    
    const result = await this.prisma.queryLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    return result.count;
  }

  /**
   * Flush buffered logs to database
   */
  async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.prisma.queryLog.createMany({
        data: logsToFlush.map(log => ({
          businessId: log.businessId,
          conversationId: log.conversationId,
          sessionId: log.sessionId,
          queryText: log.queryText,
          intentDetected: log.intentDetected,
          contextRetrieved: log.contextRetrieved,
          responseGenerated: log.responseGenerated,
          processingTimeMs: log.processingTimeMs,
          tokenUsage: log.tokenUsage,
          confidenceScore: log.confidenceScore,
          status: log.status,
          errorMessage: log.errorMessage,
          userAgent: log.userAgent,
          ipAddress: log.ipAddress,
          metadata: log.metadata
        }))
      });
    } catch (error) {
      console.error('Error flushing logs:', error);
      // Re-add logs to buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  /**
   * Get intent distribution
   */
  private async getIntentDistribution(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<QueryIntent, number>> {
    const whereClause: any = { businessId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const results = await this.prisma.queryLog.groupBy({
      by: ['intentDetected'],
      where: whereClause,
      _count: { intentDetected: true }
    });

    const distribution: Record<QueryIntent, number> = {
      MENU_INQUIRY: 0,
      HOURS_POLICY: 0,
      PRICING_QUESTION: 0,
      DIETARY_RESTRICTIONS: 0,
      LOCATION_INFO: 0,
      GENERAL_CHAT: 0,
      COMPLAINT_FEEDBACK: 0,
      UNKNOWN: 0
    };

    results.forEach(result => {
      if (result.intentDetected) {
        distribution[result.intentDetected] = result._count.intentDetected;
      }
    });

    return distribution;
  }

  /**
   * Get error distribution
   */
  private async getErrorDistribution(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    const whereClause: any = { 
      businessId,
      status: { not: 'SUCCESS' }
    };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const results = await this.prisma.queryLog.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { status: true }
    });

    const distribution: Record<string, number> = {};
    results.forEach(result => {
      distribution[result.status] = result._count.status;
    });

    return distribution;
  }

  /**
   * Get top queries
   */
  private async getTopQueries(
    businessId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 10
  ): Promise<Array<{ query: string; count: number; averageConfidence: number }>> {
    const whereClause: any = { businessId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    // This is a simplified version - in production you might want to use raw SQL
    const queries = await this.prisma.queryLog.findMany({
      where: whereClause,
      select: {
        queryText: true,
        confidenceScore: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 10 // Get more to group
    });

    // Group by query text
    const grouped = new Map<string, { count: number; totalConfidence: number }>();
    
    queries.forEach(query => {
      const key = query.queryText.toLowerCase().trim();
      const existing = grouped.get(key) || { count: 0, totalConfidence: 0 };
      grouped.set(key, {
        count: existing.count + 1,
        totalConfidence: existing.totalConfidence + (query.confidenceScore || 0)
      });
    });

    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, limit)
      .map(([query, data]) => ({
        query,
        count: data.count,
        averageConfidence: data.totalConfidence / data.count
      }));
  }

  /**
   * Get average metrics
   */
  private async getAverageMetrics(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    processingTime: number;
    confidence: number;
    errorRate: number;
  }> {
    const whereClause: any = { businessId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const [total, successful, metrics] = await Promise.all([
      this.prisma.queryLog.count({ where: whereClause }),
      this.prisma.queryLog.count({ 
        where: { ...whereClause, status: 'SUCCESS' } 
      }),
      this.prisma.queryLog.aggregate({
        where: whereClause,
        _avg: {
          processingTimeMs: true,
          confidenceScore: true
        }
      })
    ]);

    return {
      processingTime: metrics._avg.processingTimeMs || 0,
      confidence: metrics._avg.confidenceScore || 0,
      errorRate: total > 0 ? (total - successful) / total : 0
    };
  }

  /**
   * Get session metrics
   */
  private async getSessionMetrics(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    averageDuration: number;
    averageQueries: number;
  }> {
    const whereClause: any = { businessId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const sessions = await this.prisma.conversation.findMany({
      where: whereClause,
      include: {
        queryLogs: true
      }
    });

    if (sessions.length === 0) {
      return { averageDuration: 0, averageQueries: 0 };
    }

    const totalDuration = sessions.reduce((sum, session) => {
      const duration = session.lastActivityAt.getTime() - session.startedAt.getTime();
      return sum + duration;
    }, 0);

    const totalQueries = sessions.reduce((sum, session) => {
      return sum + session.queryLogs.length;
    }, 0);

    return {
      averageDuration: totalDuration / sessions.length / (1000 * 60), // Convert to minutes
      averageQueries: totalQueries / sessions.length
    };
  }

  /**
   * Get completion metrics
   */
  private async getCompletionMetrics(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    completionRate: number;
  }> {
    const whereClause: any = { businessId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const [total, completed] = await Promise.all([
      this.prisma.conversation.count({ where: whereClause }),
      this.prisma.conversation.count({ 
        where: { 
          ...whereClause, 
          isActive: false,
          queryLogs: {
            some: {
              status: 'SUCCESS'
            }
          }
        } 
      })
    ]);

    return {
      completionRate: total > 0 ? completed / total : 0
    };
  }

  /**
   * Map Prisma query log to log entry interface
   */
  private mapPrismaToLogEntry(log: PrismaQueryLog): QueryLogEntry {
    return {
      id: log.id,
      businessId: log.businessId,
      conversationId: log.conversationId || undefined,
      sessionId: log.sessionId || undefined,
      queryText: log.queryText,
      intentDetected: log.intentDetected || undefined,
      contextRetrieved: log.contextRetrieved as Record<string, any> || undefined,
      responseGenerated: log.responseGenerated || undefined,
      processingTimeMs: log.processingTimeMs || undefined,
      tokenUsage: log.tokenUsage || undefined,
      confidenceScore: log.confidenceScore || undefined,
      status: log.status,
      errorMessage: log.errorMessage || undefined,
      userAgent: log.userAgent || undefined,
      ipAddress: log.ipAddress || undefined,
      metadata: log.metadata as Record<string, any> || undefined,
      createdAt: log.createdAt
    };
  }

  /**
   * Start flush interval
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushLogs();
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop flush interval
   */
  stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.logRetentionDays < 1 || this.config.logRetentionDays > 365) {
      errors.push('logRetentionDays must be between 1 and 365');
    }

    if (this.config.batchLogSize < 1 || this.config.batchLogSize > 1000) {
      errors.push('batchLogSize must be between 1 and 1000');
    }

    if (this.config.flushIntervalMs < 1000 || this.config.flushIntervalMs > 60000) {
      errors.push('flushIntervalMs must be between 1000 and 60000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===== SINGLETON INSTANCE =====
let analyticsLoggerInstance: AnalyticsLogger | null = null;

export function getAnalyticsLogger(
  prisma?: PrismaClient, 
  config?: Partial<AnalyticsLoggerConfig>
): AnalyticsLogger {
  if (!analyticsLoggerInstance) {
    if (!prisma) {
      throw new Error('PrismaClient instance is required for first initialization');
    }
    analyticsLoggerInstance = new AnalyticsLogger(prisma, config);
  }
  return analyticsLoggerInstance;
}

