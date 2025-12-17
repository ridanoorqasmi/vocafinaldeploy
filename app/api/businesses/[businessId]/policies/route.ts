import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/businesses/[businessId]/policies - Fetch policies
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    console.log('Fetching policies for business:', params.businessId);

    const business = await prisma.business.findUnique({
      where: { id: params.businessId },
      include: {
        policies: {
          orderBy: { title: 'asc' }
        }
      }
    });

    if (!business) {
      return NextResponse.json({
        success: false,
        error: 'Business not found'
      }, { status: 404 });
    }

    console.log('Found policies:', business.policies.length);

    return NextResponse.json({
      success: true,
      data: business.policies
    });

  } catch (error) {
    console.error('Policies error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch policies'
    }, { status: 500 });
  }
}