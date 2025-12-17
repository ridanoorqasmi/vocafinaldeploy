import { NextRequest, NextResponse } from 'next/server';

export interface CorsConfig {
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

// Default CORS configuration
export const defaultCorsConfig: CorsConfig = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

/**
 * Checks if origin is allowed
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
 * Sets CORS headers on response
 */
export function setCorsHeaders(response: NextResponse, origin: string | null, config: CorsConfig = defaultCorsConfig): NextResponse {
  const allowedOrigins = Array.isArray(config.origin) ? config.origin : [config.origin as string];
  
  // Set Access-Control-Allow-Origin
  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (config.origin === '*' || config.origin === true) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  // Set other CORS headers
  response.headers.set('Access-Control-Allow-Methods', config.methods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  response.headers.set('Access-Control-Max-Age', config.maxAge.toString());
  
  if (config.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return response;
}

/**
 * Handles preflight OPTIONS requests
 */
export function handlePreflightRequest(request: NextRequest, config: CorsConfig = defaultCorsConfig): NextResponse {
  const origin = request.headers.get('origin');
  const allowedOrigins = Array.isArray(config.origin) ? config.origin : [config.origin as string];
  
  const response = new NextResponse(null, { status: 200 });
  
  // Set CORS headers
  setCorsHeaders(response, origin, config);
  
  return response;
}

/**
 * CORS middleware for Next.js API routes
 */
export function withCors(handler: Function, config: CorsConfig = defaultCorsConfig) {
  return async (request: NextRequest, context: any) => {
    const origin = request.headers.get('origin');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handlePreflightRequest(request, config);
    }
    
    // Process the actual request
    const response = await handler(request, context);
    
    // Set CORS headers on the response
    return setCorsHeaders(response, origin, config);
  };
}

/**
 * Simple CORS middleware that can be used in API routes
 */
export function corsMiddleware(request: NextRequest, response: NextResponse, config: CorsConfig = defaultCorsConfig): NextResponse {
  const origin = request.headers.get('origin');
  return setCorsHeaders(response, origin, config);
}

/**
 * Creates a CORS-enabled response
 */
export function createCorsResponse(data: any, status: number = 200, request: NextRequest, config: CorsConfig = defaultCorsConfig): NextResponse {
  const response = new NextResponse(
    JSON.stringify(data),
    { 
      status, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
  
  return corsMiddleware(request, response, config);
}

/**
 * CORS configuration for different environments
 */
export const corsConfigs = {
  development: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
    maxAge: 86400
  },
  
  production: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
    maxAge: 86400
  }
};

/**
 * Gets appropriate CORS config for current environment
 */
export function getCorsConfig(): CorsConfig {
  const env = process.env.NODE_ENV || 'development';
  return corsConfigs[env as keyof typeof corsConfigs] || defaultCorsConfig;
}
