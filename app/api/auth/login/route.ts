import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';
import { validateLogin } from '@/lib/validation';
import { authRateLimit, createErrorResponse, createSuccessResponse } from '@/lib/next-auth-middleware';

// ===== LOGIN ENDPOINT =====

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitCheck = authRateLimit(request);
    if (!rateLimitCheck.success) {
      return createErrorResponse(rateLimitCheck.error, 429);
    }

    const body = await request.json();

    // Validate input
    const validation = validateLogin(body);
    if (!validation.isValid) {
      return createErrorResponse({
        code: 'INVALID_INPUT',
        message: validation.errors.join(', ')
      }, 400);
    }

    // Login user
    const result = await authService.login(body);

    if (!result.success) {
      const statusCode = result.error?.code === 'INVALID_CREDENTIALS' ? 401 : 400;
      
      return createErrorResponse(result.error, statusCode);
    }

    return createSuccessResponse(result.data, 200);

  } catch (error) {
    console.error('Login endpoint error:', error);
    return createErrorResponse({
      code: 'INTERNAL_ERROR',
      message: 'Login failed. Please try again.'
    }, 500);
  }
}