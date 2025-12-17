import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const ReferralSchema = z.object({
  referrerBusinessId: z.string().uuid(),
  referredBusinessId: z.string().uuid(),
  referralCode: z.string(),
  referralLink: z.string()
});

const ReferralProgramSchema = z.object({
  programName: z.string(),
  isActive: z.boolean().default(true),
  referralCreditCents: z.number().min(0),
  referredCreditCents: z.number().min(0).default(0),
  minimumPaymentRequiredCents: z.number().min(0).default(0),
  creditConditions: z.record(z.any()).default({})
});

export class ReferralService {
  /**
   * Generate a unique referral code for a business
   */
  async generateReferralCode(businessId: string): Promise<string> {
    try {
      // Check if business already has a referral code
      const existingReferral = await prisma.referral.findFirst({
        where: { referrerBusinessId: businessId }
      });

      if (existingReferral) {
        return existingReferral.referralCode;
      }

      // Generate unique referral code
      const business = await prisma.business.findUnique({
        where: { id: businessId }
      });

      if (!business) {
        throw new Error('Business not found');
      }

      // Create referral code from business name and ID
      const businessSlug = business.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 8);
      
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const referralCode = `${businessSlug}${randomSuffix}`;

      return referralCode;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw new Error('Failed to generate referral code');
    }
  }

  /**
   * Create a referral link for a business
   */
  async createReferralLink(businessId: string): Promise<string> {
    try {
      const referralCode = await this.generateReferralCode(businessId);
      const referralLink = `${process.env.FRONTEND_URL}/signup?ref=${referralCode}`;

      return referralLink;
    } catch (error) {
      console.error('Error creating referral link:', error);
      throw new Error('Failed to create referral link');
    }
  }

  /**
   * Track a referral when someone signs up with a referral code
   */
  async trackReferral(referralCode: string, referredBusinessId: string): Promise<any> {
    try {
      // Find the referrer business by referral code
      const existingReferral = await prisma.referral.findFirst({
        where: { referralCode }
      });

      if (existingReferral) {
        throw new Error('Referral code already used');
      }

      // Get the referrer business
      const referrerBusiness = await prisma.business.findFirst({
        where: {
          referrals: {
            some: { referralCode }
          }
        }
      });

      if (!referrerBusiness) {
        throw new Error('Invalid referral code');
      }

      // Get referral program settings
      const referralProgram = await prisma.referralProgram.findFirst({
        where: { isActive: true }
      });

      if (!referralProgram) {
        throw new Error('Referral program not active');
      }

      // Create referral record
      const referral = await prisma.referral.create({
        data: {
          referrerBusinessId: referrerBusiness.id,
          referredBusinessId,
          referralCode,
          referralLink: `${process.env.FRONTEND_URL}/signup?ref=${referralCode}`,
          referralCreditCents: referralProgram.referralCreditCents,
          referredCreditCents: referralProgram.referredCreditCents,
          status: 'pending',
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        }
      });

      return referral;
    } catch (error) {
      console.error('Error tracking referral:', error);
      throw new Error('Failed to track referral');
    }
  }

  /**
   * Process referral credit when conditions are met
   */
  async processReferralCredit(referralId: string): Promise<any> {
    try {
      const referral = await prisma.referral.findUnique({
        where: { id: referralId },
        include: {
          referrerBusiness: true,
          referredBusiness: true
        }
      });

      if (!referral) {
        throw new Error('Referral not found');
      }

      if (referral.status !== 'pending') {
        throw new Error('Referral already processed');
      }

      // Check if referred business has made their first payment
      const referredSubscription = await prisma.subscription.findFirst({
        where: {
          businessId: referral.referredBusinessId,
          status: 'active'
        },
        include: { planDefinition: true }
      });

      if (!referredSubscription) {
        throw new Error('Referred business has no active subscription');
      }

      // Check if minimum payment requirement is met
      const referralProgram = await prisma.referralProgram.findFirst({
        where: { isActive: true }
      });

      if (referralProgram && referralProgram.minimumPaymentRequiredCents > 0) {
        const totalPayments = await prisma.paymentHistory.aggregate({
          where: {
            businessId: referral.referredBusinessId,
            status: 'succeeded'
          },
          _sum: { amount: true }
        });

        if (!totalPayments._sum.amount || totalPayments._sum.amount < referralProgram.minimumPaymentRequiredCents) {
          throw new Error('Minimum payment requirement not met');
        }
      }

      // Update referral status
      const updatedReferral = await prisma.referral.update({
        where: { id: referralId },
        data: {
          status: 'completed',
          firstPaymentDate: new Date(),
          creditConditionsMetAt: new Date()
        }
      });

      // Issue credits to both businesses
      await this.issueReferralCredits(referral);

      return updatedReferral;
    } catch (error) {
      console.error('Error processing referral credit:', error);
      throw new Error('Failed to process referral credit');
    }
  }

  /**
   * Issue referral credits to businesses
   */
  async issueReferralCredits(referral: any): Promise<void> {
    try {
      // Issue credit to referrer
      if (referral.referralCreditCents > 0) {
        await this.addBillingCredit(referral.referrerBusinessId, referral.referralCreditCents);
      }

      // Issue credit to referred business
      if (referral.referredCreditCents > 0) {
        await this.addBillingCredit(referral.referredBusinessId, referral.referredCreditCents);
      }

      // Update referral stats
      await this.updateReferralStats(referral.referrerBusinessId);
    } catch (error) {
      console.error('Error issuing referral credits:', error);
      throw new Error('Failed to issue referral credits');
    }
  }

  /**
   * Add billing credit to a business
   */
  async addBillingCredit(businessId: string, creditAmountCents: number): Promise<void> {
    try {
      // This would integrate with Stripe to add credits to the customer's balance
      // For now, we'll track it in our database
      
      // Update business billing credit
      await prisma.business.update({
        where: { id: businessId },
        data: {
          billingCreditsCents: {
            increment: creditAmountCents
          }
        }
      });

      // Log the credit transaction
      await prisma.paymentHistory.create({
        data: {
          businessId,
          amount: creditAmountCents,
          currency: 'usd',
          status: 'succeeded',
          paymentType: 'referral_credit',
          description: 'Referral program credit',
          processedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error adding billing credit:', error);
      throw new Error('Failed to add billing credit');
    }
  }

  /**
   * Update referral statistics for a business
   */
  async updateReferralStats(businessId: string): Promise<void> {
    try {
      const stats = await prisma.referral.aggregate({
        where: { referrerBusinessId: businessId },
        _count: { id: true },
        _sum: { referralCreditCents: true }
      });

      const successfulReferrals = await prisma.referral.count({
        where: {
          referrerBusinessId: businessId,
          status: 'completed'
        }
      });

      const pendingCredits = await prisma.referral.aggregate({
        where: {
          referrerBusinessId: businessId,
          status: 'pending'
        },
        _sum: { referralCreditCents: true }
      });

      await prisma.referralStats.upsert({
        where: { businessId },
        update: {
          totalReferrals: stats._count.id,
          successfulReferrals,
          totalCreditsEarnedCents: stats._sum.referralCreditCents || 0,
          pendingCreditsCents: pendingCredits._sum.referralCreditCents || 0,
          updatedAt: new Date()
        },
        create: {
          businessId,
          totalReferrals: stats._count.id,
          successfulReferrals,
          totalCreditsEarnedCents: stats._sum.referralCreditCents || 0,
          pendingCreditsCents: pendingCredits._sum.referralCreditCents || 0
        }
      });
    } catch (error) {
      console.error('Error updating referral stats:', error);
      throw new Error('Failed to update referral stats');
    }
  }

  /**
   * Get referral statistics for a business
   */
  async getReferralStats(businessId: string): Promise<any> {
    try {
      const stats = await prisma.referralStats.findUnique({
        where: { businessId }
      });

      const recentReferrals = await prisma.referral.findMany({
        where: { referrerBusinessId: businessId },
        include: {
          referredBusiness: {
            select: {
              id: true,
              name: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      return {
        stats,
        recentReferrals
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      throw new Error('Failed to get referral stats');
    }
  }

  /**
   * Get referral link for a business
   */
  async getReferralLink(businessId: string): Promise<string> {
    try {
      const referral = await prisma.referral.findFirst({
        where: { referrerBusinessId: businessId }
      });

      if (referral) {
        return referral.referralLink;
      }

      // Create new referral link if none exists
      return await this.createReferralLink(businessId);
    } catch (error) {
      console.error('Error getting referral link:', error);
      throw new Error('Failed to get referral link');
    }
  }

  /**
   * Validate referral code
   */
  async validateReferralCode(referralCode: string): Promise<boolean> {
    try {
      const referral = await prisma.referral.findFirst({
        where: { referralCode }
      });

      return !referral; // Return true if code is available (not already used)
    } catch (error) {
      console.error('Error validating referral code:', error);
      return false;
    }
  }

  /**
   * Get referral program analytics
   */
  async getReferralAnalytics(): Promise<any> {
    try {
      const analytics = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_referrals,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_referrals,
          ROUND(
            COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(*), 0) * 100, 2
          ) as conversion_rate,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN referral_credit_cents ELSE 0 END), 0) as total_credits_issued_cents
        FROM referrals
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `;

      return analytics[0];
    } catch (error) {
      console.error('Error getting referral analytics:', error);
      throw new Error('Failed to get referral analytics');
    }
  }

  /**
   * Process all pending referrals (run as scheduled job)
   */
  async processPendingReferrals(): Promise<void> {
    try {
      const pendingReferrals = await prisma.referral.findMany({
        where: {
          status: 'pending',
          expiresAt: { gt: new Date() }
        }
      });

      for (const referral of pendingReferrals) {
        try {
          await this.processReferralCredit(referral.id);
        } catch (error) {
          console.error(`Error processing referral ${referral.id}:`, error);
          // Continue with other referrals
        }
      }
    } catch (error) {
      console.error('Error processing pending referrals:', error);
      throw new Error('Failed to process pending referrals');
    }
  }
}

export const referralService = new ReferralService();
