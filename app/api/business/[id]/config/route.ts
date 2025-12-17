import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export async function GET(
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

    // Get all configuration data for the business
    const [menus, policies, integrations, powerups] = await Promise.all([
      prisma.menu.findMany({
        where: { businessId: params.id },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.businessPolicy.findUnique({
        where: { businessId: params.id }
      }),
      prisma.businessIntegration.findUnique({
        where: { businessId: params.id }
      }),
      prisma.powerup.findMany({
        where: { businessId: params.id }
      })
    ])

    // Transform data to match frontend format
    const config = {
      menu: {
        items: menus.map(menu => ({
          id: menu.id,
          item_name: menu.itemName,
          description: menu.description,
          price: menu.price,
          available: menu.available,
          category: menu.category,
          ai_suggested: menu.aiSuggested
        })),
        categories: [...new Set(menus.map(menu => menu.category).filter(Boolean))]
      },
      policies: policies ? {
        delivery_zones: policies.deliveryZones as string[],
        timings: policies.timings,
        refund_policy: policies.refundPolicy,
        tax_rate: policies.taxRate
      } : {
        delivery_zones: [],
        timings: '',
        refund_policy: '',
        tax_rate: 0
      },
      integrations: integrations ? {
        stripe_key: integrations.stripeKey ? '***encrypted***' : '',
        twilio_sid: integrations.twilioSid || '',
        twilio_token: integrations.twilioToken ? '***encrypted***' : '',
        email_provider: integrations.emailProvider
      } : {
        stripe_key: '',
        twilio_sid: '',
        twilio_token: '',
        email_provider: 'gmail'
      },
      powerups: powerups.reduce((acc, powerup) => {
        acc[powerup.powerupName] = powerup.enabled
        return acc
      }, {} as Record<string, boolean>)
    }

    return NextResponse.json({
      success: true,
      config
    })

  } catch (error) {
    console.error('Error fetching business config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch business configuration' },
      { status: 500 }
    )
  }
}

