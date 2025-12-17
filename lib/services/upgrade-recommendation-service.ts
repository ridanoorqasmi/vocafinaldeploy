import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const UpgradeRuleSchema = z.object({
  ruleName: z.string(),
  ruleDescription: z.string().optional(),
  currentPlanFilter: z.record(z.any()),
  triggerConditions: z.record(z.any()),
  recommendedPlanId: z.string(),
  recommendationMessage: z.string(),
  priorityScore: z.number().min(0).max(100).default(50),
  isActive: z.boolean().default(true)
});

const UsageAnalysisSchema = z.object({
  businessId: z.string().uuid(),
  analysisDate: z.string().transform(str => new Date(str)),
  apiCallsCount: z.number().default(0),
  activeSeats: z.number().default(0),
  storageUsedMb: z.number().default(0),
  billingLimitUtilization: z.number().min(0).max(1).default(0),
  usageTrend: z.enum(['increasing', 'stable', 'declining']).default('stable'),
  growthRate: z.number().default(0)
});

const UpgradeRecommendationSchema = z.object({
  businessId: z.string().uuid(),
  ruleId: z.string().uuid(),
  currentPlanId: z.string(),
  recommendedPlanId: z.string(),
  recommendationReason: z.string(),
  confidenceScore: z.number().min(0).max(1).default(0),
  potentialRevenueIncreaseCents: z.number().default(0),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
});

