import { PrismaClient } from '@prisma/client';
import { runRule } from './runRule';

const prisma = new PrismaClient();

/**
 * Feature-flagged scheduler for autonomous rule execution
 * Sprint 3: Singleton pattern with environment-based activation
 */
export class FollowupScheduler {
  private static instance: FollowupScheduler | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isInitialized: boolean = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FollowupScheduler {
    if (!FollowupScheduler.instance) {
      FollowupScheduler.instance = new FollowupScheduler();
    }
    return FollowupScheduler.instance;
  }

  /**
   * Initialize scheduler (singleton guard)
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('FollowupScheduler already initialized');
      return;
    }

    this.isInitialized = true;
    console.log('FollowupScheduler initialized');

    // Start scheduler if enabled
    if (this.isEnabled()) {
      this.start();
    } else {
      console.log('FollowupScheduler disabled via ENABLE_FOLLOWUP_CRON environment variable');
    }
  }

  /**
   * Check if scheduler is enabled via environment variable
   */
  private isEnabled(): boolean {
    return process.env.ENABLE_FOLLOWUP_CRON === 'true';
  }

  /**
   * Get cron expression from environment or use default
   */
  private getCronExpression(): string {
    return process.env.FOLLOWUP_CRON_EXPRESSION || '0 */3 * * *'; // Default: every 3 hours
  }

  /**
   * Parse cron expression to milliseconds
   */
  private cronToMilliseconds(cronExpression: string): number {
    // Simple cron parser for common patterns
    const parts = cronExpression.split(' ');
    
    if (parts.length >= 5) {
      const minute = parts[0];
      const hour = parts[1];
      
      // Handle "0 */3 * * *" pattern (every 3 hours)
      if (minute === '0' && hour.startsWith('*/')) {
        const intervalHours = parseInt(hour.substring(2));
        return intervalHours * 60 * 60 * 1000; // Convert to milliseconds
      }
      
      // Handle "*/1 * * * *" pattern (every minute for testing)
      if (minute.startsWith('*/') && hour === '*') {
        const intervalMinutes = parseInt(minute.substring(2));
        return intervalMinutes * 60 * 1000; // Convert to milliseconds
      }
    }
    
    // Default fallback: 3 hours
    return 3 * 60 * 60 * 1000;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('FollowupScheduler is already running');
      return;
    }

    if (!this.isEnabled()) {
      console.log('FollowupScheduler is disabled via environment variable');
      return;
    }

    const cronExpression = this.getCronExpression();
    const intervalMs = this.cronToMilliseconds(cronExpression);

    console.log(`Starting FollowupScheduler with expression: ${cronExpression} (${intervalMs}ms)`);

    this.isRunning = true;
    this.intervalId = setInterval(async () => {
      await this.executeAllActiveRules();
    }, intervalMs);

    console.log('FollowupScheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('FollowupScheduler is not running');
      return;
    }

    console.log('Stopping FollowupScheduler...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('FollowupScheduler stopped');
  }

  /**
   * Execute all active rules once
   */
  async executeAllActiveRules(): Promise<{
    ran: number;
    ruleIds: string[];
    results: Array<{ ruleId: string; matched: number; sent: number; failed: number }>;
  }> {
    const startTime = Date.now();
    console.log('FollowupScheduler: Starting execution of all active rules...');

    try {
      // Get all active rules
      const activeRules = await prisma.rule.findMany({
        where: { active: true },
        include: {
          mapping: {
            include: {
              connection: true
            }
          }
        }
      });

      console.log(`FollowupScheduler: Found ${activeRules.length} active rules`);

      const results: Array<{ ruleId: string; matched: number; sent: number; failed: number }> = [];
      const ruleIds: string[] = [];

      // Execute each rule
      for (const rule of activeRules) {
        try {
          console.log(`FollowupScheduler: Executing rule ${rule.name} (${rule.id})`);
          
          const result = await runRule(rule.id, false);
          
          if ('matched' in result) {
            results.push({
              ruleId: rule.id,
              matched: result.matched,
              sent: result.sent,
              failed: result.failed
            });
          }
          
          ruleIds.push(rule.id);

          console.log(`FollowupScheduler: Rule ${rule.name} completed:`, {
            matched: 'matched' in result ? result.matched : 0,
            sent: 'sent' in result ? result.sent : 0,
            failed: 'failed' in result ? result.failed : 0
          });

        } catch (error) {
          console.error(`FollowupScheduler: Error executing rule ${rule.name}:`, error);
          results.push({
            ruleId: rule.id,
            matched: 0,
            sent: 0,
            failed: 1
          });
          ruleIds.push(rule.id);
        }

        // Small delay between rules to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const duration = Date.now() - startTime;
      console.log(`FollowupScheduler: Execution completed in ${duration}ms. Rules executed: ${ruleIds.length}`);

      return {
        ran: ruleIds.length,
        ruleIds,
        results
      };

    } catch (error) {
      console.error('FollowupScheduler: Error in executeAllActiveRules:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isInitialized: boolean;
    isRunning: boolean;
    isEnabled: boolean;
    cronExpression: string;
    intervalMs: number;
  } {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      isEnabled: this.isEnabled(),
      cronExpression: this.getCronExpression(),
      intervalMs: this.cronToMilliseconds(this.getCronExpression())
    };
  }

  /**
   * Manual trigger - run all active rules once
   */
  async manualTrigger(): Promise<{
    ran: number;
    ruleIds: string[];
    results: Array<{ ruleId: string; matched: number; sent: number; failed: number }>;
  }> {
    console.log('FollowupScheduler: Manual trigger requested');
    return this.executeAllActiveRules();
  }
}

/**
 * Initialize the scheduler (call this once at application startup)
 */
export function initializeFollowupScheduler(): FollowupScheduler {
  const scheduler = FollowupScheduler.getInstance();
  scheduler.initialize();
  return scheduler;
}

/**
 * Get scheduler instance
 */
export function getFollowupScheduler(): FollowupScheduler {
  return FollowupScheduler.getInstance();
}

/**
 * Graceful shutdown
 */
export function shutdownFollowupScheduler(): void {
  const scheduler = FollowupScheduler.getInstance();
  scheduler.stop();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down FollowupScheduler...');
  shutdownFollowupScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down FollowupScheduler...');
  shutdownFollowupScheduler();
  process.exit(0);
});

