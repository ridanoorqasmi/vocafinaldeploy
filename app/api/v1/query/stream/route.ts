// ===== STREAMING QUERY API - PHASE 3B IMPLEMENTATION =====

import { NextRequest, NextResponse } from 'next/server';
import { getQueryProcessor } from '@/lib/query-processor';
import { getPrismaClient } from '@/lib/prisma';
import { QueryRequest } from '@/lib/query-types';
import { validateRequest } from '@/lib/input-validation';
import { rateLimit } from '@/lib/rate-limit';
import { logRequest } from '@/lib/request-logging';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Extract request data
    const businessId = request.nextUrl.searchParams.get('businessId');
    const query = request.nextUrl.searchParams.get('query');
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const customerId = request.nextUrl.searchParams.get('customerId');
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // Validate business ID
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Validate query
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
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
      method: 'GET',
      url: request.url,
      businessId,
      userAgent,
      ipAddress,
      body: { query, sessionId, customerId }
    });

    // Build query request
    const queryRequest: QueryRequest = {
      query,
      sessionId: sessionId || undefined,
      customerId: customerId || undefined
    };

    // Get query processor
    const prisma = getPrismaClient();
    const queryProcessor = getQueryProcessor(prisma);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event
          const initialEvent = {
            type: 'start',
            data: {
              sessionId: sessionId || 'new-session',
              businessId,
              timestamp: new Date().toISOString()
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(initialEvent)}\n\n`);

          // Process streaming query
          const streamingQuery = queryProcessor.processStreamingQuery(
            businessId,
            queryRequest,
            userAgent,
            ipAddress
          );

          // Stream events
          for await (const event of streamingQuery) {
            const eventData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(eventData);
          }

          // Send completion event
          const completionEvent = {
            type: 'complete',
            data: {
              sessionId: sessionId || 'new-session',
              processingTimeMs: Date.now() - startTime,
              timestamp: new Date().toISOString()
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(completionEvent)}\n\n`);
          controller.close();

        } catch (error) {
          console.error('Streaming error:', error);
          
          const errorEvent = {
            type: 'error',
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(errorEvent)}\n\n`);
          controller.close();
        }
      }
    });

    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Streaming Query API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

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

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event
          const initialEvent = {
            type: 'start',
            data: {
              sessionId: body.sessionId || 'new-session',
              businessId,
              timestamp: new Date().toISOString()
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(initialEvent)}\n\n`);

          // Process streaming query
          const streamingQuery = queryProcessor.processStreamingQuery(
            businessId,
            queryRequest,
            userAgent,
            ipAddress
          );

          // Stream events
          for await (const event of streamingQuery) {
            const eventData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(eventData);
          }

          // Send completion event
          const completionEvent = {
            type: 'complete',
            data: {
              sessionId: body.sessionId || 'new-session',
              processingTimeMs: Date.now() - startTime,
              timestamp: new Date().toISOString()
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(completionEvent)}\n\n`);
          controller.close();

        } catch (error) {
          console.error('Streaming error:', error);
          
          const errorEvent = {
            type: 'error',
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(errorEvent)}\n\n`);
          controller.close();
        }
      }
    });

    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Streaming Query API Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
