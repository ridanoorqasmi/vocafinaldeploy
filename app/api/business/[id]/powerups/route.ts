import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any

    if (payload.business_id !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const powerups = await request.json()

    // Delete existing powerups for this business
    await prisma.powerup.deleteMany({
      where: { businessId: params.id }
    })

    // Create new powerups
    const powerupEntries = Object.entries(powerups).map(([name, enabled]) => ({
      businessId: params.id,
      powerupName: name,
      enabled: enabled as boolean
    }))

    const createdPowerups = await prisma.powerup.createMany({
      data: powerupEntries
    })

    return NextResponse.json({
      success: true,
      message: 'Power-ups saved successfully',
      count: createdPowerups.count
    })

  } catch (error) {
    console.error('Error saving power-ups:', error)
    return NextResponse.json(
      { error: 'Failed to save power-ups' },
      { status: 500 }
    )
  }
}

