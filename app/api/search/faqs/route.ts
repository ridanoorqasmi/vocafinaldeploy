// ===== FAQS SEARCH API ENDPOINT =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getContextRetriever } from '@/lib/context-retriever';
import { getCacheManager } from '@/lib/cache-manager';
import { getSearchService } from '@/lib/search-service';
import { validateBusinessAuth } from '@/lib/auth-middleware';
import { createCorsResponse } from '@/lib/cors-middleware';
import { z } from 'zod';

// Request validation schema
const FAQsSearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  topN: z.number().min(1).max(20).optional(),
  minScore: z.number().min(0).max(1).optional(),
  includeMetadata: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = FAQsSearchRequestSchema.safeParse(body);
    
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

    const { query, topN, minScore, includeMetadata } = validation.data;

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
      'FAQ',
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

    // Perform search
    const searchResponse = await contextRetriever.retrieveContext(businessId, {
      query,
      contentType: 'FAQ',
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

    // Cache results
    if (cacheManager.isAvailable() && searchResponse.data) {
      await cacheManager.setSearchResults(cacheKey, searchResponse.data);
    }

    const responseTime = Date.now() - startTime;

    await prisma.$disconnect();

    return createCorsResponse({
      success: true,
      data: {
        ...searchResponse.data,
        cached: false,
        cacheHit: false,
        responseTime
      }
    }, 200, request);

  } catch (error) {
    console.error('FAQs search API error:', error);
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

