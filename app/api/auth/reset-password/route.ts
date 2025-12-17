import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';
import { validateResetPassword } from '@/lib/validation';

// ===== RESET PASSWORD ENDPOINT =====

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateResetPassword(body);
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

    // Reset password
    const result = await authService.resetPassword(body);

    if (!result.success) {
      return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Reset password endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Password reset failed. Please try again.'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


