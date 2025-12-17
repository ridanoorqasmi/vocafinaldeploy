import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/user-service';
import { verifyAccessToken, extractTokenFromHeader, validateUserSession } from '@/lib/token-service';

// ===== CHANGE USER STATUS ENDPOINT =====

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Extract and verify token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader || undefined);

    if (!token) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Authentication token required'
        },
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    const session = await validateUserSession(token);
    if (!session) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid or expired authentication token'
        },
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // Check if user has permission to change user status (Admin only)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only admins can change user status'
        },
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Prevent admin from deactivating themselves
    if (session.user.id === params.userId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Cannot change your own account status'
        },
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const body = await request.json();

    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'isActive must be a boolean value'
        },
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Change user status
    const result = await userService.changeUserStatus(params.userId, session.user.businessId, body.isActive);

    if (!result.success) {
      return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Change user status endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to change user status'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


