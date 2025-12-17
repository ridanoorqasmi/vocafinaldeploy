// ===== ENHANCED STREAMING QUERY API =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getQueryProcessor } from '../../../../../../lib/query-processor';
import { QueryRequest } from '../../../../../../lib/query-types';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id') || request.headers.get('x-business-id');
    const query = searchParams.get('query');
    const sessionId = searchParams.get('session_id') || `enhanced_${Date.now()}`;

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Create query request
    const queryRequest: QueryRequest = {
      query,
      sessionId,
      preferences: {
        responseStyle: searchParams.get('response_style') || 'detailed',
        language: searchParams.get('language') || 'en'
      }
    };

    // Get query processor
    const queryProcessor = getQueryProcessor(prisma);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event
          const initialEvent = {
            type: 'start',
            data: {
              sessionId,
              businessId,
              query,
              timestamp: new Date(),
              features: ['business_rules', 'templates', 'caching', 'enhanced_streaming']
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(initialEvent)}\n\n`);

          // Process enhanced streaming query
          for await (const event of queryProcessor.processEnhancedStreamingQuery(
            businessId,
            queryRequest,
            request.headers.get('user-agent'),
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
          )) {
            const streamEvent = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(streamEvent);
          }

          // Send completion event
          const completionEvent = {
            type: 'end',
            data: {
              sessionId,
              timestamp: new Date(),
              status: 'completed'
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(completionEvent)}\n\n`);
          controller.close();

        } catch (error) {
          console.error('Enhanced streaming error:', error);
          
          const errorEvent = {
            type: 'error',
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date()
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(errorEvent)}\n\n`);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('Enhanced streaming API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, query, session_id, preferences } = body;

    if (!business_id) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Create query request
    const queryRequest: QueryRequest = {
      query,
      sessionId: session_id || `enhanced_${Date.now()}`,
      preferences: preferences || {
        responseStyle: 'detailed',
        language: 'en'
      }
    };

    // Get query processor
    const queryProcessor = getQueryProcessor(prisma);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial event
          const initialEvent = {
            type: 'start',
            data: {
              sessionId: queryRequest.sessionId,
              businessId: business_id,
              query,
              timestamp: new Date(),
              features: ['business_rules', 'templates', 'caching', 'enhanced_streaming']
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(initialEvent)}\n\n`);

          // Process enhanced streaming query
          for await (const event of queryProcessor.processEnhancedStreamingQuery(
            business_id,
            queryRequest,
            request.headers.get('user-agent'),
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
          )) {
            const streamEvent = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(streamEvent);
          }

          // Send completion event
          const completionEvent = {
            type: 'end',
            data: {
              sessionId: queryRequest.sessionId,
              timestamp: new Date(),
              status: 'completed'
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(completionEvent)}\n\n`);
          controller.close();

        } catch (error) {
          console.error('Enhanced streaming error:', error);
          
          const errorEvent = {
            type: 'error',
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date()
            }
          };
          
          controller.enqueue(`data: ${JSON.stringify(errorEvent)}\n\n`);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('Enhanced streaming API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
