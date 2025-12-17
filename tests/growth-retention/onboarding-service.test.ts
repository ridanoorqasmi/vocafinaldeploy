import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onboardingService } from '@/lib/services/onboarding-service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    onboardingProgress: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    onboardingStep: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    onboardingNudge: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  })),
}));

describe('OnboardingService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeOnboarding', () => {
    it('should initialize onboarding progress for a new business', async () => {
      const businessId = 'test-business-id';
      const mockProgress = {
        id: 'progress-id',
        businessId,
        currentStep: 'welcome',
        completionPercentage: 0,
        stepsCompleted: [],
        activationEvents: {}
      };

      mockPrisma.onboardingProgress.upsert.mockResolvedValue(mockProgress);
      mockPrisma.onboardingNudge.create.mockResolvedValue({});

      const result = await onboardingService.initializeOnboarding(businessId);

      expect(mockPrisma.onboardingProgress.upsert).toHaveBeenCalledWith({
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

      expect(result).toEqual(mockProgress);
    });

    it('should handle errors when initializing onboarding', async () => {
      const businessId = 'test-business-id';
      mockPrisma.onboardingProgress.upsert.mockRejectedValue(new Error('Database error'));

      await expect(onboardingService.initializeOnboarding(businessId))
        .rejects.toThrow('Failed to initialize onboarding');
    });
  });

  describe('updateOnboardingProgress', () => {
    it('should update onboarding progress when a step is completed', async () => {
      const businessId = 'test-business-id';
      const stepKey = 'first_agent';
      const activationEvents = { agentCreated: true };

      const mockCurrentProgress = {
        businessId,
        currentStep: 'welcome',
        stepsCompleted: ['welcome'],
        activationEvents: {}
      };

      const mockStep = {
        stepKey: 'first_agent',
        orderIndex: 2,
        nudgeConfig: { delayHours: 1, type: 'banner' }
      };

      const mockUpdatedProgress = {
        ...mockCurrentProgress,
        currentStep: 'first_call',
        completionPercentage: 40,
        stepsCompleted: ['welcome', 'first_agent']
      };

      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(mockCurrentProgress);
      mockPrisma.onboardingStep.findUnique.mockResolvedValue(mockStep);
      mockPrisma.onboardingStep.findFirst.mockResolvedValue({ stepKey: 'first_call' });
      mockPrisma.onboardingStep.count.mockResolvedValue(5);
      mockPrisma.onboardingProgress.update.mockResolvedValue(mockUpdatedProgress);
      mockPrisma.onboardingNudge.create.mockResolvedValue({});

      const result = await onboardingService.updateOnboardingProgress(
        businessId,
        stepKey,
        activationEvents
      );

      expect(mockPrisma.onboardingProgress.update).toHaveBeenCalledWith({
        where: { businessId },
        data: expect.objectContaining({
          currentStep: 'first_call',
          completionPercentage: 40,
          stepsCompleted: ['welcome', 'first_agent'],
          activationEvents: expect.objectContaining(activationEvents)
        })
      });

      expect(result).toEqual(mockUpdatedProgress);
    });

    it('should handle missing onboarding progress', async () => {
      const businessId = 'test-business-id';
      const stepKey = 'first_agent';

      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);

      await expect(onboardingService.updateOnboardingProgress(businessId, stepKey))
        .rejects.toThrow('Onboarding progress not found');
    });

    it('should handle missing onboarding step', async () => {
      const businessId = 'test-business-id';
      const stepKey = 'invalid_step';

      const mockCurrentProgress = {
        businessId,
        currentStep: 'welcome',
        stepsCompleted: ['welcome'],
        activationEvents: {}
      };

      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(mockCurrentProgress);
      mockPrisma.onboardingStep.findUnique.mockResolvedValue(null);

      await expect(onboardingService.updateOnboardingProgress(businessId, stepKey))
        .rejects.toThrow('Onboarding step not found');
    });
  });

  describe('getOnboardingProgress', () => {
    it('should get onboarding progress for a business', async () => {
      const businessId = 'test-business-id';
      const mockProgress = {
        businessId,
        currentStep: 'welcome',
        completionPercentage: 20,
        stepsCompleted: ['welcome'],
        activationEvents: {},
        business: { id: businessId, name: 'Test Business' }
      };

      const mockSteps = [
        { stepKey: 'welcome', stepName: 'Welcome', orderIndex: 1 },
        { stepKey: 'first_agent', stepName: 'Create Agent', orderIndex: 2 }
      ];

      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(mockProgress);
      mockPrisma.onboardingStep.findMany.mockResolvedValue(mockSteps);

      const result = await onboardingService.getOnboardingProgress(businessId);

      expect(mockPrisma.onboardingProgress.findUnique).toHaveBeenCalledWith({
        where: { businessId },
        include: { business: true }
      });

      expect(result).toEqual({
        ...mockProgress,
        allSteps: mockSteps,
        isCompleted: false
      });
    });

    it('should return null for non-existent business', async () => {
      const businessId = 'non-existent-business';

      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);

      const result = await onboardingService.getOnboardingProgress(businessId);

      expect(result).toBeNull();
    });
  });

  describe('createNudge', () => {
    it('should create a nudge for a business', async () => {
      const nudgeData = {
        businessId: 'test-business-id',
        nudgeType: 'tooltip' as const,
        nudgeContent: {
          title: 'Welcome!',
          message: 'Get started with your first agent.',
          cta: 'Get Started'
        },
        targetStep: 'welcome',
        triggerCondition: { delayHours: 0 }
      };

      const mockNudge = {
        id: 'nudge-id',
        ...nudgeData
      };

      mockPrisma.onboardingNudge.create.mockResolvedValue(mockNudge);

      const result = await onboardingService.createNudge(nudgeData);

      expect(mockPrisma.onboardingNudge.create).toHaveBeenCalledWith({
        data: nudgeData
      });

      expect(result).toEqual(mockNudge);
    });
  });

  describe('getActiveNudges', () => {
    it('should get active nudges for a business', async () => {
      const businessId = 'test-business-id';
      const mockNudges = [
        {
          id: 'nudge-1',
          businessId,
          nudgeType: 'tooltip',
          nudgeContent: { title: 'Tip 1', message: 'Message 1' },
          targetStep: 'welcome'
        }
      ];

      mockPrisma.onboardingNudge.findMany.mockResolvedValue(mockNudges);

      const result = await onboardingService.getActiveNudges(businessId);

      expect(mockPrisma.onboardingNudge.findMany).toHaveBeenCalledWith({
        where: {
          businessId,
          shownAt: null,
          dismissedAt: null
        },
        orderBy: { createdAt: 'asc' }
      });

      expect(result).toEqual(mockNudges);
    });
  });

  describe('markNudgeAsShown', () => {
    it('should mark a nudge as shown', async () => {
      const nudgeId = 'nudge-id';
      const mockNudge = {
        id: nudgeId,
        shownAt: new Date()
      };

      mockPrisma.onboardingNudge.update.mockResolvedValue(mockNudge);

      const result = await onboardingService.markNudgeAsShown(nudgeId);

      expect(mockPrisma.onboardingNudge.update).toHaveBeenCalledWith({
        where: { id: nudgeId },
        data: { shownAt: expect.any(Date) }
      });

      expect(result).toEqual(mockNudge);
    });
  });

  describe('dismissNudge', () => {
    it('should dismiss a nudge', async () => {
      const nudgeId = 'nudge-id';
      const mockNudge = {
        id: nudgeId,
        dismissedAt: new Date()
      };

      mockPrisma.onboardingNudge.update.mockResolvedValue(mockNudge);

      const result = await onboardingService.dismissNudge(nudgeId);

      expect(mockPrisma.onboardingNudge.update).toHaveBeenCalledWith({
        where: { id: nudgeId },
        data: { dismissedAt: expect.any(Date) }
      });

      expect(result).toEqual(mockNudge);
    });
  });

  describe('getOnboardingAnalytics', () => {
    it('should get onboarding analytics', async () => {
      const mockAnalytics = {
        total_signups: 100,
        completed_onboarding: 75,
        completion_rate: 75.0
      };

      mockPrisma.$queryRaw.mockResolvedValue([mockAnalytics]);

      const result = await onboardingService.getOnboardingAnalytics();

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('trackActivationEvent', () => {
    it('should track activation events', async () => {
      const businessId = 'test-business-id';
      const eventType = 'first_agent_created';
      const eventData = { agentId: 'agent-123' };

      const mockProgress = {
        businessId,
        activationEvents: {}
      };

      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(mockProgress);
      mockPrisma.onboardingProgress.update.mockResolvedValue({
        ...mockProgress,
        activationEvents: {
          [eventType]: {
            ...eventData,
            timestamp: expect.any(String)
          }
        }
      });

      await onboardingService.trackActivationEvent(businessId, eventType, eventData);

      expect(mockPrisma.onboardingProgress.update).toHaveBeenCalledWith({
        where: { businessId },
        data: {
          activationEvents: expect.objectContaining({
            [eventType]: expect.objectContaining(eventData)
          })
        }
      });
    });

    it('should handle missing progress gracefully', async () => {
      const businessId = 'non-existent-business';
      const eventType = 'first_agent_created';

      mockPrisma.onboardingProgress.findUnique.mockResolvedValue(null);

      // Should not throw error
      await expect(onboardingService.trackActivationEvent(businessId, eventType))
        .resolves.toBeUndefined();
    });
  });
});
