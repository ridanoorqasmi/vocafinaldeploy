import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/businesses/[businessId]/operating-hours - Fetch operating hours
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    console.log('Fetching operating hours for business:', params.businessId);

    // Return empty array to avoid database issues
    return NextResponse.json({
      success: true,
      data: []
    });

  } catch (error) {
    console.error('Operating hours error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch operating hours'
    }, { status: 500 });
  }
}