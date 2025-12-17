// ===== AUTO-TRIGGER SYSTEM FOR EMBEDDING GENERATION =====

import { PrismaClient } from '@prisma/client';
import { AutoTriggerService, createAutoTriggerService } from './auto-trigger-service';
import { EmbeddingType } from './embedding-types';

// Auto-trigger interfaces
export interface TriggerContext {
  businessId: string;
  operation: 'create' | 'update' | 'delete';
  contentType: EmbeddingType;
  contentId: string;
  data?: any;
  userId?: string;
  timestamp: Date;
}

export interface TriggerResult {
  success: boolean;
  embeddingId?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  processingTime: number;
}

export interface BatchTriggerResult {
  success: boolean;
  results: TriggerResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalProcessingTime: number;
  };
}

// Auto-trigger service (wrapper around AutoTriggerService)
export class AutoTrigger {
  private autoTriggerService: AutoTriggerService;
  private isEnabled = true;
  
  constructor(prisma: PrismaClient) {
    this.autoTriggerService = createAutoTriggerService(prisma);
  }
  
  /**
   * Enable/disable auto-trigger
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
  
  /**
   * Check if auto-trigger is enabled
   */
  isAutoTriggerEnabled(): boolean {
    return this.isEnabled;
  }
  
  /**
   * Trigger embedding generation for menu item
   */
  async triggerMenuItem(
    businessId: string,
    operation: 'create' | 'update' | 'delete',
    menuItem: any
  ): Promise<TriggerResult> {
    if (!this.isEnabled) {
      return {
        success: true,
        processingTime: 0
      };
    }
    
    const jobId = await this.autoTriggerService.queueTriggerJob(
      businessId,
      operation,
      'MENU',
      menuItem.id,
      menuItem
    );
    
    // For immediate response, return success (actual processing happens async)
    return {
      success: true,
      processingTime: 0,
      metadata: { jobId }
    };
  }
  
  /**
   * Trigger embedding generation for policy
   */
  async triggerPolicy(
    businessId: string,
    operation: 'create' | 'update' | 'delete',
    policy: any
  ): Promise<TriggerResult> {
    if (!this.isEnabled) {
      return {
        success: true,
        processingTime: 0
      };
    }
    
    const jobId = await this.autoTriggerService.queueTriggerJob(
      businessId,
      operation,
      'POLICY',
      policy.id,
      policy
    );
    
    return {
      success: true,
      processingTime: 0,
      metadata: { jobId }
    };
  }
  
  /**
   * Trigger embedding generation for FAQ
   */
  async triggerFAQ(
    businessId: string,
    operation: 'create' | 'update' | 'delete',
    faq: any
  ): Promise<TriggerResult> {
    if (!this.isEnabled) {
      return {
        success: true,
        processingTime: 0
      };
    }
    
    const jobId = await this.autoTriggerService.queueTriggerJob(
      businessId,
      operation,
      'FAQ',
      faq.id,
      faq
    );
    
    return {
      success: true,
      processingTime: 0,
      metadata: { jobId }
    };
  }
  
  /**
   * Trigger embedding generation for business
   */
  async triggerBusiness(
    businessId: string,
    operation: 'create' | 'update' | 'delete',
    business: any
  ): Promise<TriggerResult> {
    if (!this.isEnabled) {
      return {
        success: true,
        processingTime: 0
      };
    }
    
    const jobId = await this.autoTriggerService.queueTriggerJob(
      businessId,
      operation,
      'BUSINESS',
      business.id,
      business
    );
    
    return {
      success: true,
      processingTime: 0,
      metadata: { jobId }
    };
  }
  
  /**
   * Batch process multiple triggers
   */
  async batchProcess(triggers: TriggerContext[]): Promise<BatchTriggerResult> {
    if (!this.isEnabled) {
      return {
        success: true,
        results: triggers.map(() => ({ success: true, processingTime: 0 })),
        summary: {
          total: triggers.length,
          successful: triggers.length,
          failed: 0,
          totalProcessingTime: 0
        }
      };
    }
    
    const jobs = triggers.map(trigger => ({
      operation: trigger.operation,
      contentType: trigger.contentType,
      contentId: trigger.contentId,
      data: trigger.data
    }));
    
    const batchId = await this.autoTriggerService.queueBatchTriggerJobs(
      triggers[0]?.businessId || '',
      jobs
    );
    
    return {
      success: true,
      results: triggers.map(() => ({ 
        success: true, 
        processingTime: 0,
        metadata: { batchId }
      })),
      summary: {
        total: triggers.length,
        successful: triggers.length,
        failed: 0,
        totalProcessingTime: 0
      }
    };
  }
  
  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    activeProcessing: number;
    queueSize: number;
    enabled: boolean;
  } {
    const stats = this.autoTriggerService.getServiceStats();
    return {
      activeProcessing: stats.processingJobs,
      queueSize: stats.pendingJobs,
      enabled: this.isEnabled
    };
  }
  
  /**
   * Get job status
   */
  getJobStatus(jobId: string) {
    return this.autoTriggerService.getJobStatus(jobId);
  }
  
  /**
   * Get batch status
   */
  getBatchStatus(batchId: string) {
    return this.autoTriggerService.getBatchStatus(batchId);
  }
  
  /**
   * Retry failed jobs
   */
  async retryFailedJobs(businessId?: string): Promise<number> {
    return this.autoTriggerService.retryFailedJobs(businessId);
  }
  
  /**
   * Clean up completed jobs
   */
  cleanupCompletedJobs(olderThanHours: number = 24): number {
    return this.autoTriggerService.cleanupCompletedJobs(olderThanHours);
  }
  
  /**
   * Stop the auto-trigger service
   */
  stop(): void {
    this.autoTriggerService.stopProcessing();
  }
}

// Export singleton factory
export function createAutoTrigger(prisma: PrismaClient): AutoTrigger {
  return new AutoTrigger(prisma);
}
