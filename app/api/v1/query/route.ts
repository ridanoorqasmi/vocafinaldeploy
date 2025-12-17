// ===== ENHANCED QUERY API - PHASE 3B IMPLEMENTATION =====

import { NextRequest, NextResponse } from 'next/server';
import { getQueryProcessor } from '@/lib/query-processor';
import { getPrismaClient } from '@/lib/prisma';
import { QueryRequest } from '@/lib/query-types';
import { validateRequest } from '@/lib/input-validation';
import { rateLimit } from '@/lib/rate-limit';
import { logRequest } from '@/lib/request-logging';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Extract request data
    const body = await request.json();
    const businessId = request.nextUrl.searchParams.get('businessId');
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // Validate business ID
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Validate request body
    const validationResult = validateRequest(body, {
      required: ['query'],
      optional: ['sessionId', 'customerId', 'preferences']
    });

    if (!validationResult.isValid) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.errors },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(ipAddress, businessId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
    }

    // Log request
    await logRequest({
      method: 'POST',
      url: request.url,
      businessId,
      userAgent,
      ipAddress,
      body: { query: body.query, sessionId: body.sessionId }
    });

    // Build query request
    const queryRequest: QueryRequest = {
      query: body.query,
      sessionId: body.sessionId,
      customerId: body.customerId,
      preferences: body.preferences
    };

    // Get query processor
    const prisma = getPrismaClient();
    const queryProcessor = getQueryProcessor(prisma);

    // Process query
    const response = await queryProcessor.processQuery(
      businessId,
      queryRequest,
      userAgent,
      ipAddress
    );

    // Log response
    const processingTime = Date.now() - startTime;
    console.log(`Query processed in ${processingTime}ms for business ${businessId}`);

    // Return enhanced response
    return NextResponse.json({
      success: true,
      data: response,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Query API Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      message: 'Query API - Use POST method to send queries',
      endpoints: {
        query: 'POST /api/v1/query?businessId=<id>',
        stream: 'GET /api/v1/query/stream?businessId=<id>'
      },
      version: '3.0.0'
    },
    { status: 200 }
  );
}