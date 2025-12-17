import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';
import { createAutoTrigger } from '@/lib/auto-trigger';

const prisma = new PrismaClient();
const autoTrigger = createAutoTrigger(prisma);

// GET /api/businesses/:businessId/knowledge-base - List FAQ items
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
    const category = searchParams.get('category');
    const isActive = searchParams.get('is_active');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      businessId: params.businessId,
      deletedAt: null
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ];
    }

    if (category) {
      where.category = category;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // Get knowledge base items with pagination
    const [knowledgeBase, total] = await Promise.all([
      prisma.knowledgeBase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.knowledgeBase.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: knowledgeBase,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error: any) {
    console.error('Get knowledge base error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve knowledge base'
      }
    }, { status: 500 });
  }
}

// POST /api/businesses/:businessId/knowledge-base - Create FAQ
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
          message: 'Admin or Manager access required to create knowledge base items'
        }
      }, { status: 403 });
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

    // Create knowledge base item
    const knowledgeBaseItem = await prisma.knowledgeBase.create({
      data: {
        businessId: params.businessId,
        title: title.trim(),
        content: content.trim(),
        category: category.trim(),
        tags: tags || [],
        isActive: isActive !== false, // Default to true
        viewCount: 0
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
    autoTrigger.triggerFAQ(params.businessId, 'create', knowledgeBaseItem)
      .then(result => {
        if (!result.success) {
          console.warn(`Failed to generate embedding for FAQ ${knowledgeBaseItem.id}:`, result.error);
        }
      })
      .catch(error => {
        console.error(`Error generating embedding for FAQ ${knowledgeBaseItem.id}:`, error);
      });

    return NextResponse.json({
      success: true,
      data: knowledgeBaseItem
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create knowledge base item error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create knowledge base item'
      }
    }, { status: 500 });
  }
}

