// ===== BATCH PROCESSING SERVICE =====

import { PrismaClient } from '@prisma/client';
import { QueryProcessor } from './query-processor';
import {
  BatchJob,
  BatchJobType,
  BatchInput,
  BatchResult,
  BatchProcessingOptions,
  BatchJobSummary
} from './business-rules-types';

export class BatchProcessingService {
  private prisma: PrismaClient;
  private queryProcessor: QueryProcessor;
  private activeJobs: Map<string, BatchJob> = new Map();
  private jobQueue: BatchJob[] = [];
  private maxConcurrentJobs: number = 10;
  private isProcessing: boolean = false;

  constructor(prisma: PrismaClient, queryProcessor: QueryProcessor) {
    this.prisma = prisma;
    this.queryProcessor = queryProcessor;
  }

  /**
   * Create a new batch job
   */
  async createBatchJob(
    businessId: string,
    jobType: BatchJobType,
    inputData: BatchInput[],
    options: BatchProcessingOptions
  ): Promise<BatchJob> {
    const job: BatchJob = {
      job_id: this.generateJobId(),
      business_id: businessId,
      job_type: jobType,
      input_data: inputData,
      processing_status: 'pending',
      progress: {
        total_items: inputData.length,
        processed_items: 0,
        failed_items: 0,
        estimated_completion: new Date(Date.now() + this.estimateProcessingTime(inputData.length, options))
      },
      results: [],
      created_at: new Date(),
      processing_options: options
    };

    // Save job to database
    await this.saveBatchJob(job);
    
    // Add to queue
    this.jobQueue.push(job);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startJobProcessor();
    }

