// ===== SEARCH STATS API ENDPOINT =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getContextRetriever } from '@/lib/context-retriever';
import { getCacheManager } from '@/lib/cache-manager';
import { getSearchService } from '@/lib/search-service';
import { validateBusinessAuth } from '@/lib/auth-middleware';
import { createCorsResponse } from '@/lib/cors-middleware';

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

    // Initialize services
    const prisma = new PrismaClient();
    const contextRetriever = getContextRetriever(prisma);
    const cacheManager = getCacheManager(prisma);
    const searchService = getSearchService(prisma);

    // Get search statistics
    const [retrievalStats, cacheStats, searchStats] = await Promise.all([
      contextRetriever.getRetrievalStats(businessId),
      cacheManager.getStats(),
      searchService.getSearchStats(businessId)
    ]);

    // Get recent search activity (last 24 hours)
    const recentSearches = await prisma.queryLog.findMany({
      where: {
        businessId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        query: true,
        status: true,
        responseTime: true,
        createdAt: true
      }
    });

    // Calculate performance metrics
    const performanceMetrics = {
      averageResponseTime: recentSearches.length > 0
        ? recentSearches.reduce((sum, log) => sum + (log.responseTime || 0), 0) / recentSearches.length
        : 0,
      successRate: recentSearches.length > 0
        ? recentSearches.filter(log => log.status === 'SUCCESS').length / recentSearches.length
        : 0,
      totalSearches24h: recentSearches.length
    };

    await prisma.$disconnect();

    return createCorsResponse({
      success: true,
      data: {
        retrieval: retrievalStats,
        cache: cacheStats,
        search: searchStats,
        performance: performanceMetrics,
        recentSearches: recentSearches.map(log => ({
          id: log.id,
          query: log.query.substring(0, 100) + (log.query.length > 100 ? '...' : ''),
          status: log.status,
          responseTime: log.responseTime,
          createdAt: log.createdAt
        }))
      }
    }, 200, request);

  } catch (error) {
    console.error('Search stats API error:', error);
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

