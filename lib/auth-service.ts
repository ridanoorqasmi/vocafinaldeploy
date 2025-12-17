import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword, validatePasswordStrength, generateVerificationToken, generateInvitationToken } from './password';
import { generateTokens, invalidateRefreshToken } from './token-service';
import { emailService } from './email-service';
import { setBusinessContext } from './auth';
import { 
  RegisterRequest, 
  LoginRequest, 
  ForgotPasswordRequest, 
  ResetPasswordRequest, 
  VerifyEmailRequest,
  InviteUserRequest,
  AcceptInviteRequest,
  AuthResponse,
  AUTH_ERRORS,
  AUTH_ERROR_MESSAGES,
  EMAIL_CONFIG
} from './auth-types';

const prisma = new PrismaClient();

// ===== AUTHENTICATION SERVICE =====

export class AuthService {
  /**
   * Register new business and admin user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
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

      // Check if business slug already exists
      const existingBusiness = await prisma.business.findFirst({
        where: { slug: data.businessSlug.toLowerCase() }
      });

      if (existingBusiness) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.SLUG_ALREADY_EXISTS,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.SLUG_ALREADY_EXISTS]
          }
        };
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(data.password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.PASSWORD_TOO_WEAK,
            message: passwordValidation.errors.join(', ')
          }
        };
      }

      // Hash password once before transaction
      const passwordHash = await hashPassword(data.password);

      // Create business and user in transaction with increased timeout
      const result = await prisma.$transaction(async (tx) => {
        // Create business
        const business = await tx.business.create({
          data: {
            name: data.businessName,
            slug: data.businessSlug.toLowerCase(),
            email: data.email.toLowerCase(),
            passwordHash: passwordHash,
            status: 'TRIAL',
            phone: data.phone,
            timezone: data.timezone || 'UTC',
            currency: 'USD',
            language: 'en'
          }
        });

        // Create admin user
        const user = await tx.user.create({
          data: {
            businessId: business.id,
            email: data.email.toLowerCase(),
            passwordHash: passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            role: 'ADMIN',
            isActive: true
          }
        });

        return { business, user };
      }, {
        timeout: 10000, // Increase timeout to 10 seconds
        isolationLevel: 'ReadCommitted'
      });

      // Send welcome email (temporarily disabled)
      // await emailService.sendWelcomeEmail(
      //   data.email,
      //   data.firstName,
      //   'email-verification-not-implemented'
      // );

      // Generate tokens
      const tokens = generateTokens({
        id: result.user.id,
        businessId: result.business.id,
        role: result.user.role,
        email: result.user.email,
        businessSlug: result.business.slug
      });

      return {
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            role: result.user.role,
            isActive: result.user.isActive
          },
          business: {
            id: result.business.id,
            name: result.business.name,
            slug: result.business.slug,
            status: result.business.status
          },
          tokens
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Registration failed. Please try again.'
        }
      };
    }
  }

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await prisma.user.findFirst({
        where: { email: data.email.toLowerCase() },
        include: { business: true }
      });

      if (!user) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.INVALID_CREDENTIALS,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.INVALID_CREDENTIALS]
          }
        };
      }

      // Check if user is active
      if (!user.isActive) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.ACCOUNT_SUSPENDED,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.ACCOUNT_SUSPENDED]
          }
        };
      }

      // Email verification not implemented in current schema
      // if (!user.emailVerified) {
      //   return {
      //     success: false,
      //     error: {
      //       code: AUTH_ERRORS.EMAIL_NOT_VERIFIED,
      //       message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.EMAIL_NOT_VERIFIED]
      //     }
      //   };
      // }

      // Verify password
      const passwordValid = await comparePassword(data.password, user.passwordHash);
      if (!passwordValid) {
        return {
          success: false,
          error: {
            code: AUTH_ERRORS.INVALID_CREDENTIALS,
            message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.INVALID_CREDENTIALS]
          }
        };
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Generate tokens
      const tokens = generateTokens({
        id: user.id,
        businessId: user.businessId,
        role: user.role,
        email: user.email,
        businessSlug: user.business.slug
      });

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive
          },
          business: {
            id: user.business.id,
            name: user.business.name,
            slug: user.business.slug,
            status: user.business.status
          },
          tokens
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Login failed. Please try again.'
        }
      };
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(data: VerifyEmailRequest): Promise<AuthResponse> {
    try {
      // For now, just return success since email verification fields don't exist in schema
      // In a real implementation, you'd add these fields to the User model

      return {
        success: true,
        data: {
          user: {
            id: '',
            email: '',
            firstName: '',
            lastName: '',
            role: 'STAFF',
            isActive: false
          },
          business: {
            id: '',
            name: '',
            slug: '',
            status: 'ACTIVE'
          },
          tokens: {
            accessToken: '',
            refreshToken: '',
            expiresIn: 0
          }
        }
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Email verification failed. Please try again.'
        }
      };
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<AuthResponse> {
    try {
      const user = await prisma.user.findFirst({
        where: { email: data.email.toLowerCase() }
      });

      if (!user) {
        // Don't reveal if email exists or not
        return {
          success: true,
          data: {
            user: {
              id: '',
              email: '',
              firstName: '',
              lastName: '',
              role: '',
              isActive: false
            },
            business: {
              id: '',
              name: '',
              slug: '',
              status: ''
            },
            tokens: {
              accessToken: '',
              refreshToken: '',
              expiresIn: 0
            }
          }
        };
      }

      // Generate reset token
      const resetToken = generateVerificationToken();
      // Password reset token fields not in schema
      // await prisma.user.update({
      //   where: { id: user.id },
      //   data: {
      //     passwordResetToken: resetToken,
      //     passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      //   }
      // });

      // Send reset email
      await emailService.sendPasswordResetEmail(
        user.email,
        user.firstName,
        resetToken
      );

      return {
        success: true,
        data: {
          user: {
            id: '',
            email: '',
            firstName: '',
            lastName: '',
            role: '',
            isActive: false
          },
          business: {
            id: '',
            name: '',
            slug: '',
            status: ''
          },
          tokens: {
            accessToken: '',
            refreshToken: '',
            expiresIn: 0
          }
        }
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Password reset request failed. Please try again.'
        }
      };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(data: ResetPasswordRequest): Promise<AuthResponse> {
    try {
      // Password reset token fields not in schema
      // For now, return error since password reset requires schema updates
      return {
        success: false,
        error: {
          code: 'PASSWORD_RESET_NOT_IMPLEMENTED',
          message: 'Password reset requires schema updates'
        }
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Password reset failed. Please try again.'
        }
      };
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<AuthResponse> {
    try {
      // Invalidate refresh token
      await invalidateRefreshToken(userId);

      return {
        success: true,
        data: {
          user: {
            id: '',
            email: '',
            firstName: '',
            lastName: '',
            role: '',
            isActive: false
          },
          business: {
            id: '',
            name: '',
            slug: '',
            status: ''
          },
          tokens: {
            accessToken: '',
            refreshToken: '',
            expiresIn: 0
          }
        }
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Logout failed. Please try again.'
        }
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

