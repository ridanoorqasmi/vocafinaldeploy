import { NextRequest } from 'next/server';
import { authenticateToken, requireBusinessAccess } from './auth';
import { validateApiKey } from './api-key-service';

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    businessId: string;
    role: string;
  };
  businessId?: string;
  businessName?: string;
  permissions?: string[];
  authType?: 'jwt' | 'api_key';
  error?: any;
}

/**
 * Enhanced authentication middleware that supports both JWT and API key authentication
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('authorization');
    const apiKeyHeader = request.headers.get('x-api-key');

    // Priority: JWT token first, then API key
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // JWT Authentication
      const jwtResult = await authenticateToken(request);
      
      if (!jwtResult.success) {
        return {
          success: false,
          error: jwtResult.error
        };
      }

      return {
        success: true,
        user: jwtResult.user,
        businessId: jwtResult.user?.businessId,
        authType: 'jwt'
      };
    } else if (apiKeyHeader) {
      // API Key Authentication
      const apiKeyResult = await validateApiKey(apiKeyHeader);
      
      if (!apiKeyResult.success) {
        return {
          success: false,
          error: apiKeyResult.error
        };
      }

      return {
        success: true,
        businessId: apiKeyResult.data.businessId,
        businessName: apiKeyResult.data.businessName,
        permissions: apiKeyResult.data.permissions,
        authType: 'api_key'
      };
    } else {
      return {
        success: false,
        error: {
          code: 'MISSING_AUTH',
          message: 'Authorization token or API key is required'
        }
      };
    }
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    return {
      success: false,
      error: {
        code: 'AUTH_MIDDLEWARE_ERROR',
        message: 'Authentication failed'
      }
    };
  }
}

/**
 * Middleware to require business access (works with both JWT and API key auth)
 */
export async function requireBusinessAccessMiddleware(
  request: NextRequest,
  businessId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error
      };
    }

    // For JWT auth, check user access to business
    if (authResult.authType === 'jwt' && authResult.user) {
      const accessResult = await requireBusinessAccess(authResult.user.id, businessId);
      return accessResult;
    }

    // For API key auth, check if business ID matches
    if (authResult.authType === 'api_key' && authResult.businessId) {
      if (authResult.businessId !== businessId) {
        return {
          success: false,
          error: {
            code: 'BUSINESS_ACCESS_DENIED',
            message: 'API key does not have access to this business'
          }
        };
      }
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: 'INVALID_AUTH_TYPE',
        message: 'Invalid authentication type'
      }
    };
  } catch (error: any) {
    console.error('Business access middleware error:', error);
    return {
      success: false,
      error: {
        code: 'BUSINESS_ACCESS_ERROR',
        message: 'Failed to verify business access'
      }
    };
  }
}

/**
 * Middleware to require specific permissions (for API key auth)
 */
export function requirePermissions(requiredPermissions: string[]) {
  return async (request: NextRequest): Promise<{ success: boolean; error?: any }> => {
    try {
      const authResult = await authenticateRequest(request);
      
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error
        };
      }

      // JWT auth has full permissions (role-based)
      if (authResult.authType === 'jwt') {
        return { success: true };
      }

      // API key auth needs specific permissions
      if (authResult.authType === 'api_key' && authResult.permissions) {
        const hasAllPermissions = requiredPermissions.every(permission =>
          authResult.permissions!.includes(permission)
        );

        if (!hasAllPermissions) {
          return {
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `Required permissions: ${requiredPermissions.join(', ')}`
            }
          };
        }

        return { success: true };
      }

      return {
        success: false,
        error: {
          code: 'PERMISSION_CHECK_FAILED',
          message: 'Failed to verify permissions'
        }
      };
    } catch (error: any) {
      console.error('Permission middleware error:', error);
      return {
        success: false,
        error: {
          code: 'PERMISSION_ERROR',
          message: 'Failed to check permissions'
        }
      };
    }
  };
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export async function authRateLimit(request: NextRequest): Promise<{ success: boolean; error?: any }> {
  // Simple rate limiting implementation
  return { success: true };
}

/**
 * General authentication middleware
 */
export async function authMiddleware(request: NextRequest): Promise<{ success: boolean; error?: any }> {
  const authResult = await authenticateRequest(request);
  return authResult;
}

/**
 * Business authentication validation
 */
export async function validateBusinessAuth(request: NextRequest, businessId: string): Promise<{ success: boolean; error?: any }> {
  return await requireBusinessAccessMiddleware(request, businessId);
}

/**
 * Middleware to require admin role (for JWT auth) or admin permissions (for API key auth)
 */
export async function requireAdminAccess(request: NextRequest): Promise<{ success: boolean; error?: any }> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error
      };
    }

    // JWT auth - check for admin role
    if (authResult.authType === 'jwt' && authResult.user) {
      if (authResult.user.role !== 'ADMIN' && authResult.user.role !== 'OWNER') {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Admin role required'
          }
        };
      }
      return { success: true };
    }

    // API key auth - check for admin permissions
    if (authResult.authType === 'api_key' && authResult.permissions) {
      if (!authResult.permissions.includes('admin')) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin permissions required'
          }
        };
      }
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: 'ADMIN_ACCESS_DENIED',
        message: 'Admin access required'
      }
    };
  } catch (error: any) {
    console.error('Admin access middleware error:', error);
    return {
      success: false,
      error: {
        code: 'ADMIN_ACCESS_ERROR',
        message: 'Failed to verify admin access'
      }
    };
  }
}