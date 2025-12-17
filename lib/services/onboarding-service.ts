import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const OnboardingStepSchema = z.object({
  stepKey: z.string(),
  stepName: z.string(),
  stepDescription: z.string().optional(),
  requiredForActivation: z.boolean().default(false),
  orderIndex: z.number(),
  estimatedDurationMinutes: z.number().default(5),
  successCriteria: z.record(z.any()).default({}),
  nudgeConfig: z.record(z.any()).default({})
});

const OnboardingProgressSchema = z.object({
  businessId: z.string().uuid(),
  currentStep: z.string(),
  completionPercentage: z.number().min(0).max(100).default(0),
  stepsCompleted: z.array(z.string()).default([]),
  activationEvents: z.record(z.any()).default({})
});

const NudgeSchema = z.object({
  businessId: z.string().uuid(),
  nudgeType: z.enum(['tooltip', 'banner', 'email', 'in_app']),
  nudgeContent: z.object({
    title: z.string(),
    message: z.string(),
    cta: z.string().optional()
  }),
  targetStep: z.string(),
  triggerCondition: z.record(z.any()).default({})
});

export class OnboardingService {
  /**
   * Initialize onboarding progress for a new business
   */
  async initializeOnboarding(businessId: string): Promise<any> {
    try {
      const onboardingProgress = await prisma.onboardingProgress.upsert({
        where: { businessId },
        update: {},
        create: {
          businessId,
          currentStep: 'welcome',
          completionPercentage: 0,
          stepsCompleted: [],
          activationEvents: {}
        }
      });

      // Create initial welcome nudge
      await this.createNudge({
        businessId,
        nudgeType: 'tooltip',
        nudgeContent: {
          title: 'Welcome to VOCA!',
          message: 'Let\'s get you started with your AI chatbot setup.',
          cta: 'Get Started'
        },
        targetStep: 'welcome',
        triggerCondition: { delayHours: 0 }
      });

      return onboardingProgress;
    } catch (error) {
      console.error('Error initializing onboarding:', error);
      throw new Error('Failed to initialize onboarding');
    }
  }

  /**
   * Update onboarding progress when a step is completed
   */
  async updateOnboardingProgress(
    businessId: string, 
    stepKey: string, 
    activationEvents: Record<string, any> = {}
  ): Promise<any> {
    try {
      const currentProgress = await prisma.onboardingProgress.findUnique({
        where: { businessId }
      });

      if (!currentProgress) {
        throw new Error('Onboarding progress not found');
      }

      const step = await prisma.onboardingStep.findUnique({
        where: { stepKey }
      });

      if (!step) {
        throw new Error('Onboarding step not found');
      }

      const updatedStepsCompleted = [...currentProgress.stepsCompleted];
      if (!updatedStepsCompleted.includes(stepKey)) {
        updatedStepsCompleted.push(stepKey);
      }

      const updatedActivationEvents = {
        ...currentProgress.activationEvents,
        ...activationEvents
      };

      // Calculate completion percentage
      const totalSteps = await prisma.onboardingStep.count();
      const completionPercentage = Math.round((updatedStepsCompleted.length / totalSteps) * 100);

      // Determine next step
      const nextStep = await this.getNextStep(stepKey);
      const isCompleted = completionPercentage >= 100;

      const updatedProgress = await prisma.onboardingProgress.update({
        where: { businessId },
        data: {
          currentStep: isCompleted ? 'complete' : nextStep?.stepKey || 'complete',
          completionPercentage,
          stepsCompleted: updatedStepsCompleted,
          activationEvents: updatedActivationEvents,
          lastActivityAt: new Date(),
          completedAt: isCompleted ? new Date() : null
        }
      });

      // Create nudges for next steps if not completed
      if (!isCompleted && nextStep) {
        await this.scheduleNextNudge(businessId, nextStep);
      }

      return updatedProgress;
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
      throw new Error('Failed to update onboarding progress');
    }
  }

  /**
   * Get onboarding progress for a business
   */
  async getOnboardingProgress(businessId: string): Promise<any> {
    try {
      const progress = await prisma.onboardingProgress.findUnique({
        where: { businessId },
        include: {
          business: true
        }
      });

      if (!progress) {
        return null;
      }

      // Get all available steps
      const allSteps = await prisma.onboardingStep.findMany({
        orderBy: { orderIndex: 'asc' }
      });

      return {
        ...progress,
        allSteps,
        isCompleted: progress.completedAt !== null
      };
    } catch (error) {
      console.error('Error getting onboarding progress:', error);
      throw new Error('Failed to get onboarding progress');
    }
  }

