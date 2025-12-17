// ===== ADMIN UTILITIES FOR EMBEDDING SERVICE MONITORING =====

import { PrismaClient } from '@prisma/client';
import { AutoTriggerService, createAutoTriggerService } from './auto-trigger-service';
import { UsageTracker, createUsageTracker, UsageReport, AdminDashboardMetrics } from './usage-tracker';
import { EmbeddingManager, createEmbeddingManager } from './embedding-manager';

// Admin utilities interfaces
export interface SystemHealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    database: 'healthy' | 'warning' | 'critical';
    openai: 'healthy' | 'warning' | 'critical';
    embeddingService: 'healthy' | 'warning' | 'critical';
    autoTrigger: 'healthy' | 'warning' | 'critical';
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    queueSize: number;
    processingRate: number;
    successRate: number;
  };
  alerts: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
  }>;
}

export interface BusinessEmbeddingStats {
  businessId: string;
  businessName: string;
  totalEmbeddings: number;
  byContentType: {
    MENU: number;
    POLICY: number;
    FAQ: number;
    BUSINESS: number;
  };
  lastUpdated: Date;
  health: 'healthy' | 'warning' | 'critical';
  issues: string[];
}

export interface EmbeddingMaintenanceTask {
  id: string;
  type: 'cleanup' | 'reindex' | 'migration' | 'backup';
  status: 'pending' | 'running' | 'completed' | 'failed';
  businessId?: string;
  description: string;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AdminAction {
  id: string;
  type: 'retry_failed_jobs' | 'cleanup_old_data' | 'regenerate_embeddings' | 'export_data' | 'system_health_check';
  status: 'pending' | 'running' | 'completed' | 'failed';
  businessId?: string;
  description: string;
  parameters?: Record<string, any>;
  result?: any;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// Admin utilities service
export class AdminUtilities {
  private prisma: PrismaClient;
  private autoTriggerService: AutoTriggerService;
  private usageTracker: UsageTracker;
  private embeddingManager: EmbeddingManager;
  private maintenanceTasks = new Map<string, EmbeddingMaintenanceTask>();
  private adminActions = new Map<string, AdminAction>();
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.autoTriggerService = createAutoTriggerService(prisma);
    this.usageTracker = createUsageTracker(prisma);
    this.embeddingManager = createEmbeddingManager(prisma);
  }
  
  /**
   * Get comprehensive system health status
   */
  async getSystemHealthStatus(): Promise<SystemHealthStatus> {
    try {
      const components = {
        database: 'healthy' as const,
        openai: 'healthy' as const,
        embeddingService: 'healthy' as const,
        autoTrigger: 'healthy' as const
      };
      
      const alerts: Array<{
        type: string;
        message: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        timestamp: Date;
      }> = [];
      
      // Check database health
      try {
        await this.prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        components.database = 'critical';
        alerts.push({
          type: 'database_connection',
          message: 'Database connection failed',
          severity: 'critical',
          timestamp: new Date()
        });
      }
      
      // Check OpenAI health (simplified)
      try {
        // This would be a more comprehensive check in production
        const hasApiKey = !!process.env.OPENAI_API_KEY;
        if (!hasApiKey) {
          components.openai = 'critical';
          alerts.push({
            type: 'openai_config',
            message: 'OpenAI API key not configured',
            severity: 'critical',
            timestamp: new Date()
          });
        }
      } catch (error) {
        components.openai = 'warning';
        alerts.push({
          type: 'openai_health',
          message: 'OpenAI service health check failed',
          severity: 'warning',
          timestamp: new Date()
        });
      }
      
      // Check embedding service health
      try {
        const embeddingCount = await this.prisma.embedding.count();
        if (embeddingCount === 0) {
          components.embeddingService = 'warning';
          alerts.push({
            type: 'no_embeddings',
            message: 'No embeddings found in database',
            severity: 'warning',
            timestamp: new Date()
          });
        }
      } catch (error) {
        components.embeddingService = 'critical';
        alerts.push({
          type: 'embedding_service',
          message: 'Embedding service health check failed',
          severity: 'critical',
          timestamp: new Date()
        });
      }
      
      // Check auto-trigger service health
      try {
        const stats = this.autoTriggerService.getServiceStats();
        if (stats.failedJobs > stats.completedJobs * 0.1) { // More than 10% failure rate
          components.autoTrigger = 'warning';
          alerts.push({
            type: 'high_failure_rate',
            message: `High failure rate in auto-trigger service: ${stats.failedJobs} failed jobs`,
            severity: 'warning',
            timestamp: new Date()
          });
        }
        
        if (stats.pendingJobs > 100) { // More than 100 pending jobs
          components.autoTrigger = 'warning';
          alerts.push({
            type: 'queue_backlog',
            message: `Large queue backlog: ${stats.pendingJobs} pending jobs`,
            severity: 'warning',
            timestamp: new Date()
          });
        }
      } catch (error) {
        components.autoTrigger = 'critical';
        alerts.push({
          type: 'auto_trigger_service',
          message: 'Auto-trigger service health check failed',
          severity: 'critical',
          timestamp: new Date()
        });
      }
      
      // Calculate overall health
      const criticalCount = Object.values(components).filter(c => c === 'critical').length;
      const warningCount = Object.values(components).filter(c => c === 'warning').length;
      
      let overall: 'healthy' | 'warning' | 'critical';
      if (criticalCount > 0) {
        overall = 'critical';
      } else if (warningCount > 0) {
        overall = 'warning';
      } else {
        overall = 'healthy';
      }
      
      // Get metrics
      const metrics = await this.getSystemMetrics();
      
      return {
        overall,
        components,
        metrics,
        alerts
      };
      
    } catch (error) {
      console.error('Failed to get system health status:', error);
      return {
        overall: 'critical',
        components: {
          database: 'critical',
          openai: 'critical',
          embeddingService: 'critical',
          autoTrigger: 'critical'
        },
        metrics: {
          responseTime: 0,
          errorRate: 1,
          queueSize: 0,
          processingRate: 0,
          successRate: 0
        },
        alerts: [{
          type: 'system_error',
          message: 'Failed to get system health status',
          severity: 'critical',
          timestamp: new Date()
        }]
      };
    }
  }
  
  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<{
    responseTime: number;
    errorRate: number;
    queueSize: number;
    processingRate: number;
    successRate: number;
  }> {
    try {
      const stats = this.autoTriggerService.getServiceStats();
      const adminMetrics = await this.usageTracker.getAdminDashboardMetrics();
      
      return {
        responseTime: adminMetrics.systemHealth.averageResponseTime,
        errorRate: adminMetrics.systemHealth.errorRate,
        queueSize: stats.pendingJobs,
        processingRate: adminMetrics.systemHealth.processingRate,
        successRate: adminMetrics.averageSuccessRate
      };
    } catch (error) {
      console.error('Failed to get system metrics:', error);
      return {
        responseTime: 0,
        errorRate: 0,
        queueSize: 0,
        processingRate: 0,
        successRate: 0
      };
    }
  }
  
  /**
   * Get business embedding statistics
   */
  async getBusinessEmbeddingStats(businessId?: string): Promise<BusinessEmbeddingStats[]> {
    try {
      const where = businessId ? { businessId } : {};
      
      const businesses = await this.prisma.business.findMany({
        where: businessId ? { id: businessId } : {},
        select: { id: true, name: true }
      });
      
      const stats: BusinessEmbeddingStats[] = [];
      
      for (const business of businesses) {
        const embeddings = await this.prisma.embedding.findMany({
          where: { businessId: business.id },
          select: { contentType: true, updatedAt: true }
        });
        
        const byContentType = {
          MENU: 0,
          POLICY: 0,
          FAQ: 0,
          BUSINESS: 0
        };
        
        let lastUpdated = new Date(0);
        const issues: string[] = [];
        
        embeddings.forEach(embedding => {
          byContentType[embedding.contentType as keyof typeof byContentType]++;
          if (embedding.updatedAt > lastUpdated) {
            lastUpdated = embedding.updatedAt;
          }
        });
        
        // Check for issues
        const totalEmbeddings = Object.values(byContentType).reduce((sum, count) => sum + count, 0);
        if (totalEmbeddings === 0) {
          issues.push('No embeddings found');
        }
        
        const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 7) {
          issues.push('Embeddings not updated in over 7 days');
        }
        
        let health: 'healthy' | 'warning' | 'critical';
        if (issues.length === 0) {
          health = 'healthy';
        } else if (issues.some(issue => issue.includes('No embeddings'))) {
          health = 'critical';
        } else {
          health = 'warning';
        }
        
        stats.push({
          businessId: business.id,
          businessName: business.name,
          totalEmbeddings,
          byContentType,
          lastUpdated,
          health,
          issues
        });
      }
      
      return stats;
      
    } catch (error) {
      console.error('Failed to get business embedding stats:', error);
      return [];
    }
  }
  
