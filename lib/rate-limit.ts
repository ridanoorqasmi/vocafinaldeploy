import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RateLimitConfig {
  window: number; // Time window in milliseconds
  max: number;    // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  error?: any;
}

// Rate limit configurations for different endpoint types
export const RATE_LIMITS = {
  auth: { window: 15 * 60 * 1000, max: 10 },      // 10 per 15 min
  read: { window: 60 * 1000, max: 10 },           // 10 per minute for testing
  write: { window: 60 * 1000, max: 5 },           // 5 per minute for testing
  bulk: { window: 60 * 1000, max: 3 },            // 3 per minute for testing
  api_key: { window: 60 * 1000, max: 20 }         // 20 per minute for API keys
};

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Generates a rate limit key based on request
 */
export function generateRateLimitKey(request: NextRequest, type: string): string {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // For business-specific limits, try to get business ID from auth
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');
  
  if (authHeader || apiKeyHeader) {
    // We'll extract business ID in the rate limit function
    return `${type}:business:${ip}`;
  }
  
  return `${type}:ip:${ip}`;
}

/**
 * Extracts business ID from request for business-specific rate limiting
 */
async function getBusinessIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    const apiKeyHeader = request.headers.get('x-api-key');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // JWT token - extract business ID
      const token = authHeader.substring(7);
      const { verifyToken } = await import('./auth');
      const payload = verifyToken(token);
      return payload?.business_id || null;
    } else if (apiKeyHeader) {
      // API key - validate and get business ID
      const { validateApiKey } = await import('./api-key-service');
      const result = await validateApiKey(apiKeyHeader);
      return result.success ? result.data?.businessId : null;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting business ID:', error);
    return null;
  }
}

/**
 * Checks rate limit for a request
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  type: string = 'default'
): Promise<RateLimitResult> {
  try {
    const businessId = await getBusinessIdFromRequest(request);
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    
    // Generate rate limit key
    let key: string;
    if (businessId) {
      key = `${type}:business:${businessId}`;
    } else {
      key = `${type}:ip:${ip}`;
    }
    
    const now = Date.now();
    const windowStart = now - config.window;
    
    // Get current rate limit data
    let rateLimitData = rateLimitStore.get(key);
    
    if (!rateLimitData || rateLimitData.resetTime <= now) {
      // Initialize or reset rate limit
      rateLimitData = {
        count: 0,
        resetTime: now + config.window
      };
    }
    
    // Check if limit exceeded
    if (rateLimitData.count >= config.max) {
      const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);
      
      // Log rate limit hit
      await logRateLimitHit(businessId, ip, type, config.max);
      
      return {
        success: false,
        limit: config.max,
        remaining: 0,
        resetTime: rateLimitData.resetTime,
        retryAfter,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
        }
      };
    }
    
    // Increment counter
    rateLimitData.count++;
    rateLimitStore.set(key, rateLimitData);
    
    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance
      cleanupExpiredEntries();
    }
    
    return {
      success: true,
      limit: config.max,
      remaining: config.max - rateLimitData.count,
      resetTime: rateLimitData.resetTime
    };
  } catch (error: any) {
    console.error('Rate limit check error:', error);
    return {
      success: false,
      limit: config.max,
      remaining: 0,
      resetTime: Date.now() + config.window,
      error: {
        code: 'RATE_LIMIT_ERROR',
        message: 'Rate limit check failed'
      }
    };
  }
}

/**
 * Logs rate limit hits to database
 */
async function logRateLimitHit(
  businessId: string | null,
  ip: string,
  type: string,
  limit: number
): Promise<void> {
  try {
    await prisma.usageMetric.create({
      data: {
        businessId: businessId || 'unknown',
        type: 'RATE_LIMIT_HIT',
        count: 1,
        metadata: {
          ip,
          type,
          limit,
          timestamp: new Date().toISOString()
        },
        date: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log rate limit hit:', error);
  }
}

/**
 * Cleans up expired rate limit entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Middleware factory for rate limiting
 */
export function createRateLimitMiddleware(config: RateLimitConfig, type: string = 'default') {
  return async (request: NextRequest): Promise<{ success: boolean; data?: RateLimitResult; error?: any }> => {
    const result = await checkRateLimit(request, config, type);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }
    
    return {
      success: true,
      data: result
    };
  };
}

/**
 * Determines rate limit type based on request path and method
 */
export function getRateLimitType(request: NextRequest): string {
  const path = request.nextUrl.pathname;
  const method = request.method;
  
  // Authentication endpoints
  if (path.includes('/auth/')) {
    return 'auth';
  }
  
  // Bulk operations
  if (method === 'DELETE' || path.includes('/bulk')) {
    return 'bulk';
  }
  
  // Write operations
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    return 'write';
  }
  
  // Read operations
  if (method === 'GET') {
    return 'read';
  }
  
  return 'default';
}

/**
 * Gets appropriate rate limit config for request
 */
export function getRateLimitConfig(request: NextRequest): RateLimitConfig {
  const type = getRateLimitType(request);
  const apiKeyHeader = request.headers.get('x-api-key');
  
  // API key requests get higher limits
  if (apiKeyHeader) {
    return RATE_LIMITS.api_key;
  }
  
  return RATE_LIMITS[type as keyof typeof RATE_LIMITS] || RATE_LIMITS.read;
}

/**
 * Simple rate limit function
 */
export function rateLimit(request: NextRequest): { success: boolean; error?: any } {
  return { success: true };
}