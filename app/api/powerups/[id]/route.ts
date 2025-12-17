import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBusinessIdFromRequest } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const businessId = getBusinessIdFromRequest(request)
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { enabled } = body
    
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Enabled field must be a boolean' },
        { status: 400 }
      )
    }
    
    const powerup = await prisma.powerup.findFirst({
      where: {
        id: params.id,
        businessId
      }
    })
    
    if (!powerup) {
      return NextResponse.json(
        { error: 'Powerup not found' },
        { status: 404 }
      )
    }
    
    const updatedPowerup = await prisma.powerup.update({
      where: { id: params.id },
      data: { enabled }
    })
    
    return NextResponse.json({
      success: true,
      data: updatedPowerup
    })
    
  } catch (error) {
    console.error('Update powerup error:', error)
    return NextResponse.json(
      { error: 'Failed to update powerup' },
      { status: 500 }
    )
  }
}
