import { PrismaClient } from '@prisma/client';
import { hashPassword, validatePasswordStrength, generateInvitationToken } from './password';
import { emailService } from './email-service';
import { setBusinessContext } from './auth';
import { 
  InviteUserRequest,
  AcceptInviteRequest,
  ChangeRoleRequest,
  AUTH_ERRORS,
  AUTH_ERROR_MESSAGES,
  EMAIL_CONFIG
} from './auth-types';

const prisma = new PrismaClient();

// ===== USER MANAGEMENT SERVICE =====

export class UserService {
  /**
   * Get all users for a business (paginated)
   */
  async getBusinessUsers(businessId: string, page: number = 1, limit: number = 20) {
    try {
      await setBusinessContext(businessId);

      const skip = (page - 1) * limit;
      
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: { businessId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.user.count({
          where: { businessId }
        })
      ]);

      return {
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      console.error('Get business users error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch users'
        }
      };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string, businessId: string) {
    try {
      await setBusinessContext(businessId);

      const user = await prisma.user.findFirst({
        where: { 
          id: userId,
          businessId 
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.USER_NOT_FOUND]
          }
        };
      }

      return {
        success: true,
        data: { user }
      };
    } catch (error) {
      console.error('Get user error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch user'
        }
      };
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, businessId: string, updateData: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }) {
    try {
      await setBusinessContext(businessId);

      // Check if user exists and belongs to business
      const existingUser = await prisma.user.findFirst({
        where: { 
          id: userId,
          businessId 
        }
      });

      if (!existingUser) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.USER_NOT_FOUND]
          }
        };
      }

      // Check if email is already taken by another user
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email: updateData.email.toLowerCase(),
            id: { not: userId }
          }
        });

        if (emailExists) {
          return {
            success: false,
            error: {
              code: AUTH_ERRORS.EMAIL_ALREADY_EXISTS,
              message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.EMAIL_ALREADY_EXISTS]
            }
          };
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          email: updateData.email?.toLowerCase()
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return {
        success: true,
        data: { user: updatedUser }
      };
    } catch (error) {
      console.error('Update user error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user'
        }
      };
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string, businessId: string) {
    try {
      await setBusinessContext(businessId);

      // Check if user exists and belongs to business
      const user = await prisma.user.findFirst({
        where: { 
          id: userId,
          businessId 
        }
      });

      if (!user) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.USER_NOT_FOUND]
          }
        };
      }

      // Soft delete user
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date()
        }
      });

      return {
        success: true,
        data: { message: 'User deleted successfully' }
      };
    } catch (error) {
      console.error('Delete user error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete user'
        }
      };
    }
  }

  /**
   * Invite user to business
   */
  async inviteUser(businessId: string, inviterId: string, data: InviteUserRequest) {
    try {
      await setBusinessContext(businessId);

      // Check if email already exists
      const existingUser = await prisma.user.findFirst({
        where: { email: data.email.toLowerCase() }
      });

      if (existingUser) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.EMAIL_ALREADY_EXISTS,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.EMAIL_ALREADY_EXISTS]
          }
        };
      }

      // Get business and inviter info
      const [business, inviter] = await Promise.all([
        prisma.business.findUnique({
          where: { id: businessId },
          select: { name: true, slug: true }
        }),
        prisma.user.findUnique({
          where: { id: inviterId },
          select: { firstName: true, lastName: true }
        })
      ]);

      if (!business || !inviter) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.BUSINESS_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.BUSINESS_NOT_FOUND]
          }
        };
      }

      // Generate invitation token
      const invitationToken = generateInvitationToken();
      const invitationExpires = new Date(Date.now() + EMAIL_CONFIG.invitationExpiresHours * 60 * 60 * 1000);

      // Create invited user
      const invitedUser = await prisma.user.create({
        data: {
          businessId,
          email: data.email.toLowerCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          isActive: false,
          // invitationToken and invitationExpires not in schema
          passwordHash: '' // Will be set when they accept invitation
        }
      });

      // Send invitation email
      const emailSent = await emailService.sendInvitationEmail(
        data.email,
        data.firstName,
        `${inviter.firstName} ${inviter.lastName}`,
        business.name,
        data.role,
        invitationToken
      );

      if (!emailSent) {
        // If email failed, clean up the user record
        await prisma.user.delete({ where: { id: invitedUser.id } });
        return {
          success: false,
          error: {
            code: 'EMAIL_SEND_FAILED',
            message: 'Failed to send invitation email'
          }
        };
      }

      return {
        success: true,
        data: {
          user: {
            id: invitedUser.id,
            email: invitedUser.email,
            firstName: invitedUser.firstName,
            lastName: invitedUser.lastName,
            role: invitedUser.role,
            isActive: invitedUser.isActive
          }
        }
      };
    } catch (error) {
      console.error('Invite user error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to invite user'
        }
      };
    }
  }

  /**
   * Accept invitation
   */
  async acceptInvite(data: AcceptInviteRequest) {
    try {
      // For now, return error since invitation system needs schema updates
      return {
        success: false,
        error: {
          code: 'INVITATION_NOT_IMPLEMENTED',
          message: 'Invitation system requires schema updates'
        }
      };
    } catch (error) {
      console.error('Accept invite error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to accept invitation'
        }
      };
    }
  }

  /**
   * Change user role
   */
  async changeUserRole(userId: string, businessId: string, data: ChangeRoleRequest) {
    try {
      await setBusinessContext(businessId);

      // Check if user exists and belongs to business
      const user = await prisma.user.findFirst({
        where: { 
          id: userId,
          businessId 
        }
      });

      if (!user) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.USER_NOT_FOUND]
          }
        };
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: data.role },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return {
        success: true,
        data: { user: updatedUser }
      };
    } catch (error) {
      console.error('Change user role error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to change user role'
        }
      };
    }
  }

  /**
   * Activate/deactivate user
   */
  async changeUserStatus(userId: string, businessId: string, isActive: boolean) {
    try {
      await setBusinessContext(businessId);

      // Check if user exists and belongs to business
      const user = await prisma.user.findFirst({
        where: { 
          id: userId,
          businessId 
        }
      });

      if (!user) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.USER_NOT_FOUND]
          }
        };
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return {
        success: true,
        data: { user: updatedUser }
      };
    } catch (error) {
      console.error('Change user status error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to change user status'
        }
      };
    }
  }
}

// Export singleton instance
export const userService = new UserService();