  /**
   * Generate usage report for a business
   */
  async generateBusinessUsageReport(
    businessId: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<UsageReport> {
    return this.usageTracker.generateUsageReport(businessId, period);
  }
  
  /**
   * Get admin dashboard metrics
   */
  async getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
    return this.usageTracker.getAdminDashboardMetrics();
  }
  
  /**
   * Retry failed embedding jobs
   */
  async retryFailedJobs(businessId?: string): Promise<AdminAction> {
    const actionId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const action: AdminAction = {
      id: actionId,
      type: 'retry_failed_jobs',
      status: 'running',
      businessId,
      description: `Retrying failed embedding jobs${businessId ? ` for business ${businessId}` : ' for all businesses'}`,
      startedAt: new Date()
    };
    
    this.adminActions.set(actionId, action);
    
    try {
      const retryCount = await this.autoTriggerService.retryFailedJobs(businessId);
      
      action.status = 'completed';
      action.completedAt = new Date();
      action.result = { retryCount };
      
      console.log(`Retried ${retryCount} failed jobs${businessId ? ` for business ${businessId}` : ''}`);
      
    } catch (error) {
      action.status = 'failed';
      action.completedAt = new Date();
      action.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Failed to retry failed jobs:', error);
    }
    
    return action;
  }
  
