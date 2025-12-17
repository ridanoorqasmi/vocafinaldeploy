import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export async function POST(
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

    const { delivery_zones, timings, refund_policy, tax_rate } = await request.json()

    // Upsert business policies
    const policy = await prisma.businessPolicy.upsert({
      where: { businessId: params.id },
      update: {
        deliveryZones: delivery_zones,
        timings: timings,
        refundPolicy: refund_policy,
        taxRate: tax_rate
      },
      create: {
        businessId: params.id,
        deliveryZones: delivery_zones,
        timings: timings,
        refundPolicy: refund_policy,
        taxRate: tax_rate
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Business policies saved successfully',
      policy
    })

  } catch (error) {
    console.error('Error saving business policies:', error)
    return NextResponse.json(
      { error: 'Failed to save business policies' },
      { status: 500 }
    )
  }
}

