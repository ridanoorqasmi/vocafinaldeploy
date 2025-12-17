import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';
import { validateRegistration } from '@/lib/validation';
import { authRateLimit, createErrorResponse, createSuccessResponse } from '@/lib/next-auth-middleware';

// ===== REGISTRATION ENDPOINT =====

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitCheck = authRateLimit(request);
    if (!rateLimitCheck.success) {
      return createErrorResponse(rateLimitCheck.error, 429);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRegistration(body);
    if (!validation.isValid) {
      return createErrorResponse({
        code: 'INVALID_INPUT',
        message: validation.errors.join(', ')
      }, 400);
    }

    // Register user
    const result = await authService.register(body);

    if (!result.success) {
      const statusCode = result.error?.code === 'EMAIL_ALREADY_EXISTS' || 
                        result.error?.code === 'SLUG_ALREADY_EXISTS' ? 409 : 400;
      
      return createErrorResponse(result.error, statusCode);
    }

    return createSuccessResponse(result.data, 201);

  } catch (error) {
    console.error('Registration endpoint error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return createErrorResponse({
      code: 'INTERNAL_ERROR',
      message: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, 500);
  }
}