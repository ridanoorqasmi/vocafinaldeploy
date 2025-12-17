import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';
import { createAutoTrigger } from '@/lib/auto-trigger';

const prisma = new PrismaClient();
const autoTrigger = createAutoTrigger(prisma);

// PUT /api/businesses/:businessId/menu-items/:itemId - Update item
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string; itemId: string } }
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
          message: 'Admin or Manager access required to update menu items'
        }
      }, { status: 403 });
    }

    // Check if menu item exists and belongs to business
    const existingItem = await prisma.menuItem.findFirst({
      where: {
        id: params.itemId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingItem) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Menu item not found'
        }
      }, { status: 404 });
    }

    const body = await request.json();
    const { 
      name, 
      description, 
      price, 
      image, 
      categoryId, 
      isAvailable, 
      sortOrder, 
      allergens, 
      calories, 
      prepTime 
    } = body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Menu item name is required'
        }
      }, { status: 400 });
    }

    if (price !== undefined && (price < 0 || isNaN(price))) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid price is required'
        }
      }, { status: 400 });
    }

    // Validate category if provided
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          businessId: params.businessId,
          deletedAt: null
        }
      });

      if (!category) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid category'
          }
        }, { status: 400 });
      }
    }

    // Update menu item
    const updatedItem = await prisma.menuItem.update({
      where: { id: params.itemId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: price !== undefined ? parseFloat(price) : existingItem.price,
        image: image?.trim() || null,
        categoryId: categoryId || existingItem.categoryId,
        isAvailable: isAvailable !== undefined ? isAvailable : existingItem.isAvailable,
        sortOrder: sortOrder !== undefined ? sortOrder : existingItem.sortOrder,
        allergens: allergens !== undefined ? allergens : existingItem.allergens,
        calories: calories !== undefined ? calories : existingItem.calories,
        prepTime: prepTime !== undefined ? prepTime : existingItem.prepTime
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image: true,
        isAvailable: true,
        sortOrder: true,
        allergens: true,
        calories: true,
        prepTime: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Trigger embedding generation asynchronously (non-blocking)
    autoTrigger.triggerMenuItem(params.businessId, 'update', updatedItem)
      .then(result => {
        if (!result.success) {
          console.warn(`Failed to update embedding for menu item ${updatedItem.id}:`, result.error);
        }
      })
      .catch(error => {
        console.error(`Error updating embedding for menu item ${updatedItem.id}:`, error);
      });

    return NextResponse.json({
      success: true,
      data: updatedItem
    });

  } catch (error: any) {
    console.error('Update menu item error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update menu item'
      }
    }, { status: 500 });
  }
}

// DELETE /api/businesses/:businessId/menu-items/:itemId - Delete item (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { businessId: string; itemId: string } }
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
          message: 'Admin or Manager access required to delete menu items'
        }
      }, { status: 403 });
    }

    // Check if menu item exists and belongs to business
    const existingItem = await prisma.menuItem.findFirst({
      where: {
        id: params.itemId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingItem) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Menu item not found'
        }
      }, { status: 404 });
    }

    // Soft delete menu item
    await prisma.menuItem.update({
      where: { id: params.itemId },
      data: { deletedAt: new Date() }
    });

    // Trigger embedding deletion asynchronously (non-blocking)
    autoTrigger.triggerMenuItem(params.businessId, 'delete', existingItem)
      .then(result => {
        if (!result.success) {
          console.warn(`Failed to delete embedding for menu item ${existingItem.id}:`, result.error);
        }
      })
      .catch(error => {
        console.error(`Error deleting embedding for menu item ${existingItem.id}:`, error);
      });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Menu item deleted successfully'
      }
    });

  } catch (error: any) {
    console.error('Delete menu item error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete menu item'
      }
    }, { status: 500 });
  }
}
