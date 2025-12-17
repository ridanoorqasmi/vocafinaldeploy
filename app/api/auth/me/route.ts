import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractTokenFromHeader, validateUserSession } from '@/lib/token-service';

// ===== GET CURRENT USER ENDPOINT =====

export async function GET(request: NextRequest) {
  try {
    // Extract token from Authorization header
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

    // Validate user session
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

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: session.user.id,
          email: session.user.email,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          role: session.user.role,
          isActive: session.user.isActive
        },
        business: {
          id: session.business.id,
          name: session.business.name,
          slug: session.business.slug,
          status: session.business.status
        }
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Get current user endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user information'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}