  /**
   * Clean up old data
   */
  async cleanupOldData(olderThanDays: number = 90): Promise<AdminAction> {
    const actionId = `cleanup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const action: AdminAction = {
      id: actionId,
      type: 'cleanup_old_data',
      status: 'running',
      description: `Cleaning up data older than ${olderThanDays} days`,
      parameters: { olderThanDays },
      startedAt: new Date()
    };
    
    this.adminActions.set(actionId, action);
    
    try {
      const cleanedCount = await this.usageTracker.cleanupOldData(olderThanDays);
      
      action.status = 'completed';
      action.completedAt = new Date();
      action.result = { cleanedCount };
      
      console.log(`Cleaned up ${cleanedCount} old usage records`);
      
    } catch (error) {
      action.status = 'failed';
      action.completedAt = new Date();
      action.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Failed to cleanup old data:', error);
    }
    
    return action;
  }
  
  /**
   * Regenerate embeddings for a business
   */
  async regenerateBusinessEmbeddings(businessId: string): Promise<AdminAction> {
    const actionId = `regenerate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const action: AdminAction = {
      id: actionId,
      type: 'regenerate_embeddings',
      status: 'running',
      businessId,
      description: `Regenerating all embeddings for business ${businessId}`,
      startedAt: new Date()
    };
    
    this.adminActions.set(actionId, action);
    
    try {
      // Get all content for the business
      const menuItems = await this.prisma.menuItem.findMany({
        where: { businessId, deletedAt: null }
      });
      
      const policies = await this.prisma.policy.findMany({
        where: { businessId, deletedAt: null }
      });
      
      const faqs = await this.prisma.knowledgeBase.findMany({
        where: { businessId, deletedAt: null }
      });
      
      // Queue regeneration jobs
      const jobs = [
        ...menuItems.map(item => ({
          operation: 'update' as const,
          contentType: 'MENU' as const,
          contentId: item.id,
          data: item
        })),
        ...policies.map(policy => ({
          operation: 'update' as const,
          contentType: 'POLICY' as const,
          contentId: policy.id,
          data: policy
        })),
        ...faqs.map(faq => ({
          operation: 'update' as const,
          contentType: 'FAQ' as const,
          contentId: faq.id,
          data: faq
        }))
      ];
      
      const batchId = await this.autoTriggerService.queueBatchTriggerJobs(businessId, jobs);
      
      action.status = 'completed';
      action.completedAt = new Date();
      action.result = { 
        batchId, 
        totalItems: jobs.length,
        menuItems: menuItems.length,
        policies: policies.length,
        faqs: faqs.length
      };
      
      console.log(`Queued regeneration of ${jobs.length} embeddings for business ${businessId}`);
      
    } catch (error) {
      action.status = 'failed';
      action.completedAt = new Date();
      action.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Failed to regenerate business embeddings:', error);
    }
    
    return action;
  }
  
