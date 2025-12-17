import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/user-service';
import { verifyAccessToken, extractTokenFromHeader, validateUserSession } from '@/lib/token-service';
import { validateInviteUser } from '@/lib/validation';

// ===== ACCEPT INVITATION ENDPOINT =====

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateInviteUser(body);
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

    // Accept invitation
    const result = await userService.acceptInvite(body);

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
    console.error('Accept invitation endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to accept invitation'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


