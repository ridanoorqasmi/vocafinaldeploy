import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyAccessToken, extractTokenFromHeader, validateUserSession } from './token-service';
import { setBusinessContext } from './auth';
import { AUTH_ERRORS, AUTH_ERROR_MESSAGES } from './auth-types';

const prisma = new PrismaClient();

// ===== NEXT.JS AUTHENTICATION MIDDLEWARE =====

/**
 * Authentication middleware for Next.js API routes
 */
export async function authenticateToken(request: NextRequest): Promise<{
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    businessId: string;
    businessSlug: string;
  };
  error?: any;
}> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return {
        success: false,
        error: {
          code: AUTH_ERRORS.TOKEN_INVALID,
          message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.TOKEN_INVALID]
        }
      };
    }

    // Verify token and get user session
    const session = await validateUserSession(token);
    if (!session) {
      return {
        success: false,
        error: {
          code: AUTH_ERRORS.TOKEN_INVALID,
          message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.TOKEN_INVALID]
        }
      };
    }

    // Set business context for RLS
    await setBusinessContext(session.user.businessId);

    return {
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        businessId: session.user.businessId,
        businessSlug: session.business.slug
      }
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during authentication'
      }
    };
  }
}

/**
 * Role-based access control for Next.js
 */
export function requireRole(allowedRoles: string[]) {
  return (user: any) => {
    if (!user) {
      return {
        success: false,
        error: {
          code: AUTH_ERRORS.TOKEN_INVALID,
          message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.TOKEN_INVALID]
        }
      };
    }

    if (!allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: {
          code: AUTH_ERRORS.INSUFFICIENT_PERMISSIONS,
          message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.INSUFFICIENT_PERMISSIONS]
        }
      };
    }

    return { success: true };
  };
}

/**
 * Business access control for Next.js
 */
export function requireBusinessAccess(businessId: string, user: any) {
  if (!user) {
    return {
      success: false,
      error: {
        code: AUTH_ERRORS.TOKEN_INVALID,
        message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.TOKEN_INVALID]
      }
    };
  }

  if (businessId !== user.businessId) {
    return {
      success: false,
      error: {
        code: AUTH_ERRORS.BUSINESS_NOT_FOUND,
        message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.BUSINESS_NOT_FOUND]
      }
    };
  }

  return { success: true };
}

/**
 * Rate limiting for Next.js (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(windowMs: number, maxRequests: number) {
  return (request: NextRequest) => {
    const key = request.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetTime < now) {
        rateLimitMap.delete(k);
      }
    }

    const current = rateLimitMap.get(key);
    
    if (!current) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return { success: true };
    }

    if (current.resetTime < now) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return { success: true };
    }

    if (current.count >= maxRequests) {
      return {
        success: false,
        error: {
          code: AUTH_ERRORS.RATE_LIMIT_EXCEEDED,
          message: AUTH_ERROR_MESSAGES[AUTH_ERRORS.RATE_LIMIT_EXCEEDED]
        }
      };
    }

    current.count++;
    return { success: true };
  };
}

/**
 * Auth rate limiter (5 requests per 15 minutes)
 */
export const authRateLimit = rateLimit(15 * 60 * 1000, 5);

/**
 * General rate limiter (100 requests per 15 minutes)
 */
export const generalRateLimit = rateLimit(15 * 60 * 1000, 100);

/**
 * Helper function to create error response
 */
export function createErrorResponse(error: any, status: number = 400) {
  return NextResponse.json({
    success: false,
    error,
    timestamp: new Date().toISOString()
  }, { status });
}

/**
 * Helper function to create success response
 */
export function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }, { status });
}