  /**
   * Create a nudge for a business
   */
  async createNudge(nudgeData: z.infer<typeof NudgeSchema>): Promise<any> {
    try {
      const nudge = await prisma.onboardingNudge.create({
        data: {
          businessId: nudgeData.businessId,
          nudgeType: nudgeData.nudgeType,
          nudgeContent: nudgeData.nudgeContent,
          targetStep: nudgeData.targetStep,
          triggerCondition: nudgeData.triggerCondition
        }
      });

      return nudge;
    } catch (error) {
      console.error('Error creating nudge:', error);
      throw new Error('Failed to create nudge');
    }
  }

  /**
   * Get active nudges for a business
   */
  async getActiveNudges(businessId: string): Promise<any[]> {
    try {
      const nudges = await prisma.onboardingNudge.findMany({
        where: {
          businessId,
          shownAt: null,
          dismissedAt: null
        },
        orderBy: { createdAt: 'asc' }
      });

      return nudges;
    } catch (error) {
      console.error('Error getting active nudges:', error);
      throw new Error('Failed to get active nudges');
    }
  }

  /**
   * Mark a nudge as shown
   */
  async markNudgeAsShown(nudgeId: string): Promise<any> {
    try {
      const nudge = await prisma.onboardingNudge.update({
        where: { id: nudgeId },
        data: { shownAt: new Date() }
      });

      return nudge;
    } catch (error) {
      console.error('Error marking nudge as shown:', error);
      throw new Error('Failed to mark nudge as shown');
    }
  }

  /**
   * Dismiss a nudge
   */
  async dismissNudge(nudgeId: string): Promise<any> {
    try {
      const nudge = await prisma.onboardingNudge.update({
        where: { id: nudgeId },
        data: { dismissedAt: new Date() }
      });

      return nudge;
    } catch (error) {
      console.error('Error dismissing nudge:', error);
      throw new Error('Failed to dismiss nudge');
    }
  }

  /**
   * Get onboarding analytics
   */
  async getOnboardingAnalytics(): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_signups,
          COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_onboarding,
          ROUND(
            COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as completion_rate
        FROM businesses b
        LEFT JOIN onboarding_progress op ON b.id = op.business_id
        WHERE b.created_at >= NOW() - INTERVAL '30 days'
      `;

      return analytics[0];
    } catch (error) {
      console.error('Error getting onboarding analytics:', error);
      throw new Error('Failed to get onboarding analytics');
    }
  }

  /**
   * Get next step in onboarding flow
   */
  private async getNextStep(currentStepKey: string): Promise<any> {
    try {
      const currentStep = await prisma.onboardingStep.findUnique({
        where: { stepKey: currentStepKey }
      });

      if (!currentStep) {
        return null;
      }

      const nextStep = await prisma.onboardingStep.findFirst({
        where: {
          orderIndex: { gt: currentStep.orderIndex }
        },
        orderBy: { orderIndex: 'asc' }
      });

      return nextStep;
    } catch (error) {
      console.error('Error getting next step:', error);
      return null;
    }
  }

  /**
   * Schedule next nudge based on step configuration
   */
  private async scheduleNextNudge(businessId: string, step: any): Promise<void> {
    try {
      const nudgeConfig = step.nudgeConfig as any;
      const delayHours = nudgeConfig?.delayHours || 24;

      // Schedule nudge based on step configuration
      setTimeout(async () => {
        await this.createNudge({
          businessId,
          nudgeType: nudgeConfig?.type || 'tooltip',
          nudgeContent: {
            title: `Complete: ${step.stepName}`,
            message: step.stepDescription || `Let's move on to the next step.`,
            cta: 'Continue'
          },
          targetStep: step.stepKey,
          triggerCondition: { delayHours }
        });
      }, delayHours * 60 * 60 * 1000); // Convert hours to milliseconds
    } catch (error) {
      console.error('Error scheduling next nudge:', error);
    }
  }

  /**
   * Track activation events
   */
  async trackActivationEvent(
    businessId: string, 
    eventType: string, 
    eventData: Record<string, any> = {}
  ): Promise<void> {
    try {
      const progress = await prisma.onboardingProgress.findUnique({
        where: { businessId }
      });

      if (!progress) {
        return;
      }

      const updatedEvents = {
        ...progress.activationEvents,
        [eventType]: {
          ...progress.activationEvents[eventType],
          ...eventData,
          timestamp: new Date().toISOString()
        }
      };

      await prisma.onboardingProgress.update({
        where: { businessId },
        data: { activationEvents: updatedEvents }
      });
    } catch (error) {
      console.error('Error tracking activation event:', error);
    }
  }
}

export const onboardingService = new OnboardingService();
