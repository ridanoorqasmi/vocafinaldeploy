import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest, requireBusinessAccessMiddleware, requireAdminAccess } from '@/lib/auth-middleware';
import { createBodyValidationMiddleware, businessSchemas } from '@/lib/input-validation';
import { createRateLimitMiddleware, getRateLimitConfig } from '@/lib/rate-limit';
import { createSecurityMiddleware } from '@/lib/security-headers';
import { corsMiddleware, createCorsResponse, getCorsConfig } from '@/lib/cors-middleware';

const prisma = new PrismaClient();

// Security middleware
const securityMiddleware = createSecurityMiddleware();

// Rate limiting middleware
const rateLimitMiddleware = createRateLimitMiddleware(getRateLimitConfig);

// Validation middleware
const bodyValidation = createBodyValidationMiddleware(businessSchemas.update);

// CORS config
const corsConfig = getCorsConfig();

// OPTIONS handler for preflight requests
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return corsMiddleware(request, response, corsConfig);
}

// GET /api/businesses/:businessId - Get business details
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    // Apply security middleware
    return await securityMiddleware(request, async () => {
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

      // Get business details
      const business = await prisma.business.findUnique({
        where: { id: params.businessId },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          website: true,
          description: true,
          timezone: true,
          currency: true,
          language: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              locations: true,
              menuItems: true,
              policies: true,
              knowledgeBase: true
            }
          }
        }
      });

      if (!business) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Business not found'
            }
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const response = new NextResponse(
        JSON.stringify({
          success: true,
          data: business
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

      return corsMiddleware(request, response, corsConfig);
    });
  } catch (error: any) {
    console.error('Get business error:', error);
    const response = new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve business details'
        }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
    return corsMiddleware(request, response, corsConfig);
  }
}

// PUT /api/businesses/:businessId - Update business info
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    // Apply security middleware
    return await securityMiddleware(request, async () => {
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

      // Require admin access for business updates
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

      const { name, phone, website, description, timezone, currency, language } = bodyResult.data;

      // Update business
      const updatedBusiness = await prisma.business.update({
        where: { id: params.businessId },
        data: {
          name: name.trim(),
          phone: phone?.trim() || null,
          website: website?.trim() || null,
          description: description?.trim() || null,
          timezone: timezone || 'UTC',
          currency: currency || 'USD',
          language: language || 'en'
        },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          website: true,
          description: true,
          timezone: true,
          currency: true,
          language: true,
          status: true,
          updatedAt: true
        }
      });

      const response = new NextResponse(
        JSON.stringify({
          success: true,
          data: updatedBusiness
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

      return corsMiddleware(request, response, corsConfig);
    });
  } catch (error: any) {
    console.error('Update business error:', error);
    const response = new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update business'
        }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
    return corsMiddleware(request, response, corsConfig);
  }
}
