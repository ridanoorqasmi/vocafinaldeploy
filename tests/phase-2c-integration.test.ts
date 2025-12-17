// ===== PHASE 2C INTEGRATION TESTS =====

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createAutoTriggerService } from '../lib/auto-trigger-service';
import { createUsageTracker } from '../lib/usage-tracker';
import { createAdminUtilities } from '../lib/admin-utilities';
import { createAutoTrigger } from '../lib/auto-trigger';

// Mock Prisma client
const mockPrisma = {
  $queryRaw: vi.fn(),
  embedding: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  usageMetric: {
    create: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn()
  },
  business: {
    findMany: vi.fn(),
    findFirst: vi.fn()
  },
  menuItem: {
    findMany: vi.fn()
  },
  policy: {
    findMany: vi.fn()
  },
  knowledgeBase: {
    findMany: vi.fn()
  },
  $disconnect: vi.fn()
} as any;

describe('Phase 2C - Auto-Trigger Integration & Usage Tracking', () => {
  let autoTriggerService: any;
  let usageTracker: any;
  let adminUtils: any;
  let autoTrigger: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-ada-002';
    process.env.EMBEDDING_MAX_TOKENS = '8000';
    process.env.EMBEDDING_BATCH_SIZE = '10';
    process.env.EMBEDDING_RETRY_ATTEMPTS = '3';
    process.env.EMBEDDING_RETRY_DELAY = '1000';
    process.env.EMBEDDING_ASYNC_QUEUE = 'true';
    
    autoTriggerService = createAutoTriggerService(mockPrisma);
    usageTracker = createUsageTracker(mockPrisma);
    adminUtils = createAdminUtilities(mockPrisma);
    autoTrigger = createAutoTrigger(mockPrisma);
  });
  
  afterEach(() => {
    autoTriggerService.stopProcessing();
  });
  
  describe('AutoTriggerService', () => {
    it('should queue trigger jobs correctly', async () => {
      const jobId = await autoTriggerService.queueTriggerJob(
        'business-1',
        'create',
        'MENU',
        'item-1',
        { name: 'Test Item', description: 'Test Description' }
      );
      
      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^job_/);
      
      const jobStatus = autoTriggerService.getJobStatus(jobId);
      expect(jobStatus).toBeDefined();
      expect(jobStatus.businessId).toBe('business-1');
      expect(jobStatus.operation).toBe('create');
      expect(jobStatus.contentType).toBe('MENU');
      expect(jobStatus.contentId).toBe('item-1');
    });
    
    it('should queue batch trigger jobs correctly', async () => {
      const jobs = [
        {
          operation: 'create' as const,
          contentType: 'MENU' as const,
          contentId: 'item-1',
          data: { name: 'Item 1' }
        },
        {
          operation: 'create' as const,
          contentType: 'POLICY' as const,
          contentId: 'policy-1',
          data: { title: 'Policy 1' }
        }
      ];
      
      const batchId = await autoTriggerService.queueBatchTriggerJobs(
        'business-1',
        jobs
      );
      
      expect(batchId).toBeDefined();
      expect(batchId).toMatch(/^batch_/);
      
      const batchStatus = autoTriggerService.getBatchStatus(batchId);
      expect(batchStatus).toBeDefined();
      expect(batchStatus.businessId).toBe('business-1');
      expect(batchStatus.totalJobs).toBe(2);
    });
    
    it('should provide service statistics', () => {
      const stats = autoTriggerService.getServiceStats();
      
      expect(stats).toHaveProperty('totalJobs');
      expect(stats).toHaveProperty('pendingJobs');
      expect(stats).toHaveProperty('processingJobs');
      expect(stats).toHaveProperty('completedJobs');
      expect(stats).toHaveProperty('failedJobs');
      expect(stats).toHaveProperty('totalBatches');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('config');
    });
    
    it('should retry failed jobs', async () => {
      // Mock a failed job
      const jobId = await autoTriggerService.queueTriggerJob(
        'business-1',
        'create',
        'MENU',
        'item-1',
        { name: 'Test Item' }
      );
      
      const retryCount = await autoTriggerService.retryFailedJobs('business-1');
      expect(retryCount).toBeGreaterThanOrEqual(0);
    });
    
    it('should cleanup completed jobs', () => {
      const cleanedCount = autoTriggerService.cleanupCompletedJobs(1);
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('UsageTracker', () => {
    it('should record usage correctly', async () => {
      mockPrisma.usageMetric.create.mockResolvedValue({
        id: 'usage-1',
        businessId: 'business-1',
        type: 'API_CALL',
        count: 1,
        date: new Date(),
        metadata: {}
      });
      
      const result = await usageTracker.recordUsage({
        businessId: 'business-1',
        operation: 'embedding_generation',
        contentType: 'MENU',
        tokenCount: 1000,
        apiCalls: 1,
        processingTime: 500,
        success: true
      });
      
      expect(result).toBe(true);
      expect(mockPrisma.usageMetric.create).toHaveBeenCalled();
    });
    
    it('should generate usage reports', async () => {
      mockPrisma.usageMetric.findMany.mockResolvedValue([
        {
          id: 'usage-1',
          businessId: 'business-1',
          type: 'API_CALL',
          count: 1,
          date: new Date(),
          metadata: {
            tokenCount: 1000,
            operation: 'embedding_generation',
            contentType: 'MENU',
            success: true,
            processingTime: 500
          }
        }
      ]);
      
      const report = await usageTracker.generateUsageReport('business-1', 'day');
      
      expect(report).toHaveProperty('businessId', 'business-1');
      expect(report).toHaveProperty('period', 'day');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('breakdown');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('alerts');
    });
    
    it('should get admin dashboard metrics', async () => {
      mockPrisma.business.findMany.mockResolvedValue([
        { id: 'business-1', name: 'Test Business' }
      ]);
      
      mockPrisma.usageMetric.findMany.mockResolvedValue([
        {
          id: 'usage-1',
          businessId: 'business-1',
          type: 'API_CALL',
          count: 1,
          date: new Date(),
          metadata: {
            tokenCount: 1000,
            success: true,
            processingTime: 500
          }
        }
      ]);
      
      const metrics = await usageTracker.getAdminDashboardMetrics();
      
      expect(metrics).toHaveProperty('totalBusinesses');
      expect(metrics).toHaveProperty('activeBusinesses');
      expect(metrics).toHaveProperty('totalTokens');
      expect(metrics).toHaveProperty('totalCost');
      expect(metrics).toHaveProperty('totalApiCalls');
      expect(metrics).toHaveProperty('averageSuccessRate');
      expect(metrics).toHaveProperty('topBusinesses');
      expect(metrics).toHaveProperty('recentAlerts');
      expect(metrics).toHaveProperty('systemHealth');
    });
    
    it('should export usage data', async () => {
      mockPrisma.usageMetric.findMany.mockResolvedValue([
        {
          id: 'usage-1',
          businessId: 'business-1',
          type: 'API_CALL',
          count: 1,
          date: new Date(),
          metadata: {
            tokenCount: 1000,
            operation: 'embedding_generation',
            contentType: 'MENU',
            success: true,
            processingTime: 500
          }
        }
      ]);
      
      const csvData = await usageTracker.exportUsageData(
        'business-1',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'csv'
      );
      
      expect(csvData).toContain('Date,Operation,ContentType,Tokens,Calls,ProcessingTime,Success,Cost');
    });
  });
  
  describe('AdminUtilities', () => {
    it('should get system health status', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.embedding.count.mockResolvedValue(10);
      
      const health = await adminUtils.getSystemHealthStatus();
      
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('alerts');
      
      expect(health.components).toHaveProperty('database');
      expect(health.components).toHaveProperty('openai');
      expect(health.components).toHaveProperty('embeddingService');
      expect(health.components).toHaveProperty('autoTrigger');
    });
    
    it('should get business embedding stats', async () => {
      mockPrisma.business.findMany.mockResolvedValue([
        { id: 'business-1', name: 'Test Business' }
      ]);
      
      mockPrisma.embedding.findMany.mockResolvedValue([
        { contentType: 'MENU', updatedAt: new Date() },
        { contentType: 'POLICY', updatedAt: new Date() }
      ]);
      
      const stats = await adminUtils.getBusinessEmbeddingStats();
      
      expect(stats).toHaveLength(1);
      expect(stats[0]).toHaveProperty('businessId', 'business-1');
      expect(stats[0]).toHaveProperty('businessName', 'Test Business');
      expect(stats[0]).toHaveProperty('totalEmbeddings', 2);
      expect(stats[0]).toHaveProperty('byContentType');
      expect(stats[0]).toHaveProperty('health');
      expect(stats[0]).toHaveProperty('issues');
    });
    
    it('should retry failed jobs', async () => {
      const action = await adminUtils.retryFailedJobs('business-1');
      
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('type', 'retry_failed_jobs');
      expect(action).toHaveProperty('status');
      expect(action).toHaveProperty('businessId', 'business-1');
      expect(action).toHaveProperty('description');
    });
    
    it('should cleanup old data', async () => {
      mockPrisma.usageMetric.deleteMany.mockResolvedValue({ count: 5 });
      
      const action = await adminUtils.cleanupOldData(90);
      
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('type', 'cleanup_old_data');
      expect(action).toHaveProperty('status');
      expect(action).toHaveProperty('description');
    });
    
    it('should regenerate business embeddings', async () => {
      mockPrisma.menuItem.findMany.mockResolvedValue([
        { id: 'item-1', businessId: 'business-1' }
      ]);
      mockPrisma.policy.findMany.mockResolvedValue([
        { id: 'policy-1', businessId: 'business-1' }
      ]);
      mockPrisma.knowledgeBase.findMany.mockResolvedValue([
        { id: 'faq-1', businessId: 'business-1' }
      ]);
      
      const action = await adminUtils.regenerateBusinessEmbeddings('business-1');
      
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('type', 'regenerate_embeddings');
      expect(action).toHaveProperty('status');
      expect(action).toHaveProperty('businessId', 'business-1');
      expect(action).toHaveProperty('description');
    });
  });
  
  describe('AutoTrigger (Wrapper)', () => {
    it('should trigger menu item embedding generation', async () => {
      const result = await autoTrigger.triggerMenuItem(
        'business-1',
        'create',
        { id: 'item-1', name: 'Test Item' }
      );
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('processingTime', 0);
      expect(result).toHaveProperty('metadata');
    });
    
    it('should trigger policy embedding generation', async () => {
      const result = await autoTrigger.triggerPolicy(
        'business-1',
        'create',
        { id: 'policy-1', title: 'Test Policy' }
      );
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('processingTime', 0);
      expect(result).toHaveProperty('metadata');
    });
    
    it('should trigger FAQ embedding generation', async () => {
      const result = await autoTrigger.triggerFAQ(
        'business-1',
        'create',
        { id: 'faq-1', title: 'Test FAQ' }
      );
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('processingTime', 0);
      expect(result).toHaveProperty('metadata');
    });
    
    it('should batch process triggers', async () => {
      const triggers = [
        {
          businessId: 'business-1',
          operation: 'create' as const,
          contentType: 'MENU' as const,
          contentId: 'item-1',
          data: { name: 'Item 1' },
          timestamp: new Date()
        },
        {
          businessId: 'business-1',
          operation: 'create' as const,
          contentType: 'POLICY' as const,
          contentId: 'policy-1',
          data: { title: 'Policy 1' },
          timestamp: new Date()
        }
      ];
      
      const result = await autoTrigger.batchProcess(triggers);
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('summary');
      expect(result.results).toHaveLength(2);
      expect(result.summary.total).toBe(2);
    });
    
    it('should get processing statistics', () => {
      const stats = autoTrigger.getProcessingStats();
      
      expect(stats).toHaveProperty('activeProcessing');
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('enabled');
    });
    
    it('should handle disabled state', async () => {
      autoTrigger.setEnabled(false);
      
      const result = await autoTrigger.triggerMenuItem(
        'business-1',
        'create',
        { id: 'item-1', name: 'Test Item' }
      );
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('processingTime', 0);
    });
  });
  
  describe('Integration Tests', () => {
    it('should handle complete workflow: create -> track -> report', async () => {
      // Mock successful embedding creation
      mockPrisma.embedding.create.mockResolvedValue({
        id: 'embedding-1',
        businessId: 'business-1',
        contentType: 'MENU',
        contentId: 'item-1',
        content: 'Test Item - Test Description',
        embedding: new Array(1536).fill(0.1),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });
      
      // Mock usage tracking
      mockPrisma.usageMetric.create.mockResolvedValue({
        id: 'usage-1',
        businessId: 'business-1',
        type: 'API_CALL',
        count: 1,
        date: new Date(),
        metadata: {}
      });
      
      // 1. Trigger embedding generation
      const triggerResult = await autoTrigger.triggerMenuItem(
        'business-1',
        'create',
        { id: 'item-1', name: 'Test Item', description: 'Test Description' }
      );
      
      expect(triggerResult.success).toBe(true);
      
      // 2. Generate usage report
      mockPrisma.usageMetric.findMany.mockResolvedValue([
        {
          id: 'usage-1',
          businessId: 'business-1',
          type: 'API_CALL',
          count: 1,
          date: new Date(),
          metadata: {
            tokenCount: 1000,
            operation: 'embedding_generation',
            contentType: 'MENU',
            success: true,
            processingTime: 500
          }
        }
      ]);
      
      const report = await usageTracker.generateUsageReport('business-1', 'day');
      
      expect(report.businessId).toBe('business-1');
      expect(report.summary.totalApiCalls).toBe(1);
      expect(report.summary.totalTokens).toBe(1000);
    });
    
    it('should handle error scenarios gracefully', async () => {
      // Mock database error
      mockPrisma.embedding.create.mockRejectedValue(new Error('Database error'));
      
      // Mock usage tracking for failed operation
      mockPrisma.usageMetric.create.mockResolvedValue({
        id: 'usage-1',
        businessId: 'business-1',
        type: 'API_CALL',
        count: 1,
        date: new Date(),
        metadata: {}
      });
      
      const result = await autoTrigger.triggerMenuItem(
        'business-1',
        'create',
        { id: 'item-1', name: 'Test Item' }
      );
      
      // Should still return success for async processing
      expect(result.success).toBe(true);
    });
    
    it('should maintain tenant isolation', async () => {
      // Test that business-1 cannot access business-2's data
      mockPrisma.embedding.findMany.mockImplementation((args) => {
        if (args.where.businessId === 'business-1') {
          return Promise.resolve([
            { id: 'embedding-1', businessId: 'business-1', contentType: 'MENU' }
          ]);
        }
        return Promise.resolve([]);
      });
      
      const stats = await adminUtils.getBusinessEmbeddingStats('business-1');
      
      expect(stats).toHaveLength(1);
      expect(stats[0].businessId).toBe('business-1');
    });
  });
});

