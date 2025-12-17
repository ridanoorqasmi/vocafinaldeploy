import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireBusinessAccess } from '@/lib/auth';

const prisma = new PrismaClient();

// PUT /api/businesses/:businessId/locations/:locationId - Update location
export async function PUT(
  request: NextRequest,
  { params }: { params: { businessId: string; locationId: string } }
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
          message: 'Admin or Manager access required to update locations'
        }
      }, { status: 403 });
    }

    // Check if location exists and belongs to business
    const existingLocation = await prisma.location.findFirst({
      where: {
        id: params.locationId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingLocation) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Location not found'
        }
      }, { status: 404 });
    }

    const body = await request.json();
    const { name, address, city, state, zipCode, country, phone, isActive } = body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Location name is required'
        }
      }, { status: 400 });
    }

    if (!address || address.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Address is required'
        }
      }, { status: 400 });
    }

    if (!city || city.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'City is required'
        }
      }, { status: 400 });
    }

    // Update location
    const updatedLocation = await prisma.location.update({
      where: { id: params.locationId },
      data: {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state?.trim() || '',
        zipCode: zipCode?.trim() || '',
        country: country?.trim() || 'US',
        phone: phone?.trim() || null,
        isActive: isActive !== undefined ? isActive : existingLocation.isActive
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedLocation
    });

  } catch (error: any) {
    console.error('Update location error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update location'
      }
    }, { status: 500 });
  }
}

// DELETE /api/businesses/:businessId/locations/:locationId - Remove location (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { businessId: string; locationId: string } }
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
          message: 'Admin access required to delete locations'
        }
      }, { status: 403 });
    }

    // Check if location exists and belongs to business
    const existingLocation = await prisma.location.findFirst({
      where: {
        id: params.locationId,
        businessId: params.businessId,
        deletedAt: null
      }
    });

    if (!existingLocation) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Location not found'
        }
      }, { status: 404 });
    }

    // Soft delete location and related operating hours
    await prisma.$transaction([
      prisma.operatingHour.updateMany({
        where: { locationId: params.locationId },
        data: { deletedAt: new Date() }
      }),
      prisma.location.update({
        where: { id: params.locationId },
        data: { deletedAt: new Date() }
      })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Location deleted successfully'
      }
    });

  } catch (error: any) {
    console.error('Delete location error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete location'
      }
    }, { status: 500 });
  }
}
