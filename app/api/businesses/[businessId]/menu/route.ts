import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/businesses/:businessId/menu - Get full menu
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
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

    // Check business access
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Build where clause for menu items
    const menuItemWhere: any = {
      businessId: params.businessId,
      deletedAt: null
    };

    if (!includeInactive) {
      menuItemWhere.isAvailable = true;
    }

    // Get categories with their menu items
    const categories = await prisma.category.findMany({
      where: {
        businessId: params.businessId,
        deletedAt: null,
        isActive: true
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        menuItems: {
          where: menuItemWhere,
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' }
          ],
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
            prepTime: true
          }
        }
      }
    });

    // Get uncategorized menu items
    const uncategorizedItems = await prisma.menuItem.findMany({
      where: {
        ...menuItemWhere,
        categoryId: null
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
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
        prepTime: true
      }
    });

    // Structure the menu response
    const menu = {
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        items: category.menuItems
      })),
      uncategorized: uncategorizedItems.length > 0 ? {
        name: 'Other Items',
        items: uncategorizedItems
      } : null,
      summary: {
        totalCategories: categories.length,
        totalItems: categories.reduce((sum, cat) => sum + cat.menuItems.length, 0) + uncategorizedItems.length,
        availableItems: categories.reduce((sum, cat) => 
          sum + cat.menuItems.filter(item => item.isAvailable).length, 0
        ) + uncategorizedItems.filter(item => item.isAvailable).length
      }
    };

    return NextResponse.json({
      success: true,
      data: menu
    });

  } catch (error: any) {
    console.error('Get menu error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve menu'
      }
    }, { status: 500 });
  }
}
