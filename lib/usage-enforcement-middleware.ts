/**
 * Phase 4B: Usage Enforcement Middleware
 * Middleware to integrate usage enforcement into existing API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { UsageEnforcementService, EnforcementContext } from './usage-enforcement-service';
import { authenticateToken } from './next-auth-middleware';

export interface UsageEnforcementConfig {
  operationType: 'query' | 'embedding' | 'api_call';
  featureRequired?: string;
  estimatedTokens?: number;
  enforceRateLimit?: boolean;
  recordUsage?: boolean;
}

export function createUsageEnforcementMiddleware(config: UsageEnforcementConfig) {
  return async function usageEnforcementMiddleware(
    request: NextRequest,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Authenticate request and get business context
      const authResult = await authenticateToken(request);
      if (!authResult.success || !authResult.user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const businessId = authResult.user.businessId;

      const usageEnforcement = new UsageEnforcementService();

      // Create enforcement context
      const context: EnforcementContext = {
        businessId: businessId,
        userId: request.headers.get('x-user-id') || undefined,
        sessionId: request.headers.get('x-session-id') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || request.ip,
        userAgent: request.headers.get('user-agent') || undefined
      };

      // Check feature access if required
      if (config.featureRequired) {
        const featureAccess = await usageEnforcement.checkFeatureAccess(
          context,
          config.featureRequired
        );

        if (!featureAccess.allowed) {
          return NextResponse.json(
            {
              error: 'Feature access denied',
              details: featureAccess.reason,
              feature_required: config.featureRequired,
              upgrade_required: true
            },
            { status: 403 }
          );
        }
      }

      // Enforce usage limits
      const usageCheck = await usageEnforcement.enforceUsageLimit(
        context,
        config.operationType,
        config.estimatedTokens,
        config.featureRequired
      );

      if (!usageCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Usage limit exceeded',
            details: usageCheck.reason,
            current_usage: usageCheck.current_usage,
            recommendations: usageCheck.recommendations,
            emergency_options: usageCheck.emergency_options
          },
          { status: 429 }
        );
      }

      // Apply rate limiting if enabled
      if (config.enforceRateLimit) {
        const rateLimit = await usageEnforcement.applyRateLimit(
          context,
          config.operationType
        );

        if (!rateLimit.allowed) {
          const response = NextResponse.json(
            {
              error: 'Rate limit exceeded',
              details: 'Too many requests',
              retry_after: rateLimit.retry_after
            },
            { status: 429 }
          );

          if (rateLimit.retry_after) {
            response.headers.set('Retry-After', rateLimit.retry_after.toString());
          }

          return response;
        }
      }

      // Process the request
      const response = await next();

      // Record usage if enabled
      if (config.recordUsage && response.ok) {
        try {
          await usageEnforcement.recordUsageWithEnforcement(
            context,
            config.operationType,
            1, // Default quantity
            config.estimatedTokens,
            undefined, // cost_cents - would be calculated based on tokens
            {
              endpoint: request.nextUrl.pathname,
              method: request.method,
              timestamp: new Date().toISOString()
            }
          );
        } catch (error) {
          // Don't fail the request if usage recording fails
          console.error('Usage recording failed:', error);
        }
      }

      // Add rate limit headers
      if (config.enforceRateLimit) {
        const rateLimit = await usageEnforcement.applyRateLimit(
          context,
          config.operationType
        );
        
        if (rateLimit.remaining !== undefined) {
          response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
          response.headers.set('X-RateLimit-Reset', rateLimit.reset_time.toString());
        }
      }

      return response;

    } catch (error) {
      console.error('Usage enforcement middleware error:', error);
      
      // Fail open for system stability
      return await next();
    }
  };
}

/**
 * Predefined middleware configurations for common operations
 */
export const usageEnforcementConfigs = {
  // For chat/query endpoints
  chatQuery: {
    operationType: 'query' as const,
    enforceRateLimit: true,
    recordUsage: true
  },

  // For embedding generation
  embeddingGeneration: {
    operationType: 'embedding' as const,
    featureRequired: 'advanced_analytics',
    enforceRateLimit: true,
    recordUsage: true
  },

  // For API calls
  apiCall: {
    operationType: 'api_call' as const,
    featureRequired: 'api_access',
    enforceRateLimit: true,
    recordUsage: true
  },

  // For batch processing
  batchProcessing: {
    operationType: 'query' as const,
    featureRequired: 'batch_processing',
    enforceRateLimit: false, // Batch operations have different rate limits
    recordUsage: true
  },

  // For analytics/reporting
  analytics: {
    operationType: 'api_call' as const,
    featureRequired: 'advanced_analytics',
    enforceRateLimit: true,
    recordUsage: false // Analytics queries don't count as usage
  }
};

/**
 * Helper function to create middleware for specific operations
 */
export function createChatQueryMiddleware() {
  return createUsageEnforcementMiddleware(usageEnforcementConfigs.chatQuery);
}

export function createEmbeddingMiddleware() {
  return createUsageEnforcementMiddleware(usageEnforcementConfigs.embeddingGeneration);
}

export function createApiCallMiddleware() {
  return createUsageEnforcementMiddleware(usageEnforcementConfigs.apiCall);
}

export function createBatchProcessingMiddleware() {
  return createUsageEnforcementMiddleware(usageEnforcementConfigs.batchProcessing);
}

export function createAnalyticsMiddleware() {
  return createUsageEnforcementMiddleware(usageEnforcementConfigs.analytics);
}
