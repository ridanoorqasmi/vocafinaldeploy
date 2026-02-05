import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { generateAccessToken } from '@/lib/token-service'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, firstName, lastName } = body

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, first name, and last name are required'
        }
      }, { status: 400 })
    }

    // Validate email format
    if (!email.includes('@')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please enter a valid email address'
        }
      }, { status: 400 })
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long'
        }
      }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.users.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null
      }
    })

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists'
        }
      }, { status: 409 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create unique business for each user (better isolation)
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Generate unique slug based on email
      const emailSlug = email.toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '-')
      const uniqueSlug = `chat-support-${emailSlug}-${Date.now()}`

      // Create business
      const business = await tx.businesses.create({
        data: {
          id: uuidv4(),
          name: `${firstName}'s Chat Support`,
          slug: uniqueSlug,
          email: email.toLowerCase(),
          passwordHash: passwordHash,
          status: 'TRIAL',
          timezone: 'UTC',
          currency: 'USD',
          language: 'en',
          updatedAt: new Date()
        }
      })

      // Create user
      const user = await tx.users.create({
        data: {
          id: uuidv4(),
          businessId: business.id,
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          role: 'ADMIN',
          isActive: true,
          updatedAt: new Date()
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          businessId: true
        }
      })

      // Create business chat config (required for chat sessions)
      await tx.business_chat_configs.create({
        data: {
          id: uuidv4(),
          tenantId: business.id,
          isActive: true,
          updatedAt: new Date()
        }
      })

      return { business, user }
    })

    // Generate JWT token
    const token = generateAccessToken({
      userId: result.user.id,
      businessId: result.user.businessId,
      role: result.user.role as 'ADMIN' | 'MANAGER' | 'STAFF',
      email: result.user.email,
      businessSlug: result.business.slug
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role
        },
        business: {
          id: result.business.id,
          name: result.business.name,
          slug: result.business.slug
        },
        token
      }
    })

  } catch (error: any) {
    console.error('Chat auth signup error:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    })
    
    // Provide more specific error messages
    let errorMessage = 'Account creation failed. Please try again.'
    if (error.code === 'P2002') {
      // Unique constraint violation
      if (error.meta?.target?.includes('email')) {
        errorMessage = 'An account with this email already exists'
      } else if (error.meta?.target?.includes('slug')) {
        errorMessage = 'Account creation failed. Please try again in a moment.'
      }
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    }, { status: 500 })
  }
}














