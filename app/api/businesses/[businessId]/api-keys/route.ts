import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireBusinessAccessMiddleware, requireAdminAccess } from '@/lib/auth-middleware';
import { createApiKey, listApiKeys } from '@/lib/api-key-service';
import { createBodyValidationMiddleware, createQueryValidationMiddleware, apiKeySchemas, querySchemas } from '@/lib/input-validation';
import { createRateLimitMiddleware, getRateLimitConfig } from '@/lib/rate-limit';
import { createSecurityMiddleware } from '@/lib/security-headers';
import { corsMiddleware, getCorsConfig } from '@/lib/cors-middleware';

// Rate limiting for API key operations
const rateLimitMiddleware = createRateLimitMiddleware(
  { window: 60 * 60 * 1000, max: 50 }, // 50 requests per hour
  'api_key_management'
);

// Security middleware
const securityMiddleware = createSecurityMiddleware();

// Validation middleware
const bodyValidation = createBodyValidationMiddleware(apiKeySchemas.create);
const queryValidation = createQueryValidationMiddleware(querySchemas.pagination);

// CORS config
const corsConfig = getCorsConfig();

// OPTIONS handler for preflight requests
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return corsMiddleware(request, response, corsConfig);
}

/**
 * GET /api/businesses/:businessId/api-keys
 * List all API keys for a business
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    // Apply security middleware
    const securityResponse = await securityMiddleware(request, async () => {
      // Apply rate limiting
      const rateLimitResponse = await rateLimitMiddleware(request);
      if (!rateLimitResponse.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: rateLimitResponse.error
          }),
          { 
            status: 429, 
            headers: { 
              'Content-Type': 'application/json',
              'Retry-After': rateLimitResponse.error?.retryAfter?.toString() || '60'
            }
          }
        );
      }

      // Validate query parameters
      const queryResult = await queryValidation(request);
      if (!queryResult.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: queryResult.error
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Authenticate request
      const authResult = await authenticateRequest(request);
      if (!authResult.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: authResult.error
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check business access
      const businessAccessResult = await requireBusinessAccessMiddleware(request, params.businessId);
      if (!businessAccessResult.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: businessAccessResult.error
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Require admin access for API key management
      const adminAccessResult = await requireAdminAccess(request);
      if (!adminAccessResult.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: adminAccessResult.error
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // List API keys
      const result = await listApiKeys(
        params.businessId,
        queryResult.data?.page || 1,
        queryResult.data?.limit || 50
      );

      if (!result.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: result.error
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const response = new NextResponse(
        JSON.stringify({
          success: true,
          data: result.data
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

      return corsMiddleware(request, response, corsConfig);
    });

    return securityResponse;
  } catch (error: any) {
    console.error('List API keys error:', error);
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list API keys'
        }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/businesses/:businessId/api-keys
 * Create a new API key for a business
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    // Apply security middleware
    const securityResponse = await securityMiddleware(request, async () => {
      // Apply rate limiting
      const rateLimitResponse = await rateLimitMiddleware(request);
      if (!rateLimitResponse.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: rateLimitResponse.error
          }),
          { 
            status: 429, 
            headers: { 
              'Content-Type': 'application/json',
              'Retry-After': rateLimitResponse.error?.retryAfter?.toString() || '60'
            }
          }
        );
      }

      // Validate request body
      const bodyResult = await bodyValidation(request);
      if (!bodyResult.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: bodyResult.error
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Authenticate request
      const authResult = await authenticateRequest(request);
      if (!authResult.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: authResult.error
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check business access
      const businessAccessResult = await requireBusinessAccessMiddleware(request, params.businessId);
      if (!businessAccessResult.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: businessAccessResult.error
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Require admin access for API key management
      const adminAccessResult = await requireAdminAccess(request);
      if (!adminAccessResult.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: adminAccessResult.error
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Create API key
      const result = await createApiKey(params.businessId, bodyResult.data);

      if (!result.success) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: result.error
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const response = new NextResponse(
        JSON.stringify({
          success: true,
          data: result.data
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );

      return corsMiddleware(request, response, corsConfig);
    });

    return securityResponse;
  } catch (error: any) {
    console.error('Create API key error:', error);
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create API key'
        }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
