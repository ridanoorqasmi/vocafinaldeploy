import { PrismaClient } from '@prisma/client';
import { runRule } from '../lib/runRule';

const prisma = new PrismaClient();

/**
 * Background scheduler for autonomous rule execution
 */
export class RuleScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.start();
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('Rule scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting rule scheduler...');

    // Schedule the main interval to check for active rules every 3 hours
    // 3 hours = 3 * 60 * 60 * 1000 = 10,800,000 milliseconds
    this.intervalId = setInterval(async () => {
      await this.executeActiveRules();
    }, 10_800_000); // 3 hours

    console.log('Rule scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('Rule scheduler is not running');
      return;
    }

    console.log('Stopping rule scheduler...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    console.log('Rule scheduler stopped');
  }

  /**
   * Execute all active rules
   */
  private async executeActiveRules() {
    try {
      console.log('Executing active rules...');

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

      console.log(`Found ${activeRules.length} active rules`);

      // Execute each rule
      for (const rule of activeRules) {
        try {
          console.log(`Executing rule: ${rule.name} (${rule.id})`);
          
          const result = await runRule(rule.id, false);
          
          console.log(`Rule ${rule.name} completed:`, {
            matched: result.matched,
            sent: result.sent,
            failed: result.failed
          });

          // Log any errors
          if (result.errors && result.errors.length > 0) {
            console.error(`Rule ${rule.name} had errors:`, result.errors);
          }

        } catch (error) {
          console.error(`Error executing rule ${rule.name}:`, error);
        }

        // Small delay between rules to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('Finished executing active rules');

    } catch (error) {
      console.error('Error in executeActiveRules:', error);
    }
  }

  /**
   * Execute a specific rule immediately
   */
  async executeRule(ruleId: string): Promise<void> {
    try {
      console.log(`Manually executing rule: ${ruleId}`);
      
      const result = await runRule(ruleId, false);
      
      console.log(`Manual rule execution completed:`, {
        matched: result.matched,
        sent: result.sent,
        failed: result.failed
      });

    } catch (error) {
      console.error(`Error in manual rule execution:`, error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null
    };
  }

  /**
   * Update rule schedule (if rule has custom cron)
   */
  async updateRuleSchedule(ruleId: string, scheduleCron: string) {
    try {
      const rule = await prisma.rule.findUnique({
        where: { id: ruleId }
      });

      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      // If rule has a custom schedule, we could create individual cron jobs
      // For now, we'll just update the database and let the main scheduler handle it
      await prisma.rule.update({
        where: { id: ruleId },
        data: { scheduleCron }
      });

      console.log(`Updated schedule for rule ${ruleId}: ${scheduleCron}`);

    } catch (error) {
      console.error(`Error updating rule schedule:`, error);
      throw error;
    }
  }
}

// Singleton instance
let ruleScheduler: RuleScheduler | null = null;

/**
 * Get the rule scheduler instance
 */
export function getRuleScheduler(): RuleScheduler {
  if (!ruleScheduler) {
    ruleScheduler = new RuleScheduler();
  }
  return ruleScheduler;
}

/**
 * Initialize the rule scheduler
 */
export function initializeRuleScheduler() {
  const scheduler = getRuleScheduler();
  console.log('Rule scheduler initialized');
  return scheduler;
}

/**
 * Graceful shutdown
 */
export function shutdownRuleScheduler() {
  if (ruleScheduler) {
    ruleScheduler.stop();
    ruleScheduler = null;
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down rule scheduler...');
  shutdownRuleScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down rule scheduler...');
  shutdownRuleScheduler();
  process.exit(0);
});
