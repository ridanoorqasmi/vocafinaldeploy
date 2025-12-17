// ===== COMBINED SEARCH API ENDPOINT =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getContextRetriever } from '@/lib/context-retriever';
import { getCacheManager } from '@/lib/cache-manager';
import { getSearchService } from '@/lib/search-service';
import { validateBusinessAuth } from '@/lib/auth-middleware';
import { createCorsResponse } from '@/lib/cors-middleware';
import { z } from 'zod';

// Request validation schema
const CombinedSearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  topN: z.number().min(1).max(20).optional(),
  minScore: z.number().min(0).max(1).optional(),
  includeMetadata: z.boolean().optional(),
  contentTypes: z.array(z.enum(['MENU', 'POLICY', 'FAQ', 'BUSINESS'])).optional()
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = CombinedSearchRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return createCorsResponse({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request parameters',
          details: validation.error.errors
        }
      }, 400, request);
    }

    const { query, topN, minScore, includeMetadata, contentTypes } = validation.data;

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

    // Generate cache key
    const cacheKey = cacheManager.generateSearchKey(
      businessId,
      query,
      'all',
      topN,
      minScore
    );

    // Check cache first
    let cachedResults = null;
    if (cacheManager.isAvailable()) {
      cachedResults = await cacheManager.getSearchResults(cacheKey);
    }

    if (cachedResults) {
      await prisma.$disconnect();
      return createCorsResponse({
        success: true,
        data: {
          ...cachedResults,
          cached: true,
          cacheHit: true
        }
      }, 200, request);
    }

    // Perform combined search
    const searchResponse = await contextRetriever.retrieveAllContext(businessId, {
      query,
      topN,
      minScore,
      includeMetadata
    });

    if (!searchResponse.success) {
      await prisma.$disconnect();
      return createCorsResponse({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: searchResponse.error?.message || 'Search failed',
          details: searchResponse.error
        }
      }, 500, request);
    }

    // Filter by content types if specified
    let filteredResults = searchResponse.data?.results || [];
    if (contentTypes && contentTypes.length > 0) {
      filteredResults = filteredResults.filter(result => 
        contentTypes.includes(result.contentType)
      );
    }

    // Group results by content type for better organization
    const groupedResults = filteredResults.reduce((acc, result) => {
      if (!acc[result.contentType]) {
        acc[result.contentType] = [];
      }
      acc[result.contentType].push(result);
      return acc;
    }, {} as Record<string, typeof filteredResults>);

    // Calculate statistics
    const stats = {
      totalResults: filteredResults.length,
      byContentType: Object.keys(groupedResults).reduce((acc, type) => {
        acc[type] = groupedResults[type].length;
        return acc;
      }, {} as Record<string, number>),
      averageConfidence: filteredResults.length > 0
        ? filteredResults.reduce((sum, result) => sum + result.confidence, 0) / filteredResults.length
        : 0
    };

    const responseData = {
      ...searchResponse.data,
      results: filteredResults,
      groupedResults,
      stats,
      total: filteredResults.length
    };

    // Cache results
    if (cacheManager.isAvailable()) {
      await cacheManager.setSearchResults(cacheKey, responseData);
    }

    const responseTime = Date.now() - startTime;

    await prisma.$disconnect();

    return createCorsResponse({
      success: true,
      data: {
        ...responseData,
        cached: false,
        cacheHit: false,
        responseTime
      }
    }, 200, request);

  } catch (error) {
    console.error('Combined search API error:', error);
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

