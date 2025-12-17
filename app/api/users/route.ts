import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/user-service';
import { verifyAccessToken, extractTokenFromHeader, validateUserSession } from '@/lib/token-service';
import { setBusinessContext } from '@/lib/auth';

// ===== GET USERS ENDPOINT =====

export async function GET(request: NextRequest) {
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

    // Check if user has permission to view users (Admin or Manager)
    if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to view users'
        },
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get business users
    const result = await userService.getBusinessUsers(session.user.businessId, page, limit);

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
    console.error('Get users endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch users'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// ===== INVITE USER ENDPOINT =====

export async function POST(request: NextRequest) {
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

    // Check if user has permission to invite users (Admin only)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only admins can invite users'
        },
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    const body = await request.json();

    // Invite user
    const result = await userService.inviteUser(session.user.businessId, session.user.id, body);

    if (!result.success) {
      const statusCode = result.error?.code === 'EMAIL_ALREADY_EXISTS' ? 409 : 400;
      return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString()
      }, { status: statusCode });
    }

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('Invite user endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to invite user'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


