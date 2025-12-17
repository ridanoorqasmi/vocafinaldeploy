import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/businesses/[businessId]/menu-items - Fetch menu items
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    console.log('Fetching menu items for business:', params.businessId);

    const business = await prisma.business.findUnique({
      where: { id: params.businessId },
      include: {
        menuItems: {
          where: { isAvailable: true },
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

    console.log('Found menu items:', business.menuItems.length);

    return NextResponse.json({
      success: true,
      data: business.menuItems
    });

  } catch (error) {
    console.error('Menu items error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch menu items'
    }, { status: 500 });
  }
}