    return job;
  }

  /**
   * Get batch job status
   */
  async getBatchJobStatus(jobId: string): Promise<BatchJob | null> {
    // Check active jobs first
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return activeJob;
    }

    // Check queue
    const queuedJob = this.jobQueue.find(job => job.job_id === jobId);
    if (queuedJob) {
      return queuedJob;
    }

    // Fetch from database
    return await this.fetchBatchJobFromDatabase(jobId);
  }

  /**
   * Cancel a batch job
   */
  async cancelBatchJob(jobId: string): Promise<boolean> {
    const job = await this.getBatchJobStatus(jobId);
    if (!job) {
      return false;
    }

    if (job.processing_status === 'processing') {
      // Mark for cancellation
      job.processing_status = 'cancelled';
      this.activeJobs.delete(jobId);
    } else if (job.processing_status === 'pending') {
      // Remove from queue
      const index = this.jobQueue.findIndex(j => j.job_id === jobId);
      if (index !== -1) {
        this.jobQueue.splice(index, 1);
      }
      job.processing_status = 'cancelled';
    }

    // Update in database
    await this.saveBatchJob(job);
    
    return true;
  }

  /**
   * Get batch job summary
   */
  async getBatchJobSummary(jobId: string): Promise<BatchJobSummary | null> {
    const job = await this.getBatchJobStatus(jobId);
    if (!job || job.processing_status !== 'completed') {
      return null;
    }

    const results = job.results;
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    return {
      total_tokens_used: results.reduce((sum, r) => sum + (r.tokens_used || 0), 0),
      total_cost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
      average_response_time: results.reduce((sum, r) => sum + r.processing_time_ms, 0) / results.length,
      success_rate: successfulResults.length / results.length,
      total_processing_time_ms: job.completed_at ? job.completed_at.getTime() - job.started_at!.getTime() : 0,
      cost_per_query: results.length > 0 ? results.reduce((sum, r) => sum + (r.cost || 0), 0) / results.length : 0
    };
  }

  /**
   * Start the job processor
   */
  private async startJobProcessor(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    while (this.jobQueue.length > 0 && this.activeJobs.size < this.maxConcurrentJobs) {
      const job = this.jobQueue.shift();
      if (job) {
        this.processBatchJob(job);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a batch job
   */
  private async processBatchJob(job: BatchJob): Promise<void> {
    try {
      // Mark job as processing
      job.processing_status = 'processing';
      job.started_at = new Date();
      this.activeJobs.set(job.job_id, job);
      
      // Update in database
      await this.saveBatchJob(job);

      // Process based on job type
      switch (job.job_type) {
        case 'bulk_queries':
          await this.processBulkQueries(job);
          break;
        case 'content_analysis':
          await this.processContentAnalysis(job);
          break;
        case 'conversation_export':
          await this.processConversationExport(job);
          break;
        case 'knowledge_base_update':
          await this.processKnowledgeBaseUpdate(job);
          break;
        case 'performance_testing':
          await this.processPerformanceTesting(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.job_type}`);
      }

      // Mark job as completed
      job.processing_status = 'completed';
      job.completed_at = new Date();
      
    } catch (error) {
      // Mark job as failed
      job.processing_status = 'failed';
      job.error_details = error instanceof Error ? error.message : 'Unknown error';
      job.completed_at = new Date();
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(job.job_id);
      
      // Update in database
      await this.saveBatchJob(job);
      
      // Continue processing queue
      if (this.jobQueue.length > 0) {
        this.startJobProcessor();
      }
    }
  }

  /**
   * Process bulk queries
   */
  private async processBulkQueries(job: BatchJob): Promise<void> {
    const { parallel_processing, max_concurrent_workers = 5 } = job.processing_options;
    
    if (parallel_processing) {
      await this.processBulkQueriesParallel(job, max_concurrent_workers);
    } else {
      await this.processBulkQueriesSequential(job);
    }
  }

  /**
   * Process bulk queries in parallel
   */
  private async processBulkQueriesParallel(job: BatchJob, maxWorkers: number): Promise<void> {
    const chunks = this.chunkArray(job.input_data, maxWorkers);
    
    for (const chunk of chunks) {
      const promises = chunk.map(input => this.processSingleQuery(job, input));
      await Promise.all(promises);
    }
  }

  /**
   * Process bulk queries sequentially
   */
  private async processBulkQueriesSequential(job: BatchJob): Promise<void> {
    for (const input of job.input_data) {
      await this.processSingleQuery(job, input);
    }
  }

  /**
   * Process a single query
   */
  private async processSingleQuery(job: BatchJob, input: BatchInput): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Extract query data
      const queryData = input.data;
      const queryText = queryData.query_text || queryData.query;
      const sessionId = queryData.session_id || `batch_${job.job_id}_${input.input_id}`;
      
      if (!queryText) {
        throw new Error('Query text is required');
      }

      // Process the query
      const result = await this.queryProcessor.processQuery(job.business_id, {
        query: queryText,
        sessionId: sessionId,
        preferences: queryData.preferences
      });

      // Create batch result
      const batchResult: BatchResult = {
        input_id: input.input_id,
        success: true,
        result: result,
        processing_time_ms: Date.now() - startTime,
        tokens_used: result.usage?.tokensUsed || 0,
        cost: result.usage?.costEstimate || 0
      };

      job.results.push(batchResult);
      job.progress.processed_items++;
      
    } catch (error) {
      // Create failed result
      const batchResult: BatchResult = {
        input_id: input.input_id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: Date.now() - startTime
      };

      job.results.push(batchResult);
      job.progress.failed_items++;
    }

    // Update progress
    job.progress.estimated_completion = new Date(
      Date.now() + this.estimateRemainingTime(job)
    );
  }

  /**
   * Process content analysis
   */
  private async processContentAnalysis(job: BatchJob): Promise<void> {
    // Implementation for content analysis batch processing
    for (const input of job.input_data) {
      const startTime = Date.now();
      
      try {
        // Analyze content (placeholder implementation)
        const analysisResult = {
          sentiment: 'positive',
          topics: ['customer service', 'product inquiry'],
          intent: 'information_request',
          confidence: 0.85
        };

        const batchResult: BatchResult = {
          input_id: input.input_id,
          success: true,
          result: analysisResult,
          processing_time_ms: Date.now() - startTime
        };

        job.results.push(batchResult);
        job.progress.processed_items++;
        
      } catch (error) {
        const batchResult: BatchResult = {
          input_id: input.input_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processing_time_ms: Date.now() - startTime
        };

        job.results.push(batchResult);
        job.progress.failed_items++;
      }
    }
  }

  /**
   * Process conversation export
   */
  private async processConversationExport(job: BatchJob): Promise<void> {
    // Implementation for conversation export batch processing
    for (const input of job.input_data) {
      const startTime = Date.now();
      
      try {
        // Export conversation data (placeholder implementation)
        const exportResult = {
          conversation_id: input.data.conversation_id,
          exported_at: new Date(),
          format: 'json',
          size_bytes: 1024
        };

        const batchResult: BatchResult = {
          input_id: input.input_id,
          success: true,
          result: exportResult,
          processing_time_ms: Date.now() - startTime
        };

        job.results.push(batchResult);
        job.progress.processed_items++;
        
      } catch (error) {
        const batchResult: BatchResult = {
          input_id: input.input_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processing_time_ms: Date.now() - startTime
        };

        job.results.push(batchResult);
        job.progress.failed_items++;
      }
    }
  }

  /**
   * Process knowledge base update
   */
  private async processKnowledgeBaseUpdate(job: BatchJob): Promise<void> {
    // Implementation for knowledge base update batch processing
    for (const input of job.input_data) {
      const startTime = Date.now();
      
      try {
        // Update knowledge base (placeholder implementation)
        const updateResult = {
          document_id: input.data.document_id,
          updated_at: new Date(),
          embeddings_generated: true,
          status: 'success'
        };

        const batchResult: BatchResult = {
          input_id: input.input_id,
          success: true,
          result: updateResult,
          processing_time_ms: Date.now() - startTime
        };

        job.results.push(batchResult);
        job.progress.processed_items++;
        
      } catch (error) {
        const batchResult: BatchResult = {
          input_id: input.input_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processing_time_ms: Date.now() - startTime
        };

        job.results.push(batchResult);
        job.progress.failed_items++;
      }
    }
  }

  /**
   * Process performance testing
   */
  private async processPerformanceTesting(job: BatchJob): Promise<void> {
    // Implementation for performance testing batch processing
    for (const input of job.input_data) {
      const startTime = Date.now();
      
      try {
        // Run performance test (placeholder implementation)
        const testResult = {
          test_id: input.data.test_id,
          response_time_ms: Date.now() - startTime,
          throughput: 100,
          error_rate: 0.01,
          status: 'passed'
        };

        const batchResult: BatchResult = {
          input_id: input.input_id,
          success: true,
          result: testResult,
          processing_time_ms: Date.now() - startTime
        };

        job.results.push(batchResult);
        job.progress.processed_items++;
        
      } catch (error) {
        const batchResult: BatchResult = {
          input_id: input.input_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processing_time_ms: Date.now() - startTime
        };

        job.results.push(batchResult);
        job.progress.failed_items++;
      }
    }
  }

  /**
   * Estimate processing time for a batch job
   */
  private estimateProcessingTime(itemCount: number, options: BatchProcessingOptions): number {
    const baseTimePerItem = 2000; // 2 seconds per item
    const parallelMultiplier = options.parallel_processing ? 0.3 : 1.0;
    const priorityMultiplier = options.priority === 'high' ? 0.5 : options.priority === 'low' ? 2.0 : 1.0;
    
    return itemCount * baseTimePerItem * parallelMultiplier * priorityMultiplier;
  }

  /**
   * Estimate remaining processing time
   */
  private estimateRemainingTime(job: BatchJob): number {
    const remainingItems = job.progress.total_items - job.progress.processed_items - job.progress.failed_items;
    const avgTimePerItem = job.results.length > 0 
      ? job.results.reduce((sum, r) => sum + r.processing_time_ms, 0) / job.results.length
      : 2000;
    
    return remainingItems * avgTimePerItem;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save batch job to database (placeholder)
   */
  private async saveBatchJob(job: BatchJob): Promise<void> {
    // In a real implementation, this would use Prisma to save to database
    console.log('Saving batch job:', job.job_id, 'Status:', job.processing_status);
  }

  /**
   * Fetch batch job from database (placeholder)
   */
  private async fetchBatchJobFromDatabase(jobId: string): Promise<BatchJob | null> {
    // In a real implementation, this would use Prisma to fetch from database
    return null;
  }
}

// Singleton instance
let batchProcessingService: BatchProcessingService | null = null;

export function getBatchProcessingService(prisma?: PrismaClient, queryProcessor?: QueryProcessor): BatchProcessingService {
  if (!batchProcessingService) {
    if (!prisma || !queryProcessor) {
      throw new Error('PrismaClient and QueryProcessor are required for first initialization');
    }
    batchProcessingService = new BatchProcessingService(prisma, queryProcessor);
  }
  return batchProcessingService;
}
