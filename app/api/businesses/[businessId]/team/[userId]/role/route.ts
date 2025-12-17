import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// PUT /api/businesses/:businessId/team/:userId/role - Change user role
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string; userId: string } }
) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    // Check business access and admin role
    const businessAccess = await requireBusinessAccess(authResult.user.id, params.businessId);
    if (!businessAccess.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this business'
        }
      }, { status: 403 });
    }

    // Check if user has admin role
    const currentUser = await prisma.user.findFirst({
      where: {
        id: authResult.user.id,
        businessId: params.businessId,
        role: { in: ['ADMIN', 'OWNER'] }
      }
    });

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required to change user roles'
        }
      }, { status: 403 });
    }

    // Check if target user exists and belongs to business
    const targetUser = await prisma.user.findFirst({
      where: {
        id: params.userId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!targetUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      }, { status: 404 });
    }

    // Prevent changing own role
    if (params.userId === authResult.user.id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot change your own role'
        }
      }, { status: 403 });
    }

    // Prevent changing owner role
    if (targetUser.role === 'OWNER') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot change owner role'
        }
      }, { status: 403 });
    }

    const body = await request.json();
    const { role } = body;

    // Validate role
    const validRoles = ['ADMIN', 'MANAGER', 'STAFF'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid role is required (ADMIN, MANAGER, STAFF)'
        }
      }, { status: 400 });
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedUser
    });

  } catch (error: any) {
    console.error('Update user role error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user role'
      }
    }, { status: 500 });
  }
}

