import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';
import { validateForgotPassword } from '@/lib/validation';
import { authRateLimit } from '@/lib/auth-middleware';

// ===== FORGOT PASSWORD ENDPOINT =====

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await authRateLimit(request);
    if (!rateLimitResponse.success) {
      return NextResponse.json({
        success: false,
        error: rateLimitResponse.error,
        timestamp: new Date().toISOString()
      }, { status: 429 });
    }

    const body = await request.json();

    // Validate input
    const validation = validateForgotPassword(body);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: validation.errors.join(', ')
        },
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Send password reset email
    const result = await authService.forgotPassword(body);

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      data: {
        message: 'If an account with that email exists, a password reset link has been sent.'
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Forgot password endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Password reset request failed. Please try again.'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


