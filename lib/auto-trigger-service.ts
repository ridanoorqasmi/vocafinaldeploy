// ===== AUTO-TRIGGER SERVICE - ASYNC EMBEDDING GENERATION =====

import { PrismaClient } from '@prisma/client';
import { EmbeddingManager, createEmbeddingManager } from './embedding-manager';
import { UsageTracker, createUsageTracker } from './usage-tracker';
import { EmbeddingType } from './embedding-types';
import { MenuItemData, PolicyData, FAQData, BusinessData } from './content-processor';

// Auto-trigger service interfaces
export interface TriggerJob {
  id: string;
  businessId: string;
  operation: 'create' | 'update' | 'delete';
  contentType: EmbeddingType;
  contentId: string;
  data?: any;
  userId?: string;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  error?: string;
  metadata?: Record<string, any>;
}

export interface BatchTriggerJob {
  id: string;
  businessId: string;
  jobs: TriggerJob[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  createdAt: Date;
  completedAt?: Date;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export interface TriggerServiceConfig {
  maxConcurrentJobs: number;
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
  queueCheckInterval: number;
  enableAsyncProcessing: boolean;
}

// Auto-trigger service
export class AutoTriggerService {
  private embeddingManager: EmbeddingManager;
  private usageTracker: UsageTracker;
  private jobQueue: Map<string, TriggerJob> = new Map();
  private batchQueue: Map<string, BatchTriggerJob> = new Map();
  private processingJobs: Set<string> = new Set();
  private isProcessing: boolean = false;
  private config: TriggerServiceConfig;
  private processingInterval?: NodeJS.Timeout;
  
  constructor(prisma: PrismaClient, config?: Partial<TriggerServiceConfig>) {
    this.embeddingManager = createEmbeddingManager(prisma);
    this.usageTracker = createUsageTracker(prisma);
    
    this.config = {
      maxConcurrentJobs: parseInt(process.env.EMBEDDING_MAX_CONCURRENT_JOBS || '5'),
      retryAttempts: parseInt(process.env.EMBEDDING_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.EMBEDDING_RETRY_DELAY || '2000'),
      batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '10'),
      queueCheckInterval: parseInt(process.env.EMBEDDING_QUEUE_CHECK_INTERVAL || '1000'),
      enableAsyncProcessing: process.env.EMBEDDING_ASYNC_QUEUE === 'redis' || true,
      ...config
    };
    
    if (this.config.enableAsyncProcessing) {
      this.startProcessing();
    }
  }
  
  /**
   * Start the background processing loop
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.queueCheckInterval);
    
    console.log('AutoTriggerService: Background processing started');
  }
  
  /**
   * Stop the background processing loop
   */
  public stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isProcessing = false;
    console.log('AutoTriggerService: Background processing stopped');
  }
  
  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingJobs.size >= this.config.maxConcurrentJobs) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Process individual jobs
      const pendingJobs = Array.from(this.jobQueue.values())
        .filter(job => job.status === 'pending' || job.status === 'retrying')
        .slice(0, this.config.maxConcurrentJobs - this.processingJobs.size);
      
      for (const job of pendingJobs) {
        if (this.processingJobs.size >= this.config.maxConcurrentJobs) {
          break;
        }
        
        this.processJob(job);
      }
      
      // Process batch jobs
      const pendingBatches = Array.from(this.batchQueue.values())
        .filter(batch => batch.status === 'pending')
        .slice(0, 1); // Process one batch at a time
      
      for (const batch of pendingBatches) {
        this.processBatchJob(batch);
      }
      
    } catch (error) {
      console.error('AutoTriggerService: Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process a single trigger job
   */
  private async processJob(job: TriggerJob): Promise<void> {
    this.processingJobs.add(job.id);
    job.status = 'processing';
    
    try {
      const startTime = Date.now();
      
      // Process based on operation
      let result;
      switch (job.operation) {
        case 'create':
        case 'update':
          result = await this.handleCreateOrUpdate(job);
          break;
        case 'delete':
          result = await this.handleDelete(job);
          break;
        default:
          throw new Error(`Invalid operation: ${job.operation}`);
      }
      
      const processingTime = Date.now() - startTime;
      
      if (result.success) {
        job.status = 'completed';
        
        // Record usage
        await this.usageTracker.recordUsage({
          businessId: job.businessId,
          operation: 'embedding_generation',
          contentType: job.contentType,
          tokenCount: result.embedding ? result.embedding.embedding.length * 4 : 0,
          apiCalls: 1,
          processingTime,
          success: true,
          metadata: {
            jobId: job.id,
            operation: job.operation,
            contentId: job.contentId
          }
        });
        
        console.log(`AutoTriggerService: Job ${job.id} completed successfully`);
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
      
    } catch (error) {
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.retryCount++;
      
      if (job.retryCount < job.maxRetries) {
        job.status = 'retrying';
        console.log(`AutoTriggerService: Job ${job.id} failed, retrying (${job.retryCount}/${job.maxRetries})`);
        
        // Schedule retry with exponential backoff
        setTimeout(() => {
          this.processJob(job);
        }, this.config.retryDelay * Math.pow(2, job.retryCount - 1));
      } else {
        job.status = 'failed';
        console.error(`AutoTriggerService: Job ${job.id} failed permanently after ${job.retryCount} attempts`);
        
        // Record failed usage
        await this.usageTracker.recordUsage({
          businessId: job.businessId,
          operation: 'embedding_generation',
          contentType: job.contentType,
          tokenCount: 0,
          apiCalls: 1,
          processingTime: 0,
          success: false,
          errorCode: 'JOB_FAILED',
          metadata: {
            jobId: job.id,
            operation: job.operation,
            contentId: job.contentId,
            retryCount: job.retryCount,
            error: job.error
          }
        });
      }
    } finally {
      this.processingJobs.delete(job.id);
    }
  }
  
  /**
   * Process a batch trigger job
   */
  private async processBatchJob(batch: BatchTriggerJob): Promise<void> {
    batch.status = 'processing';
    
    try {
      const startTime = Date.now();
      
      // Process jobs in the batch
      const results = await Promise.allSettled(
        batch.jobs.map(job => this.processJob(job))
      );
      
      const processingTime = Date.now() - startTime;
      
      // Count results
      let completed = 0;
      let failed = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          completed++;
        } else {
          failed++;
          batch.jobs[index].status = 'failed';
          batch.jobs[index].error = result.reason?.message || 'Unknown error';
        }
      });
      
      batch.completedJobs = completed;
      batch.failedJobs = failed;
      batch.completedAt = new Date();
      
      if (failed === 0) {
        batch.status = 'completed';
      } else if (completed === 0) {
        batch.status = 'failed';
      } else {
        batch.status = 'partial';
      }
      
      // Record batch usage
      await this.usageTracker.recordUsage({
        businessId: batch.businessId,
        operation: 'batch_processing',
        tokenCount: completed * 1000, // Rough estimate
        apiCalls: batch.totalJobs,
        processingTime,
        success: failed === 0,
        metadata: {
          batchId: batch.id,
          totalJobs: batch.totalJobs,
          completedJobs: completed,
          failedJobs: failed
        }
      });
      
      console.log(`AutoTriggerService: Batch ${batch.id} completed: ${completed}/${batch.totalJobs} successful`);
      
    } catch (error) {
      batch.status = 'failed';
      console.error(`AutoTriggerService: Batch ${batch.id} failed:`, error);
    }
  }
  
  /**
   * Handle create or update operations
   */
  private async handleCreateOrUpdate(job: TriggerJob): Promise<any> {
    const data = this.prepareDataForEmbedding(job.contentType, job.data);
    
    if (!data) {
      throw new Error('Invalid data for embedding generation');
    }
    
    return await this.embeddingManager.createOrUpdateEmbedding({
      businessId: job.businessId,
      contentType: job.contentType,
      contentId: job.contentId,
      data,
      forceRegenerate: job.operation === 'update'
    });
  }
  
  /**
   * Handle delete operations
   */
  private async handleDelete(job: TriggerJob): Promise<any> {
    return await this.embeddingManager.deleteEmbedding(
      job.businessId,
      job.contentType,
      job.contentId
    );
  }
  
  /**
   * Prepare data for embedding generation
   */
  private prepareDataForEmbedding(
    contentType: EmbeddingType,
    data: any
  ): MenuItemData | PolicyData | FAQData | BusinessData | null {
    try {
      switch (contentType) {
        case 'MENU':
          return {
            name: data.name || '',
            description: data.description,
            category: data.category?.name || data.category,
            price: data.price ? parseFloat(data.price) : undefined,
            allergens: data.allergens || [],
            calories: data.calories ? parseInt(data.calories) : undefined,
            prepTime: data.prepTime ? parseInt(data.prepTime) : undefined
          } as MenuItemData;
          
        case 'POLICY':
          return {
            title: data.title || '',
            content: data.content || '',
            type: data.type || '',
            effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined
          } as PolicyData;
          
        case 'FAQ':
          return {
            question: data.title || data.question || '',
            answer: data.content || data.answer || '',
            category: data.category,
            tags: data.tags || []
          } as FAQData;
          
        case 'BUSINESS':
          return {
            name: data.name || '',
            description: data.description,
            cuisineType: data.cuisineType,
            location: data.locations?.[0]?.address || data.location,
            industry: data.industry
          } as BusinessData;
          
        default:
          return null;
      }
    } catch (error) {
      console.error('Failed to prepare data for embedding:', error);
      return null;
    }
  }
  
  /**
   * Queue a single trigger job
   */
  public async queueTriggerJob(
    businessId: string,
    operation: 'create' | 'update' | 'delete',
    contentType: EmbeddingType,
    contentId: string,
    data?: any,
    userId?: string
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: TriggerJob = {
      id: jobId,
      businessId,
      operation,
      contentType,
      contentId,
      data,
      userId,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.retryAttempts,
      status: 'pending',
      metadata: {
        queuedAt: new Date().toISOString()
      }
    };
    
    this.jobQueue.set(jobId, job);
    
    // Process immediately if async processing is disabled
    if (!this.config.enableAsyncProcessing) {
      this.processJob(job);
    }
    
    return jobId;
  }
  
  /**
   * Queue a batch of trigger jobs
   */
  public async queueBatchTriggerJobs(
    businessId: string,
    jobs: Array<{
      operation: 'create' | 'update' | 'delete';
      contentType: EmbeddingType;
      contentId: string;
      data?: any;
    }>,
    userId?: string
  ): Promise<string> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const triggerJobs: TriggerJob[] = jobs.map((job, index) => ({
      id: `${batchId}_${index}`,
      businessId,
      operation: job.operation,
      contentType: job.contentType,
      contentId: job.contentId,
      data: job.data,
      userId,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.retryAttempts,
      status: 'pending',
      metadata: {
        batchId,
        batchIndex: index
      }
    }));
    
    const batch: BatchTriggerJob = {
      id: batchId,
      businessId,
      jobs: triggerJobs,
      status: 'pending',
      createdAt: new Date(),
      totalJobs: jobs.length,
      completedJobs: 0,
      failedJobs: 0
    };
    
    // Add individual jobs to queue
    triggerJobs.forEach(job => {
      this.jobQueue.set(job.id, job);
    });
    
    // Add batch to batch queue
    this.batchQueue.set(batchId, batch);
    
    return batchId;
  }
  
  /**
   * Get job status
   */
  public getJobStatus(jobId: string): TriggerJob | null {
    return this.jobQueue.get(jobId) || null;
  }
  
  /**
   * Get batch status
   */
  public getBatchStatus(batchId: string): BatchTriggerJob | null {
    return this.batchQueue.get(batchId) || null;
  }
  
  /**
   * Get service statistics
   */
  public getServiceStats(): {
    totalJobs: number;
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalBatches: number;
    pendingBatches: number;
    processingBatches: number;
    completedBatches: number;
    failedBatches: number;
    isProcessing: boolean;
    config: TriggerServiceConfig;
  } {
    const jobs = Array.from(this.jobQueue.values());
    const batches = Array.from(this.batchQueue.values());
    
    return {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(j => j.status === 'pending' || j.status === 'retrying').length,
      processingJobs: jobs.filter(j => j.status === 'processing').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      totalBatches: batches.length,
      pendingBatches: batches.filter(b => b.status === 'pending').length,
      processingBatches: batches.filter(b => b.status === 'processing').length,
      completedBatches: batches.filter(b => b.status === 'completed').length,
      failedBatches: batches.filter(b => b.status === 'failed').length,
      isProcessing: this.isProcessing,
      config: this.config
    };
  }
  
  /**
   * Clean up completed jobs (older than specified hours)
   */
  public cleanupCompletedJobs(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    // Clean up individual jobs
    for (const [jobId, job] of this.jobQueue.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && job.timestamp < cutoffTime) {
        this.jobQueue.delete(jobId);
        cleanedCount++;
      }
    }
    
    // Clean up batch jobs
    for (const [batchId, batch] of this.batchQueue.entries()) {
      if ((batch.status === 'completed' || batch.status === 'failed') && batch.createdAt < cutoffTime) {
        this.batchQueue.delete(batchId);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }
  
  /**
   * Retry failed jobs
   */
  public async retryFailedJobs(businessId?: string): Promise<number> {
    let retryCount = 0;
    
    for (const [jobId, job] of this.jobQueue.entries()) {
      if (job.status === 'failed' && (!businessId || job.businessId === businessId)) {
        job.status = 'pending';
        job.retryCount = 0;
        job.error = undefined;
        retryCount++;
      }
    }
    
    return retryCount;
  }
}

// Export singleton factory
export function createAutoTriggerService(prisma: PrismaClient, config?: Partial<TriggerServiceConfig>): AutoTriggerService {
  return new AutoTriggerService(prisma, config);
}

