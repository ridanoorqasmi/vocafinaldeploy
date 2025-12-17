import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// PUT /api/businesses/:businessId/categories/:categoryId - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string; categoryId: string } }
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
          message: 'Admin or Manager access required to update categories'
        }
      }, { status: 403 });
    }

    // Check if category exists and belongs to business
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: params.categoryId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingCategory) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, sortOrder, isActive } = body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category name is required'
        }
      }, { status: 400 });
    }

    // Check if category name already exists (excluding current category)
    const duplicateCategory = await prisma.category.findFirst({
      where: {
        businessId: params.businessId,
        name: { equals: name.trim(), mode: 'insensitive' },
        id: { not: params.categoryId },
        deletedAt: null
      }
    });

    if (duplicateCategory) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'Category with this name already exists'
        }
      }, { status: 409 });
    }

    // Update category
    const updatedCategory = await prisma.category.update({
      where: { id: params.categoryId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        sortOrder: sortOrder !== undefined ? sortOrder : existingCategory.sortOrder,
        isActive: isActive !== undefined ? isActive : existingCategory.isActive
      },
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedCategory
    });

  } catch (error: any) {
    console.error('Update category error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update category'
      }
    }, { status: 500 });
  }
}

// DELETE /api/businesses/:businessId/categories/:categoryId - Delete category (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { businessId: string; categoryId: string } }
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
          message: 'Admin access required to delete categories'
        }
      }, { status: 403 });
    }

    // Check if category exists and belongs to business
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: params.categoryId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingCategory) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      }, { status: 404 });
    }

    // Check if category has menu items
    const menuItemCount = await prisma.menuItem.count({
      where: {
        categoryId: params.categoryId,
        deletedAt: null
      }
    });

    if (menuItemCount > 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Cannot delete category with existing menu items'
        }
      }, { status: 409 });
    }

    // Soft delete category
    await prisma.category.update({
      where: { id: params.categoryId },
      data: { deletedAt: new Date() }
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Category deleted successfully'
      }
    });

  } catch (error: any) {
    console.error('Delete category error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete category'
      }
    }, { status: 500 });
  }
}
