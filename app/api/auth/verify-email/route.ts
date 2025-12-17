import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';

// ===== EMAIL VERIFICATION ENDPOINT =====

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.token) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Verification token is required'
        },
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Verify email
    const result = await authService.verifyEmail({ token: body.token });

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
    console.error('Email verification endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Email verification failed. Please try again.'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

