import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { generateAccessToken } from '@/lib/token-service'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.users.findFirst({
      where: {
        email: email.toLowerCase(),
        isActive: true,
        deletedAt: null
      },
      include: {
        businesses: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      }, { status: 401 })
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    
    if (!isPasswordValid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      }, { status: 401 })
    }

    // Update last login
    await prisma.users.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Ensure business has chat config (create if missing)
    await prisma.business_chat_configs.upsert({
      where: { tenantId: user.businessId },
      update: {
        updatedAt: new Date()
      },
      create: {
        id: uuidv4(),
        tenantId: user.businessId,
        isActive: true,
        updatedAt: new Date()
      }
    })

    // Generate JWT token
    const token = generateAccessToken({
      userId: user.id,
      businessId: user.businessId,
      role: user.role as 'ADMIN' | 'MANAGER' | 'STAFF',
      email: user.email,
      businessSlug: user.businesses.slug
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        business: {
          id: user.businesses.id,
          name: user.businesses.name,
          slug: user.businesses.slug
        },
        token
      }
    })

  } catch (error) {
    console.error('Chat auth login error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed. Please try again.'
      }
    }, { status: 500 })
  }
}














