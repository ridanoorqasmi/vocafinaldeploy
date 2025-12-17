import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBusinessIdFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const businessId = getBusinessIdFromRequest(request)
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const powerups = await prisma.powerup.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' }
    })
    
    return NextResponse.json({
      success: true,
      data: powerups
    })
    
  } catch (error) {
    console.error('Get powerups error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch powerups' },
      { status: 500 }
    )
  }
}
