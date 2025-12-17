import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// DELETE /api/businesses/:businessId/team/:userId - Remove team member (soft delete)
export async function DELETE(
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
          message: 'Admin access required to remove team members'
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

    // Prevent removing yourself
    if (params.userId === authResult.user.id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot remove yourself from the team'
        }
      }, { status: 403 });
    }

    // Prevent removing owner
    if (targetUser.role === 'OWNER') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot remove business owner'
        }
      }, { status: 403 });
    }

    // Soft delete user
    await prisma.user.update({
      where: { id: params.userId },
      data: { 
        deletedAt: new Date(),
        isActive: false
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Team member removed successfully'
      }
    });

  } catch (error: any) {
    console.error('Remove team member error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove team member'
      }
    }, { status: 500 });
  }
}

