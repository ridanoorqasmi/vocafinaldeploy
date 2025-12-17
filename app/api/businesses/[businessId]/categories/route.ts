import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/businesses/:businessId/categories - List categories
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('is_active');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      businessId: params.businessId,
      deletedAt: null
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // Get categories with pagination
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ],
        select: {
          id: true,
          name: true,
          description: true,
          sortOrder: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              menuItems: true
            }
          }
        }
      }),
      prisma.category.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: categories,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error: any) {
    console.error('Get categories error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve categories'
      }
    }, { status: 500 });
  }
}

// POST /api/businesses/:businessId/categories - Create category
export async function POST(
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
          message: 'Admin or Manager access required to create categories'
        }
      }, { status: 403 });
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

    // Check if category name already exists
    const existingCategory = await prisma.category.findFirst({
      where: {
        businessId: params.businessId,
        name: { equals: name.trim(), mode: 'insensitive' },
        deletedAt: null
      }
    });

    if (existingCategory) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'Category with this name already exists'
        }
      }, { status: 409 });
    }

    // Get next sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const lastCategory = await prisma.category.findFirst({
        where: { businessId: params.businessId, deletedAt: null },
        orderBy: { sortOrder: 'desc' }
      });
      finalSortOrder = lastCategory ? lastCategory.sortOrder + 1 : 0;
    }

    // Create category
    const category = await prisma.category.create({
      data: {
        businessId: params.businessId,
        name: name.trim(),
        description: description?.trim() || null,
        sortOrder: finalSortOrder,
        isActive: isActive !== false // Default to true
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
      data: category
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create category error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create category'
      }
    }, { status: 500 });
  }
}
