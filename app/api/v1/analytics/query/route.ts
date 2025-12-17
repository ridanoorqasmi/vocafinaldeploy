// ===== QUERY ANALYTICS API ENDPOINT =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAnalyticsLogger } from '@/lib/analytics-logger';
import { getQueryProcessor } from '@/lib/query-processor';
import { validateBusinessAuth } from '@/lib/auth-middleware';
import { createCorsResponse } from '@/lib/cors-middleware';
import { z } from 'zod';

// Query parameters validation schema
const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  intent: z.enum([
    'MENU_INQUIRY',
    'HOURS_POLICY', 
    'PRICING_QUESTION',
    'DIETARY_RESTRICTIONS',
    'LOCATION_INFO',
    'GENERAL_CHAT',
    'COMPLAINT_FEEDBACK',
    'UNKNOWN'
  ]).optional(),
  status: z.enum(['SUCCESS', 'ERROR', 'TIMEOUT', 'RATE_LIMITED']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

export async function GET(request: NextRequest) {
  try {
    // Authenticate business
    const authResult = await validateBusinessAuth(request);
    if (!authResult.success) {
      return createCorsResponse({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: authResult.error
        }
      }, 401, request);
    }

    const businessId = authResult.businessId!;

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = {
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      intent: url.searchParams.get('intent') || undefined,
      status: url.searchParams.get('status') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined
    };

    const validation = AnalyticsQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return createCorsResponse({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid query parameters',
          details: validation.error.errors
        }
      }, 400, request);
    }

    const params = validation.data;

    // Initialize services
    const prisma = new PrismaClient();
    const analyticsLogger = getAnalyticsLogger(prisma);
    const queryProcessor = getQueryProcessor(prisma);

    // Get analytics data
    const [queryAnalytics, sessionAnalytics, realTimeMetrics, processorStats] = await Promise.all([
      analyticsLogger.getQueryAnalytics(
        businessId,
        params.startDate ? new Date(params.startDate) : undefined,
        params.endDate ? new Date(params.endDate) : undefined
      ),
      analyticsLogger.getSessionAnalytics(
        businessId,
        params.startDate ? new Date(params.startDate) : undefined,
        params.endDate ? new Date(params.endDate) : undefined
      ),
      analyticsLogger.getRealTimeMetrics(businessId),
      queryProcessor.getProcessorStats(businessId)
    ]);

    // Get detailed query logs if requested
    let queryLogs = null;
    if (params.limit) {
      const logsResult = await analyticsLogger.searchQueryLogs({
        businessId,
        startDate: params.startDate ? new Date(params.startDate) : undefined,
        endDate: params.endDate ? new Date(params.endDate) : undefined,
        intent: params.intent,
        status: params.status,
        limit: params.limit,
        offset: params.offset
      });
      queryLogs = logsResult;
    }

    await prisma.$disconnect();

    return createCorsResponse({
      success: true,
      data: {
        queryAnalytics,
        sessionAnalytics,
        realTimeMetrics,
        processorStats,
        queryLogs
      }
    }, 200, request);

  } catch (error) {
    console.error('Query analytics API error:', error);
    return createCorsResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, 500, request);
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return createCorsResponse({}, 200, request);
}

