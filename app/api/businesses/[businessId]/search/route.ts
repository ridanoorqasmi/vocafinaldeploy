// ===== EMBEDDING SEARCH API ENDPOINT =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';
import { createEmbeddingManager } from '@/lib/embedding-manager';

const prisma = new PrismaClient();
const embeddingManager = createEmbeddingManager(prisma);

// POST /api/businesses/:businessId/search - Search embeddings
export async function POST(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    // Check business access
    const businessAccess = await requireBusinessAccess(authResult.user.id, params.businessId);
    if (!businessAccess.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this business'
        }
      }, { status: 403 });
    }

    const body = await request.json();
    const { 
      query, 
      contentType, 
      limit = 10, 
      threshold = 0.7 
    } = body;

    // Validate required fields
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query is required'
        }
      }, { status: 400 });
    }

    // Validate limit
    if (limit < 1 || limit > 50) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Limit must be between 1 and 50'
        }
      }, { status: 400 });
    }

    // Validate threshold
    if (threshold < 0 || threshold > 1) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Threshold must be between 0 and 1'
        }
      }, { status: 400 });
    }

    // Perform embedding search
    const searchResult = await embeddingManager.searchEmbeddings({
      businessId: params.businessId,
      query: query.trim(),
      contentType,
      limit,
      threshold
    });

    if (!searchResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: searchResult.error?.message || 'Search failed',
          details: searchResult.error?.details
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        query: searchResult.query,
        results: searchResult.results,
        total: searchResult.total,
        searchTime: Date.now() // Could be enhanced with actual timing
      }
    });

  } catch (error: any) {
    console.error('Search embeddings error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to perform search'
      }
    }, { status: 500 });
  }
}

// GET /api/businesses/:businessId/search - Get search statistics
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    // Check business access
    const businessAccess = await requireBusinessAccess(authResult.user.id, params.businessId);
    if (!businessAccess.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this business'
        }
      }, { status: 403 });
    }

    // Get embedding statistics
    const statsResult = await embeddingManager.getEmbeddingStats(params.businessId);

    if (!statsResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: statsResult.error?.message || 'Failed to get statistics'
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: statsResult.stats,
        cacheStats: embeddingManager.getCacheStats()
      }
    });

  } catch (error: any) {
    console.error('Get search stats error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get search statistics'
      }
    }, { status: 500 });
  }
}

