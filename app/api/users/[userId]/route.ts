import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/user-service';
import { verifyAccessToken, extractTokenFromHeader, validateUserSession } from '@/lib/token-service';

// ===== GET USER BY ID ENDPOINT =====

export async function GET(
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

    // Check if user has permission to view user details (Admin, Manager, or viewing own profile)
    if (!['ADMIN', 'MANAGER'].includes(session.user.role) && session.user.id !== params.userId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to view this user'
        },
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Get user
    const result = await userService.getUserById(params.userId, session.user.businessId);

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
    console.error('Get user endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// ===== UPDATE USER ENDPOINT =====

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

    // Check if user has permission to update user (Admin, Manager, or updating own profile)
    if (!['ADMIN', 'MANAGER'].includes(session.user.role) && session.user.id !== params.userId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to update this user'
        },
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    const body = await request.json();

    // Update user
    const result = await userService.updateUser(params.userId, session.user.businessId, body);

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
    }, { status: 200 });

  } catch (error) {
    console.error('Update user endpoint error:', error);
    return NextResponse.json({
      success: false,
        error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// ===== DELETE USER ENDPOINT =====

export async function DELETE(
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

    // Check if user has permission to delete user (Admin only)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only admins can delete users'
        },
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // Prevent admin from deleting themselves
    if (session.user.id === params.userId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Cannot delete your own account'
        },
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Delete user
    const result = await userService.deleteUser(params.userId, session.user.businessId);

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
    console.error('Delete user endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete user'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


