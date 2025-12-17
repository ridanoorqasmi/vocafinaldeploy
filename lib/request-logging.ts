import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LogEntry {
  businessId?: string;
  userId?: string;
  method: string;
  path: string;
  query?: string;
  userAgent?: string;
  ipAddress?: string;
  requestSize?: number;
  responseStatus?: number;
  responseTime?: number;
  errorMessage?: string;
  metadata?: any;
}

export interface SecurityEvent {
  type: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'SUSPICIOUS_INPUT' | 'UNAUTHORIZED_ACCESS';
  businessId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Extracts client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (cfConnectingIP) return cfConnectingIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return request.ip || 'unknown';
}

/**
 * Determines if a request is suspicious based on various factors
 */
export function isSuspiciousRequest(request: NextRequest, body?: any): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const path = request.nextUrl.pathname;
  
  // Check for common attack patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /insert\s+into/i,
    /update\s+set/i,
    /exec\s*\(/i,
    /eval\s*\(/i
  ];
  
  // Check URL path
  if (suspiciousPatterns.some(pattern => pattern.test(path))) {
    return true;
  }
  
  // Check request body
  if (body && typeof body === 'string') {
    if (suspiciousPatterns.some(pattern => pattern.test(body))) {
      return true;
    }
  }
  
  // Check for suspicious user agents
  const suspiciousUserAgents = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'zap',
    'burp'
  ];
  
  if (suspiciousUserAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    return true;
  }
  
  // Check for unusually large requests
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
    return true;
  }
  
  return false;
}

/**
 * Logs a request to the database
 */
export async function logRequest(entry: LogEntry): Promise<void> {
  try {
    await prisma.queryLog.create({
      data: {
        businessId: entry.businessId || 'system',
        query: `${entry.method} ${entry.path}`,
        response: entry.errorMessage || `Status: ${entry.responseStatus}`,
        status: entry.responseStatus && entry.responseStatus < 400 ? 'SUCCESS' : 'ERROR',
        responseTime: entry.responseTime || 0,
        userAgent: entry.userAgent || 'unknown',
        ipAddress: entry.ipAddress || 'unknown',
        metadata: {
          ...entry.metadata,
          query: entry.query,
          requestSize: entry.requestSize,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Failed to log request:', error);
  }
}

/**
 * Logs a security event
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    await prisma.usageMetric.create({
      data: {
        businessId: event.businessId || 'system',
        type: 'SECURITY_EVENT',
        count: 1,
        metadata: {
          eventType: event.type,
          severity: event.severity,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          details: event.details,
          timestamp: new Date().toISOString()
        },
        date: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Creates a request logging middleware
 */
export function createRequestLoggingMiddleware() {
  return async (request: NextRequest, next: () => Promise<NextResponse>): Promise<NextResponse> => {
    const startTime = Date.now();
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const method = request.method;
    const path = request.nextUrl.pathname;
    const query = request.nextUrl.search;
    
    // Extract business ID from auth if available
    let businessId: string | undefined;
    let userId: string | undefined;
    
    try {
      const authHeader = request.headers.get('authorization');
      const apiKeyHeader = request.headers.get('x-api-key');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const { verifyToken } = await import('./auth');
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        if (payload) {
          businessId = payload.business_id;
          // Get user ID from database
          const { PrismaClient } = await import('@prisma/client');
          const prisma = new PrismaClient();
          const user = await prisma.user.findFirst({
            where: { email: payload.email, businessId: payload.business_id },
            select: { id: true }
          });
          userId = user?.id;
          await prisma.$disconnect();
        }
      } else if (apiKeyHeader) {
        const { validateApiKey } = await import('./api-key-service');
        const result = await validateApiKey(apiKeyHeader);
        if (result.success) {
          businessId = result.data?.businessId;
        }
      }
    } catch (error) {
      // Ignore auth extraction errors
    }
    
    // Check for suspicious requests
    const isSuspicious = isSuspiciousRequest(request);
    if (isSuspicious) {
      await logSecurityEvent({
        type: 'SUSPICIOUS_INPUT',
        businessId,
        ipAddress,
        userAgent,
        details: { path, method, query },
        severity: 'MEDIUM'
      });
    }
    
    // Get request size
    const contentLength = request.headers.get('content-length');
    const requestSize = contentLength ? parseInt(contentLength) : 0;
    
    let response: NextResponse;
    let errorMessage: string | undefined;
    
    try {
      // Process the request
      response = await next();
    } catch (error: any) {
      errorMessage = error.message;
      response = new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error'
          }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const responseTime = Date.now() - startTime;
    const responseStatus = response.status;
    
    // Log the request
    await logRequest({
      businessId,
      userId,
      method,
      path,
      query,
      userAgent,
      ipAddress,
      requestSize,
      responseStatus,
      responseTime,
      errorMessage,
      metadata: {
        isSuspicious,
        contentType: request.headers.get('content-type'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin')
      }
    });
    
    // Log security events for certain response codes
    if (responseStatus === 401) {
      await logSecurityEvent({
        type: 'AUTH_FAILURE',
        businessId,
        ipAddress,
        userAgent,
        details: { path, method },
        severity: 'MEDIUM'
      });
    } else if (responseStatus === 403) {
      await logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        businessId,
        ipAddress,
        userAgent,
        details: { path, method },
        severity: 'HIGH'
      });
    } else if (responseStatus === 429) {
      await logSecurityEvent({
        type: 'RATE_LIMIT',
        businessId,
        ipAddress,
        userAgent,
        details: { path, method },
        severity: 'LOW'
      });
    }
    
    // Add security headers to response
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    response.headers.set('X-Request-ID', crypto.randomUUID());
    
    return response;
  };
}

/**
 * Logs API usage metrics
 */
export async function logApiUsage(
  businessId: string,
  endpoint: string,
  method: string,
  responseTime: number,
  status: number
): Promise<void> {
  try {
    const operationType = method === 'GET' ? 'READ' : 
                         ['POST', 'PUT', 'PATCH'].includes(method) ? 'WRITE' : 'BULK';
    
    await prisma.usageMetric.create({
      data: {
        businessId,
        type: operationType,
        count: 1,
        metadata: {
          endpoint,
          method,
          responseTime,
          status,
          timestamp: new Date().toISOString()
        },
        date: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}

/**
 * Gets usage statistics for a business
 */
export async function getUsageStats(
  businessId: string,
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  try {
    const whereClause: any = { businessId };
    
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }
    
    const stats = await prisma.usageMetric.groupBy({
      by: ['type'],
      where: whereClause,
      _sum: { count: true },
      _count: { id: true }
    });
    
    return stats;
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    return [];
  }
}
