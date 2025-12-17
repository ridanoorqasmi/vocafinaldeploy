import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/businesses/:businessId/team - List team members
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
    const role = searchParams.get('role');
    const isActive = searchParams.get('is_active');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      businessId: params.businessId,
      deletedAt: null
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // Get team members with pagination
    const [teamMembers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { role: 'asc' },
          { firstName: 'asc' }
        ],
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    // Get role counts
    const roleCounts = await prisma.user.groupBy({
      by: ['role'],
      where: {
        businessId: params.businessId,
        deletedAt: null
      },
      _count: {
        role: true
      }
    });

    const roleSummary = roleCounts.reduce((acc, item) => {
      acc[item.role] = item._count.role;
      return acc;
    }, {} as any);

    return NextResponse.json({
      success: true,
      data: {
        items: teamMembers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        summary: {
          totalMembers: total,
          activeMembers: teamMembers.filter(member => member.isActive).length,
          roleCounts: roleSummary
        }
      }
    });

  } catch (error: any) {
    console.error('Get team members error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve team members'
      }
    }, { status: 500 });
  }
}

