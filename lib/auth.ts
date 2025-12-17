import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface JWTPayload {
  business_id: string
  email: string
  business_name: string
  iat: number
  exp: number
}

export interface AuthUser {
  id: string
  email: string
  businessId: string
  role: string
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key') as JWTPayload
    return decoded
  } catch (error) {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as JWTPayload
    if (!decoded || !decoded.exp) return true
    
    const currentTime = Math.floor(Date.now() / 1000)
    return decoded.exp < currentTime
  } catch (error) {
    return true
  }
}

export function getBusinessIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload
    return decoded?.business_id || null
  } catch (error) {
    return null
  }
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret-key', { expiresIn: '7d' })
}

// ===== RLS (ROW-LEVEL SECURITY) HELPER FUNCTIONS =====

/**
 * Sets the current business context for RLS policies
 * This function must be called before any database operations to ensure tenant isolation
 * @param businessId - The business ID to set as current context
 */
export async function setBusinessContext(businessId: string): Promise<void> {
  try {
    await prisma.$executeRaw`SELECT set_current_business_id(${businessId})`
  } catch (error) {
    console.error('Failed to set business context:', error)
    throw new Error('Failed to set business context for RLS')
  }
}

/**
 * Gets the current business context from the database session
 * @returns The current business ID or null if not set
 */
export async function getCurrentBusinessContext(): Promise<string | null> {
  try {
    const result = await prisma.$queryRaw<[{ get_current_business_id: string | null }]>`
      SELECT get_current_business_id() as get_current_business_id
    `
    return result[0]?.get_current_business_id || null
  } catch (error) {
    console.error('Failed to get business context:', error)
    return null
  }
}

/**
 * Middleware function to set business context from JWT token
 * Use this in API routes to automatically set the business context
 * @param token - JWT token containing business_id
 */
export async function setBusinessContextFromToken(token: string): Promise<void> {
  const payload = verifyToken(token)
  if (!payload || !payload.business_id) {
    throw new Error('Invalid token or missing business_id')
  }
  
  await setBusinessContext(payload.business_id)
}

/**
 * Creates a Prisma client with business context set
 * Use this for database operations that need tenant isolation
 * @param businessId - The business ID to set as context
 * @returns Prisma client with business context
 */
export function createBusinessScopedClient(businessId: string) {
  const client = new PrismaClient()
  
  // Set business context before any operations
  client.$use(async (params, next) => {
    await setBusinessContext(businessId)
    return next(params)
  })
  
  return client
}

/**
 * Validates that a business ID exists and is active
 * @param businessId - The business ID to validate
 * @returns Promise<boolean> - True if business exists and is active
 */
export async function validateBusinessAccess(businessId: string): Promise<boolean> {
  try {
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        status: {
          in: ['ACTIVE', 'TRIAL']
        },
        deletedAt: null
      },
      select: { id: true }
    })
    
    return !!business
  } catch (error) {
    console.error('Failed to validate business access:', error)
    return false
  }
}

// ===== AUTHENTICATION MIDDLEWARE FUNCTIONS =====

/**
 * Authenticates a JWT token and returns user information
 * @param request - Next.js request object
 * @returns Promise<{success: boolean, user?: AuthUser, error?: any}>
 */
export async function authenticateToken(request: any): Promise<{success: boolean, user?: AuthUser, error?: any}> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization token is required'
        }
      }
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    // Verify token
    const payload = verifyToken(token)
    if (!payload) {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      }
    }

    // Get user from database
    const user = await prisma.user.findFirst({
      where: {
        email: payload.email,
        businessId: payload.business_id,
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        businessId: true,
        role: true
      }
    })

    if (!user) {
      return {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found or inactive'
        }
      }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        businessId: user.businessId,
        role: user.role
      }
    }
  } catch (error: any) {
    console.error('Authentication error:', error)
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
 * Extract business ID from request
 */
export function getBusinessIdFromRequest(req: Request): string | null {
  // Extract business ID from headers, token, or session
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return getBusinessIdFromToken(token);
  }
  return null;
}

/**
 * Checks if user has access to a specific business
 * @param userId - User ID
 * @param businessId - Business ID to check access for
 * @returns Promise<{success: boolean, error?: any}>
 */
export async function requireBusinessAccess(userId: string, businessId: string): Promise<{success: boolean, error?: any}> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId: businessId,
        deletedAt: null,
        isActive: true
      },
      select: { id: true }
    })

    if (!user) {
      return {
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'User does not have access to this business'
        }
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Business access check error:', error)
    return {
      success: false,
      error: {
        code: 'ACCESS_CHECK_ERROR',
        message: 'Failed to verify business access'
      }
    }
  }
}
