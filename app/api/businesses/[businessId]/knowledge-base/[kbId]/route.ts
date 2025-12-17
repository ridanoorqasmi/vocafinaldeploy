import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';
import { createAutoTrigger } from '@/lib/auto-trigger';

const prisma = new PrismaClient();
const autoTrigger = createAutoTrigger(prisma);

// PUT /api/businesses/:businessId/knowledge-base/:kbId - Update FAQ
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string; kbId: string } }
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
          message: 'Admin or Manager access required to update knowledge base items'
        }
      }, { status: 403 });
    }

    // Check if knowledge base item exists and belongs to business
    const existingItem = await prisma.knowledgeBase.findFirst({
      where: {
        id: params.kbId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingItem) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Knowledge base item not found'
        }
      }, { status: 404 });
    }

    const body = await request.json();
    const { title, content, category, tags, isActive } = body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title is required'
        }
      }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Content is required'
        }
      }, { status: 400 });
    }

    if (!category || category.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category is required'
        }
      }, { status: 400 });
    }

    // Validate category
    const validCategories = ['FAQ', 'Policies', 'Procedures', 'Training'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid category'
        }
      }, { status: 400 });
    }

    // Update knowledge base item
    const updatedItem = await prisma.knowledgeBase.update({
      where: { id: params.kbId },
      data: {
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        tags: tags !== undefined ? tags : existingItem.tags,
        isActive: isActive !== undefined ? isActive : existingItem.isActive
      },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        tags: true,
        isActive: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Trigger embedding generation asynchronously (non-blocking)
    autoTrigger.triggerFAQ(params.businessId, 'update', updatedItem)
      .then(result => {
        if (!result.success) {
          console.warn(`Failed to update embedding for FAQ ${updatedItem.id}:`, result.error);
        }
      })
      .catch(error => {
        console.error(`Error updating embedding for FAQ ${updatedItem.id}:`, error);
      });

    return NextResponse.json({
      success: true,
      data: updatedItem
    });

  } catch (error: any) {
    console.error('Update knowledge base item error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update knowledge base item'
      }
    }, { status: 500 });
  }
}

// DELETE /api/businesses/:businessId/knowledge-base/:kbId - Delete FAQ (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { businessId: string; kbId: string } }
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
          message: 'Admin access required to delete knowledge base items'
        }
      }, { status: 403 });
    }

    // Check if knowledge base item exists and belongs to business
    const existingItem = await prisma.knowledgeBase.findFirst({
      where: {
        id: params.kbId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingItem) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Knowledge base item not found'
        }
      }, { status: 404 });
    }

    // Soft delete knowledge base item
    await prisma.knowledgeBase.update({
      where: { id: params.kbId },
      data: { deletedAt: new Date() }
    });

    // Trigger embedding deletion asynchronously (non-blocking)
    autoTrigger.triggerFAQ(params.businessId, 'delete', existingItem)
      .then(result => {
        if (!result.success) {
          console.warn(`Failed to delete embedding for FAQ ${existingItem.id}:`, result.error);
        }
      })
      .catch(error => {
        console.error(`Error deleting embedding for FAQ ${existingItem.id}:`, error);
      });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Knowledge base item deleted successfully'
      }
    });

  } catch (error: any) {
    console.error('Delete knowledge base item error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete knowledge base item'
      }
    }, { status: 500 });
  }
}

