/**
 * Phase 6: Usage Limits & Cost Control
 * Data Analyst Agent (Poppy) - Token Limits & Rate Limiting
 */

import { getTokenUsage, getTenantTokenUsage } from './store';
import type { TokenUsage } from './types';

// Configuration
const MAX_TOKENS_PER_REQUEST = 100000; // 100k tokens per request
const MAX_REQUESTS_PER_MINUTE = 60; // 60 requests per minute
const MAX_REQUESTS_PER_DAY = 1000; // 1000 requests per day per tenant
const MAX_TOKENS_PER_DAY = 10000000; // 10M tokens per day per tenant

// Rate limiting stores (in-memory, would use Redis in production)
const requestCountsByUser = new Map<string, { count: number; resetAt: number }>();
const requestCountsByTenant = new Map<string, { count: number; resetAt: number }>();
const dailyTokenUsageByTenant = new Map<string, { tokens: number; date: string }>();

/**
 * Check if request exceeds token limit
 */
export function checkTokenLimit(tokens: number): { allowed: boolean; error?: string } {
  if (tokens > MAX_TOKENS_PER_REQUEST) {
    return {
      allowed: false,
      error: `Request exceeds maximum token limit of ${MAX_TOKENS_PER_REQUEST} tokens`,
    };
  }
  return { allowed: true };
}

/**
 * Check rate limit for user
 */
export function checkRateLimit(userId: string): { allowed: boolean; error?: string; retryAfter?: number } {
  const now = Date.now();
  const userLimit = requestCountsByUser.get(userId);

  if (userLimit && userLimit.resetAt > now) {
    if (userLimit.count >= MAX_REQUESTS_PER_MINUTE) {
      const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
      return {
        allowed: false,
        error: `Rate limit exceeded: ${MAX_REQUESTS_PER_MINUTE} requests per minute`,
        retryAfter,
      };
    }
    userLimit.count++;
  } else {
    requestCountsByUser.set(userId, {
      count: 1,
      resetAt: now + 60000, // 1 minute
    });
  }

  return { allowed: true };
}

/**
 * Check daily request limit for tenant
 */
export function checkDailyRequestLimit(tenantId: string): { allowed: boolean; error?: string } {
  const today = new Date().toISOString().split('T')[0];
  const tenantLimit = requestCountsByTenant.get(tenantId);

  if (tenantLimit && tenantLimit.date === today) {
    if (tenantLimit.count >= MAX_REQUESTS_PER_DAY) {
      return {
        allowed: false,
        error: `Daily request limit exceeded: ${MAX_REQUESTS_PER_DAY} requests per day`,
      };
    }
    tenantLimit.count++;
  } else {
    requestCountsByTenant.set(tenantId, {
      count: 1,
      date: today,
    });
  }

  return { allowed: true };
}

/**
 * Check daily token limit for tenant
 */
export function checkDailyTokenLimit(tenantId: string, newTokens: number): { allowed: boolean; error?: string } {
  const today = new Date().toISOString().split('T')[0];
  const tenantUsage = dailyTokenUsageByTenant.get(tenantId);

  let currentUsage = 0;
  if (tenantUsage && tenantUsage.date === today) {
    currentUsage = tenantUsage.tokens;
  }

  const totalUsage = currentUsage + newTokens;
  if (totalUsage > MAX_TOKENS_PER_DAY) {
    return {
      allowed: false,
      error: `Daily token limit exceeded: ${MAX_TOKENS_PER_DAY} tokens per day`,
    };
  }

  dailyTokenUsageByTenant.set(tenantId, {
    tokens: totalUsage,
    date: today,
  });

  return { allowed: true };
}

/**
 * Get current daily token usage for tenant
 */
export function getDailyTokenUsage(tenantId: string): number {
  const today = new Date().toISOString().split('T')[0];
  const tenantUsage = dailyTokenUsageByTenant.get(tenantId);
  
  if (tenantUsage && tenantUsage.date === today) {
    return tenantUsage.tokens;
  }
  
  return 0;
}

/**
 * Calculate estimated cost from token usage
 */
export function calculateCost(promptTokens: number, completionTokens: number): number {
  // OpenAI pricing (as of 2024): $0.01 per 1K prompt tokens, $0.03 per 1K completion tokens
  const PROMPT_COST_PER_1K = 0.01;
  const COMPLETION_COST_PER_1K = 0.03;
  
  const promptCost = (promptTokens / 1000) * PROMPT_COST_PER_1K;
  const completionCost = (completionTokens / 1000) * COMPLETION_COST_PER_1K;
  
  return promptCost + completionCost;
}

/**
 * Validate and check all limits before LLM call
 */
export function validateLLMCall(
  userId: string,
  tenantId: string,
  estimatedTokens: number
): { allowed: boolean; error?: string; retryAfter?: number } {
  // Check token limit per request
  const tokenCheck = checkTokenLimit(estimatedTokens);
  if (!tokenCheck.allowed) {
    return tokenCheck;
  }

  // Check rate limit
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return rateCheck;
  }

  // Check daily request limit
  const dailyRequestCheck = checkDailyRequestLimit(tenantId);
  if (!dailyRequestCheck.allowed) {
    return dailyRequestCheck;
  }

  // Check daily token limit
  const dailyTokenCheck = checkDailyTokenLimit(tenantId, estimatedTokens);
  if (!dailyTokenCheck.allowed) {
    return dailyTokenCheck;
  }

  return { allowed: true };
}







