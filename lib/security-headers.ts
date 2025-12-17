import { NextRequest, NextResponse } from 'next/server';

export interface SecurityConfig {
  enableCORS: boolean;
  allowedOrigins: string[];
  enableSecurityHeaders: boolean;
  enableCSP: boolean;
  maxRequestSize: number;
  trustProxy: boolean;
}

// Default security configuration
export const defaultSecurityConfig: SecurityConfig = {
  enableCORS: process.env.ENABLE_CORS === 'true',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  enableSecurityHeaders: process.env.SECURITY_HEADERS_ENABLED !== 'false',
  enableCSP: process.env.ENABLE_CSP === 'true',
  maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760'), // 10MB default
  trustProxy: process.env.TRUST_PROXY === 'true'
};

/**
 * Checks if origin is allowed for CORS
 */
export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  return allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed === origin) return true;
    
    // Support for wildcard subdomains
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      return origin.endsWith(domain);
    }
    
    return false;
  });
}

/**
 * Sets security headers on response
 */
export function setSecurityHeaders(response: NextResponse, config: SecurityConfig = defaultSecurityConfig, request?: NextRequest): NextResponse {
  if (!config.enableSecurityHeaders) return response;
  
  // CORS headers
  if (config.enableCORS) {
    const origin = request?.headers.get('origin');
    if (origin && isOriginAllowed(origin, config.allowedOrigins)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS (only for HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy
  if (config.enableCSP) {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    
    response.headers.set('Content-Security-Policy', csp);
  }
  
  // Remove server information
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');
  
  return response;
}

/**
 * CORS middleware
 */
export function createCORSMiddleware(config: SecurityConfig = defaultSecurityConfig) {
  return async (request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> => {
    if (!config.enableCORS) {
      return await next();
    }
    
    const origin = request.headers.get('origin');
    const method = request.method;
    
    // Handle preflight requests
    if (method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });
      
      if (origin && isOriginAllowed(origin, config.allowedOrigins)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
        response.headers.set('Access-Control-Max-Age', '86400');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
      
      return setSecurityHeaders(response, config);
    }
    
    // Process the request
    const response = await next();
    
    // Set CORS headers for actual requests
    if (origin && isOriginAllowed(origin, config.allowedOrigins)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    return setSecurityHeaders(response, config);
  };
}

/**
 * Request size limiting middleware
 */
export function createRequestSizeMiddleware(config: SecurityConfig = defaultSecurityConfig) {
  return async (request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> => {
    const contentLength = request.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength) > config.maxRequestSize) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: `Request size exceeds maximum allowed size of ${config.maxRequestSize} bytes`
          }
        }),
        { 
          status: 413, 
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return await next();
  };
}

/**
 * IP blocking middleware (basic implementation)
 */
export function createIPBlockingMiddleware(blockedIPs: string[] = []) {
  return async (request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> => {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    
    if (blockedIPs.includes(ip)) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'IP_BLOCKED',
            message: 'Access denied from this IP address'
          }
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return await next();
  };
}

/**
 * Security headers middleware
 */
export function createSecurityHeadersMiddleware(config: SecurityConfig = defaultSecurityConfig) {
  return async (request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> => {
    const response = await next();
    return setSecurityHeaders(response, config);
  };
}

/**
 * Comprehensive security middleware that combines all security features
 */
export function createSecurityMiddleware(config: SecurityConfig = defaultSecurityConfig) {
  return async (request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> => {
    // Apply security middleware in order
    let response: NextResponse;
    
    try {
      // 1. Request size limiting
      const sizeMiddleware = createRequestSizeMiddleware(config);
      response = await sizeMiddleware(request, async () => {
        // 2. CORS handling
        const corsMiddleware = createCORSMiddleware(config);
        return await corsMiddleware(request, next);
      });
    } catch (error: any) {
      console.error('Security middleware error:', error);
      response = new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'SECURITY_ERROR',
            message: 'Security middleware failed'
          }
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // 3. Security headers and CORS for all responses
    response = setSecurityHeaders(response, config, request);
    
    return response;
  };
}

/**
 * Validates request headers for security
 */
export function validateRequestHeaders(request: NextRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for suspicious headers
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-originating-ip',
    'x-remote-ip',
    'x-remote-addr'
  ];
  
  for (const header of suspiciousHeaders) {
    if (request.headers.get(header)) {
      errors.push(`Suspicious header detected: ${header}`);
    }
  }
  
  // Check content type for POST/PUT/PATCH requests
  const method = request.method;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      errors.push('Invalid content type for request body');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Rate limiting headers helper
 */
export function addRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetTime: number
): NextResponse {
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
  
  return response;
}
