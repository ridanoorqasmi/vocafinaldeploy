import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/user-service';
import { verifyAccessToken, extractTokenFromHeader, validateUserSession } from '@/lib/token-service';
import { validateChangeRole } from '@/lib/validation';

// ===== CHANGE USER ROLE ENDPOINT =====

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

    // Check if user has permission to change roles (Admin only)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only admins can change user roles'
        },
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    const body = await request.json();

    // Validate input
    const validation = validateChangeRole(body);
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

    // Change user role
    const result = await userService.changeUserRole(params.userId, session.user.businessId, body);

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
    console.error('Change user role endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to change user role'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


