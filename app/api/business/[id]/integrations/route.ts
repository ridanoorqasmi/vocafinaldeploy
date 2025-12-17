import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Simple encryption function (in production, use a proper encryption library)
function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.scryptSync(process.env.JWT_SECRET!, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

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

    const { stripe_key, twilio_sid, twilio_token, email_provider } = await request.json()

    // Encrypt sensitive data
    const encryptedStripeKey = stripe_key ? encrypt(stripe_key) : null
    const encryptedTwilioToken = twilio_token ? encrypt(twilio_token) : null

    // Upsert business integrations
    const integration = await prisma.businessIntegration.upsert({
      where: { businessId: params.id },
      update: {
        stripeKey: encryptedStripeKey,
        twilioSid: twilio_sid,
        twilioToken: encryptedTwilioToken,
        emailProvider: email_provider
      },
      create: {
        businessId: params.id,
        stripeKey: encryptedStripeKey,
        twilioSid: twilio_sid,
        twilioToken: encryptedTwilioToken,
        emailProvider: email_provider
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Business integrations saved successfully',
      integration: {
        ...integration,
        stripeKey: integration.stripeKey ? '***encrypted***' : null,
        twilioToken: integration.twilioToken ? '***encrypted***' : null
      }
    })

  } catch (error) {
    console.error('Error saving business integrations:', error)
    return NextResponse.json(
      { error: 'Failed to save business integrations' },
      { status: 500 }
    )
  }
}

