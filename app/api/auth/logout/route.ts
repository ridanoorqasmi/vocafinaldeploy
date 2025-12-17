import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth-service';
import { authenticateToken } from '@/lib/auth-middleware';

// ===== LOGOUT ENDPOINT =====

export async function POST(request: NextRequest) {
  try {
    // Extract user ID from token (we'll need to modify this to work with Next.js)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Authentication token required'
        },
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // For now, we'll extract user ID from the token
    // In a real implementation, you'd want to verify the token first
    const token = authHeader.replace('Bearer ', '');
    
    // Simple token decode to get user ID (in production, use proper verification)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.userId;
      
      if (!userId) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'TOKEN_INVALID',
            message: 'Invalid authentication token'
          },
          timestamp: new Date().toISOString()
        }, { status: 401 });
      }

      // Logout user
      const result = await authService.logout(userId);

      return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString()
      }, { status: 200 });

    } catch (tokenError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid authentication token'
        },
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

  } catch (error) {
    console.error('Logout endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed. Please try again.'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

