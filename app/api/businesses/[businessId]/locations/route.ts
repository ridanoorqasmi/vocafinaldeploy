import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/businesses/[businessId]/locations - Fetch locations
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    console.log('Fetching locations for business:', params.businessId);

    const business = await prisma.business.findUnique({
      where: { id: params.businessId },
      include: {
        locations: {
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!business) {
      return NextResponse.json({
        success: false,
        error: 'Business not found'
      }, { status: 404 });
    }

    console.log('Found locations:', business.locations.length);

    return NextResponse.json({
      success: true,
      data: business.locations
    });

  } catch (error) {
    console.error('Locations error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch locations'
    }, { status: 500 });
  }
}