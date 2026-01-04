/**
 * Phase 4: Rate Limiting for Agent Endpoints
 * Per-tenant rate limiting to prevent abuse
 */

import { NextRequest } from 'next/server';

// In-memory store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface AgentRateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  error?: string;
}

// Rate limit configurations for agent endpoints
export const AGENT_RATE_LIMITS: Record<string, AgentRateLimitConfig> = {
  agent_message: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 per minute
  kb_query: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 per minute
  db_query: { windowMs: 60 * 1000, maxRequests: 15 }, // 15 per minute
  ticket_create: { windowMs: 60 * 1000, maxRequests: 10 }, // 10 per minute
  default: { windowMs: 60 * 1000, maxRequests: 20 } // Default: 20 per minute
};

/**
 * Generates a rate limit key for tenant-based limiting
 */
function generateRateLimitKey(tenantId: string, endpointType: string): string {
  return `agent:${endpointType}:tenant:${tenantId}`;
}

/**
 * Checks rate limit for an agent endpoint
 */
export async function checkAgentRateLimit(
  tenantId: string,
  endpointType: string = 'default'
): Promise<RateLimitResult> {
  const config = AGENT_RATE_LIMITS[endpointType] || AGENT_RATE_LIMITS.default;
  const key = generateRateLimitKey(tenantId, endpointType);
  const now = Date.now();

  // Get current rate limit data
  let rateLimitData = rateLimitStore.get(key);

  if (!rateLimitData || rateLimitData.resetTime <= now) {
    // Initialize or reset rate limit
    rateLimitData = {
      count: 0,
      resetTime: now + config.windowMs
    };
  }

  // Check if limit exceeded
  if (rateLimitData.count >= config.maxRequests) {
    const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetTime: rateLimitData.resetTime,
      retryAfter,
      error: `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds. Try again in ${retryAfter} seconds.`
    };
  }

  // Increment counter
  rateLimitData.count++;
  rateLimitStore.set(key, rateLimitData);

  // Clean up expired entries periodically (1% chance)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  return {
    allowed: true,
    remaining: config.maxRequests - rateLimitData.count,
    resetTime: rateLimitData.resetTime
  };
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
 * Gets rate limit info without incrementing counter (for headers)
 */
export function getRateLimitInfo(
  tenantId: string,
  endpointType: string = 'default'
): { limit: number; remaining: number; resetTime: number } {
  const config = AGENT_RATE_LIMITS[endpointType] || AGENT_RATE_LIMITS.default;
  const key = generateRateLimitKey(tenantId, endpointType);
  const data = rateLimitStore.get(key);

  if (!data || data.resetTime <= Date.now()) {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs
    };
  }

  return {
    limit: config.maxRequests,
    remaining: config.maxRequests - data.count,
    resetTime: data.resetTime
  };
}














