import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// PATCH /api/businesses/:businessId/operating-hours/:day - Update specific day
export async function PATCH(
  request: NextRequest,
  { params }: { params: { businessId: string; day: string } }
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
          message: 'Admin or Manager access required to update operating hours'
        }
      }, { status: 403 });
    }

    // Validate day parameter
    const dayOfWeek = parseInt(params.day);
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid day of week (0-6)'
        }
      }, { status: 400 });
    }

    const body = await request.json();
    const { locationId, openTime, closeTime, isClosed } = body;

    // Validate required fields
    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Location ID is required'
        }
      }, { status: 400 });
    }

    // Check if location belongs to business
    const location = await prisma.location.findFirst({
      where: {
        id: locationId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!location) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Location not found'
        }
      }, { status: 404 });
    }

    // Find existing operating hour for this day and location
    const existingHour = await prisma.operatingHour.findFirst({
      where: {
        locationId,
        dayOfWeek,
        deletedAt: null
      }
    });

    let updatedHour;

    if (existingHour) {
      // Update existing hour
      updatedHour = await prisma.operatingHour.update({
        where: { id: existingHour.id },
        data: {
          openTime: openTime || existingHour.openTime,
          closeTime: closeTime || existingHour.closeTime,
          isClosed: isClosed !== undefined ? isClosed : existingHour.isClosed
        }
      });
    } else {
      // Create new hour
      updatedHour = await prisma.operatingHour.create({
        data: {
          locationId,
          dayOfWeek,
          openTime: openTime || '09:00',
          closeTime: closeTime || '17:00',
          isClosed: isClosed || false
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedHour
    });

  } catch (error: any) {
    console.error('Update operating hour error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update operating hour'
      }
    }, { status: 500 });
  }
}