  /**
   * Export embedding data
   */
  async exportEmbeddingData(
    businessId: string,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'json'
  ): Promise<AdminAction> {
    const actionId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const action: AdminAction = {
      id: actionId,
      type: 'export_data',
      status: 'running',
      businessId,
      description: `Exporting embedding data for business ${businessId}`,
      parameters: { startDate, endDate, format },
      startedAt: new Date()
    };
    
    this.adminActions.set(actionId, action);
    
    try {
      const data = await this.usageTracker.exportUsageData(businessId, startDate, endDate, format);
      
      action.status = 'completed';
      action.completedAt = new Date();
      action.result = { 
        dataSize: data.length,
        format,
        recordCount: format === 'csv' ? data.split('\n').length - 1 : JSON.parse(data).length
      };
      
      console.log(`Exported embedding data for business ${businessId}`);
      
    } catch (error) {
      action.status = 'failed';
      action.completedAt = new Date();
      action.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Failed to export embedding data:', error);
    }
    
    return action;
  }
  
  /**
   * Get admin action status
   */
  getAdminActionStatus(actionId: string): AdminAction | null {
    return this.adminActions.get(actionId) || null;
  }
  
  /**
   * Get all admin actions
   */
  getAllAdminActions(): AdminAction[] {
    return Array.from(this.adminActions.values()).sort((a, b) => 
      (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0)
    );
  }
  
  /**
   * Get maintenance tasks
   */
  getMaintenanceTasks(): EmbeddingMaintenanceTask[] {
    return Array.from(this.maintenanceTasks.values()).sort((a, b) => 
      (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0)
    );
  }
  
  /**
   * Create a maintenance task
   */
  createMaintenanceTask(
    type: EmbeddingMaintenanceTask['type'],
    description: string,
    businessId?: string,
    metadata?: Record<string, any>
  ): EmbeddingMaintenanceTask {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: EmbeddingMaintenanceTask = {
      id: taskId,
      type,
      status: 'pending',
      businessId,
      description,
      progress: 0,
      metadata
    };
    
    this.maintenanceTasks.set(taskId, task);
    
    // Execute task asynchronously
    this.executeMaintenanceTask(task);
    
    return task;
  }
  
  /**
   * Execute a maintenance task
   */
  private async executeMaintenanceTask(task: EmbeddingMaintenanceTask): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date();
    
    try {
      switch (task.type) {
        case 'cleanup':
          task.progress = 50;
          const cleanedCount = await this.usageTracker.cleanupOldData(90);
          task.progress = 100;
          task.status = 'completed';
          task.completedAt = new Date();
          task.metadata = { ...task.metadata, cleanedCount };
          break;
          
        case 'reindex':
          if (task.businessId) {
            task.progress = 25;
            await this.regenerateBusinessEmbeddings(task.businessId);
            task.progress = 100;
            task.status = 'completed';
            task.completedAt = new Date();
          } else {
            throw new Error('Business ID required for reindex task');
          }
          break;
          
        case 'backup':
          task.progress = 50;
          // Backup logic would go here
          task.progress = 100;
          task.status = 'completed';
          task.completedAt = new Date();
          break;
          
        default:
          throw new Error(`Unknown maintenance task type: ${task.type}`);
      }
      
    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`Maintenance task ${task.id} failed:`, error);
    }
  }
}

// Export singleton factory
export function createAdminUtilities(prisma: PrismaClient): AdminUtilities {
  return new AdminUtilities(prisma);
}