export class UpgradeRecommendationService {
  /**
   * Analyze usage patterns and generate upgrade recommendations
   */
  async analyzeUsageAndRecommendUpgrades(businessId: string): Promise<any[]> {
    try {
      // Get current business data
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          subscriptions: {
            where: { status: 'active' },
            include: { planDefinition: true }
          }
        }
      });

      if (!business || !business.subscriptions.length) {
        return [];
      }

      const currentSubscription = business.subscriptions[0];
      const currentPlan = currentSubscription.planDefinition;

      // Get usage analysis
      const usageAnalysis = await this.getUsageAnalysis(businessId);

      // Get applicable upgrade rules
      const applicableRules = await this.getApplicableRules(currentPlan.id);

      const recommendations = [];

      for (const rule of applicableRules) {
        const isTriggered = await this.evaluateRuleConditions(rule, usageAnalysis, currentPlan);
        
        if (isTriggered) {
          const recommendation = await this.createRecommendation({
            businessId,
            ruleId: rule.id,
            currentPlanId: currentPlan.id,
            recommendedPlanId: rule.recommendedPlanId,
            recommendationReason: rule.recommendationMessage,
            confidenceScore: await this.calculateConfidenceScore(rule, usageAnalysis),
            potentialRevenueIncreaseCents: await this.calculateRevenueIncrease(currentPlan.id, rule.recommendedPlanId),
            urgencyLevel: await this.calculateUrgencyLevel(rule, usageAnalysis)
          });

          recommendations.push(recommendation);
        }
      }

      return recommendations;
    } catch (error) {
      console.error('Error analyzing usage and recommending upgrades:', error);
      throw new Error('Failed to analyze usage and recommend upgrades');
    }
  }

  /**
   * Get usage analysis for a business
   */
  async getUsageAnalysis(businessId: string): Promise<any> {
    try {
      let usageAnalysis = await prisma.usageAnalysis.findFirst({
        where: {
          businessId,
          analysisDate: new Date()
        }
      });

      if (!usageAnalysis) {
        // Calculate usage analysis if not exists
        usageAnalysis = await this.calculateUsageAnalysis(businessId);
      }

      return usageAnalysis;
    } catch (error) {
      console.error('Error getting usage analysis:', error);
      throw new Error('Failed to get usage analysis');
    }
  }

  /**
   * Calculate usage analysis for a business
   */
  async calculateUsageAnalysis(businessId: string): Promise<any> {
    try {
      // Get API calls count from query logs
      const apiCallsCount = await prisma.queryLog.count({
        where: {
          businessId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      });

      // Get active seats (users)
      const activeSeats = await prisma.businessUser.count({
        where: {
          businessId,
          isActive: true
        }
      });

      // Get storage usage (placeholder - would need actual storage calculation)
      const storageUsedMb = 0; // TODO: Implement actual storage calculation

      // Get billing limit utilization
      const subscription = await prisma.subscription.findFirst({
        where: {
          businessId,
          status: 'active'
        },
        include: { planDefinition: true }
      });

      const billingLimitUtilization = subscription ? 
        Math.min(apiCallsCount / (subscription.planDefinition.apiCallsLimit || 1000), 1) : 0;

      // Calculate usage trend
      const previousMonthCalls = await prisma.queryLog.count({
        where: {
          businessId,
          createdAt: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      });

      const growthRate = previousMonthCalls > 0 ? 
        (apiCallsCount - previousMonthCalls) / previousMonthCalls : 0;

      const usageTrend = growthRate > 0.1 ? 'increasing' : 
                        growthRate < -0.1 ? 'declining' : 'stable';

      const usageAnalysis = await prisma.usageAnalysis.upsert({
        where: {
          businessId_analysisDate: {
            businessId,
            analysisDate: new Date()
          }
        },
        update: {
          apiCallsCount,
          activeSeats,
          storageUsedMb,
          billingLimitUtilization,
          usageTrend,
          growthRate
        },
        create: {
          businessId,
          analysisDate: new Date(),
          apiCallsCount,
          activeSeats,
          storageUsedMb,
          billingLimitUtilization,
          usageTrend,
          growthRate
        }
      });

      return usageAnalysis;
    } catch (error) {
      console.error('Error calculating usage analysis:', error);
      throw new Error('Failed to calculate usage analysis');
    }
  }

  /**
   * Get applicable upgrade rules for a plan
   */
  async getApplicableRules(currentPlanId: string): Promise<any[]> {
    try {
      const rules = await prisma.upgradeRule.findMany({
        where: {
          isActive: true,
          currentPlanFilter: {
            path: ['plans'],
            array_contains: [currentPlanId]
          }
        },
        orderBy: { priorityScore: 'desc' }
      });

      return rules;
    } catch (error) {
      console.error('Error getting applicable rules:', error);
      throw new Error('Failed to get applicable rules');
    }
  }

  /**
   * Evaluate if a rule's conditions are met
   */
  async evaluateRuleConditions(rule: any, usageAnalysis: any, currentPlan: any): Promise<boolean> {
    try {
      const conditions = rule.triggerConditions;

      // Check API calls condition
      if (conditions.apiCalls?.min && usageAnalysis.apiCallsCount < conditions.apiCalls.min) {
        return false;
      }

      // Check utilization condition
      if (conditions.utilization?.min && usageAnalysis.billingLimitUtilization < conditions.utilization.min) {
        return false;
      }

      // Check active seats condition
      if (conditions.activeSeats?.min && usageAnalysis.activeSeats < conditions.activeSeats.min) {
        return false;
      }

      // Check growth rate condition
      if (conditions.growthRate?.min && usageAnalysis.growthRate < conditions.growthRate.min) {
        return false;
      }

      // Check usage trend condition
      if (conditions.usageTrend && usageAnalysis.usageTrend !== conditions.usageTrend) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error evaluating rule conditions:', error);
      return false;
    }
  }

  /**
   * Create an upgrade recommendation
   */
  async createRecommendation(recommendationData: z.infer<typeof UpgradeRecommendationSchema>): Promise<any> {
    try {
      const recommendation = await prisma.upgradeRecommendation.create({
        data: {
          businessId: recommendationData.businessId,
          ruleId: recommendationData.ruleId,
          currentPlanId: recommendationData.currentPlanId,
          recommendedPlanId: recommendationData.recommendedPlanId,
          recommendationReason: recommendationData.recommendationReason,
          confidenceScore: recommendationData.confidenceScore,
          potentialRevenueIncreaseCents: recommendationData.potentialRevenueIncreaseCents,
          urgencyLevel: recommendationData.urgencyLevel
        }
      });

      return recommendation;
    } catch (error) {
      console.error('Error creating recommendation:', error);
      throw new Error('Failed to create recommendation');
    }
  }

  /**
   * Get upgrade recommendations for a business
   */
  async getRecommendations(businessId: string): Promise<any[]> {
    try {
      const recommendations = await prisma.upgradeRecommendation.findMany({
        where: {
          businessId,
          dismissedAt: null,
          acceptedAt: null
        },
        include: {
          rule: true
        },
        orderBy: [
          { urgencyLevel: 'desc' },
          { confidenceScore: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      return recommendations;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw new Error('Failed to get recommendations');
    }
  }

  /**
   * Mark a recommendation as shown
   */
  async markRecommendationAsShown(recommendationId: string): Promise<any> {
    try {
      const recommendation = await prisma.upgradeRecommendation.update({
        where: { id: recommendationId },
        data: { shownAt: new Date() }
      });

      return recommendation;
    } catch (error) {
      console.error('Error marking recommendation as shown:', error);
      throw new Error('Failed to mark recommendation as shown');
    }
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(recommendationId: string): Promise<any> {
    try {
      const recommendation = await prisma.upgradeRecommendation.update({
        where: { id: recommendationId },
        data: { dismissedAt: new Date() }
      });

      return recommendation;
    } catch (error) {
      console.error('Error dismissing recommendation:', error);
      throw new Error('Failed to dismiss recommendation');
    }
  }

  /**
   * Accept a recommendation
   */
  async acceptRecommendation(recommendationId: string): Promise<any> {
    try {
      const recommendation = await prisma.upgradeRecommendation.update({
        where: { id: recommendationId },
        data: { acceptedAt: new Date() }
      });

      return recommendation;
    } catch (error) {
      console.error('Error accepting recommendation:', error);
      throw new Error('Failed to accept recommendation');
    }
  }

  /**
   * Calculate confidence score for a recommendation
   */
  private async calculateConfidenceScore(rule: any, usageAnalysis: any): Promise<number> {
    try {
      let confidence = 0.5; // Base confidence

      // Increase confidence based on usage patterns
      if (usageAnalysis.billingLimitUtilization > 0.8) {
        confidence += 0.2;
      }

      if (usageAnalysis.growthRate > 0.1) {
        confidence += 0.1;
      }

      if (usageAnalysis.usageTrend === 'increasing') {
        confidence += 0.1;
      }

      // Increase confidence based on rule priority
      confidence += (rule.priorityScore / 100) * 0.1;

      return Math.min(confidence, 1.0);
    } catch (error) {
      console.error('Error calculating confidence score:', error);
      return 0.5;
    }
  }

  /**
   * Calculate potential revenue increase
   */
  private async calculateRevenueIncrease(currentPlanId: string, recommendedPlanId: string): Promise<number> {
    try {
      const currentPlan = await prisma.planDefinition.findUnique({
        where: { id: currentPlanId }
      });

      const recommendedPlan = await prisma.planDefinition.findUnique({
        where: { id: recommendedPlanId }
      });

      if (!currentPlan || !recommendedPlan) {
        return 0;
      }

      const monthlyIncrease = recommendedPlan.priceCents - currentPlan.priceCents;
      return monthlyIncrease * 12; // Annual increase
    } catch (error) {
      console.error('Error calculating revenue increase:', error);
      return 0;
    }
  }

  /**
   * Calculate urgency level for a recommendation
   */
  private async calculateUrgencyLevel(rule: any, usageAnalysis: any): Promise<string> {
    try {
      let urgencyScore = 0;

      // High utilization = high urgency
      if (usageAnalysis.billingLimitUtilization > 0.9) {
        urgencyScore += 3;
      } else if (usageAnalysis.billingLimitUtilization > 0.8) {
        urgencyScore += 2;
      }

      // High growth = high urgency
      if (usageAnalysis.growthRate > 0.2) {
        urgencyScore += 2;
      }

      // Rule priority affects urgency
      urgencyScore += Math.floor(rule.priorityScore / 25);

      if (urgencyScore >= 5) return 'critical';
      if (urgencyScore >= 3) return 'high';
      if (urgencyScore >= 1) return 'medium';
      return 'low';
    } catch (error) {
      console.error('Error calculating urgency level:', error);
      return 'medium';
    }
  }

  /**
   * Get upgrade recommendation analytics
   */
  async getUpgradeAnalytics(): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_recommendations,
          COUNT(CASE WHEN accepted_at IS NOT NULL THEN 1 END) as accepted_recommendations,
          COUNT(CASE WHEN dismissed_at IS NOT NULL THEN 1 END) as dismissed_recommendations,
          ROUND(
            COUNT(CASE WHEN accepted_at IS NOT NULL THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as acceptance_rate,
          COALESCE(SUM(potential_revenue_increase_cents), 0) as total_potential_revenue_cents
        FROM upgrade_recommendations
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `;

      return analytics[0];
    } catch (error) {
      console.error('Error getting upgrade analytics:', error);
      throw new Error('Failed to get upgrade analytics');
    }
  }
}

export const upgradeRecommendationService = new UpgradeRecommendationService();
