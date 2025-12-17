import { NextRequest, NextResponse } from 'next/server'
import { verify } from 'jsonwebtoken'

interface JWTPayload {
  userId: string
  businessId: string
  role: string
  email: string
  businessSlug: string
  iat?: number
  exp?: number
}

/**
 * Authenticate followup agent requests
 */
export async function authenticateFollowupRequest(request: NextRequest): Promise<{
  success: boolean
  user?: JWTPayload
  error?: { code: string; message: string }
}> {
  try {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization')
    let token: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // Try to get from cookie
      const cookieToken = request.cookies.get('followup_auth_token')?.value
      if (cookieToken) {
        token = cookieToken
      }
    }

    if (!token) {
      return {
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authentication token is required'
        }
      }
    }

    // Verify token
    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('JWT_SECRET is not set')
      return {
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Server configuration error'
        }
      }
    }

    const decoded = verify(token, secret) as JWTPayload

    return {
      success: true,
      user: {
        userId: decoded.userId,
        businessId: decoded.businessId,
        role: decoded.role,
        email: decoded.email,
        businessSlug: decoded.businessSlug
      }
    }

  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return {
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired'
        }
      }
    }

    if (error.name === 'JsonWebTokenError') {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token'
        }
      }
    }

    console.error('Auth middleware error:', error)
    return {
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    }
  }
}

/**
 * Get user ID from request (for use in API routes)
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const auth = await authenticateFollowupRequest(request)
  return auth.success && auth.user ? auth.user.userId : null
}

