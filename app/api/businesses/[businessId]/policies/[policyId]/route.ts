import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';
import { createAutoTrigger } from '@/lib/auto-trigger';

const prisma = new PrismaClient();
const autoTrigger = createAutoTrigger(prisma);

// PUT /api/businesses/:businessId/policies/:policyId - Update policy
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string; policyId: string } }
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

    // Check if user has admin/manager role
    const user = await prisma.user.findFirst({
      where: {
        id: authResult.user.id,
        businessId: params.businessId,
        role: { in: ['ADMIN', 'OWNER', 'MANAGER'] }
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin or Manager access required to update policies'
        }
      }, { status: 403 });
    }

    // Check if policy exists and belongs to business
    const existingPolicy = await prisma.policy.findFirst({
      where: {
        id: params.policyId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingPolicy) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Policy not found'
        }
      }, { status: 404 });
    }

    const body = await request.json();
    const { type, title, content, isActive, effectiveDate } = body;

    // Validate required fields
    if (!type || type.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Policy type is required'
        }
      }, { status: 400 });
    }

    if (!title || title.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Policy title is required'
        }
      }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Policy content is required'
        }
      }, { status: 400 });
    }

    // Validate policy type
    const validTypes = ['delivery', 'refund', 'privacy', 'terms', 'cancellation'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid policy type'
        }
      }, { status: 400 });
    }

    // Update policy
    const updatedPolicy = await prisma.policy.update({
      where: { id: params.policyId },
      data: {
        type: type.trim(),
        title: title.trim(),
        content: content.trim(),
        isActive: isActive !== undefined ? isActive : existingPolicy.isActive,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : existingPolicy.effectiveDate
      },
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        isActive: true,
        effectiveDate: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Trigger embedding generation asynchronously (non-blocking)
    autoTrigger.triggerPolicy(params.businessId, 'update', updatedPolicy)
      .then(result => {
        if (!result.success) {
          console.warn(`Failed to update embedding for policy ${updatedPolicy.id}:`, result.error);
        }
      })
      .catch(error => {
        console.error(`Error updating embedding for policy ${updatedPolicy.id}:`, error);
      });

    return NextResponse.json({
      success: true,
      data: updatedPolicy
    });

  } catch (error: any) {
    console.error('Update policy error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update policy'
      }
    }, { status: 500 });
  }
}

// DELETE /api/businesses/:businessId/policies/:policyId - Delete policy (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { businessId: string; policyId: string } }
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
    const user = await prisma.user.findFirst({
      where: {
        id: authResult.user.id,
        businessId: params.businessId,
        role: { in: ['ADMIN', 'OWNER'] }
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required to delete policies'
        }
      }, { status: 403 });
    }

    // Check if policy exists and belongs to business
    const existingPolicy = await prisma.policy.findFirst({
      where: {
        id: params.policyId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingPolicy) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Policy not found'
        }
      }, { status: 404 });
    }

    // Soft delete policy
    await prisma.policy.update({
      where: { id: params.policyId },
      data: { deletedAt: new Date() }
    });

    // Trigger embedding deletion asynchronously (non-blocking)
    autoTrigger.triggerPolicy(params.businessId, 'delete', existingPolicy)
      .then(result => {
        if (!result.success) {
          console.warn(`Failed to delete embedding for policy ${existingPolicy.id}:`, result.error);
        }
      })
      .catch(error => {
        console.error(`Error deleting embedding for policy ${existingPolicy.id}:`, error);
      });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Policy deleted successfully'
      }
    });

  } catch (error: any) {
    console.error('Delete policy error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete policy'
      }
    }, { status: 500 });
  }
}

