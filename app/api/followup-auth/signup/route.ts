import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
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
    const existingUser = await prisma.user.findFirst({
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

    // Create a default business for this user (for followup agent, we can use a simple structure)
    // Or find/create a generic business for followup agent users
    let business = await prisma.business.findFirst({
      where: {
        slug: 'followup-agent-default'
      }
    })

    if (!business) {
      business = await prisma.business.create({
        data: {
          name: 'Follow-Up Agent',
          slug: 'followup-agent-default',
          email: email.toLowerCase(),
          passwordHash: passwordHash, // This won't be used but required by schema
          status: 'TRIAL'
        }
      })
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        businessId: business.id,
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role: 'ADMIN', // Followup agent users are admins of their own data
        isActive: true
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

    // Generate JWT token
    const token = generateAccessToken({
      userId: user.id,
      businessId: user.businessId,
      role: user.role as 'ADMIN' | 'MANAGER' | 'STAFF',
      email: user.email,
      businessSlug: business.slug
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
        token
      }
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Account creation failed. Please try again.'
      }
    }, { status: 500 })
  }
}

