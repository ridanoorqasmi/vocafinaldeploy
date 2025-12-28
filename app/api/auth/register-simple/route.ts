import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('Simple register endpoint called');
    
    const body = await request.json();
    console.log('Request body:', body);

    // Validate required fields
    if (!body.businessName || !body.businessSlug || !body.firstName || !body.lastName || !body.email || !body.password) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Missing required fields'
        }
      }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: body.email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Email address is already registered'
        }
      }, { status: 409 });
    }

    // Check if business slug already exists
    const existingBusiness = await prisma.business.findFirst({
      where: { slug: body.businessSlug.toLowerCase() }
    });

    if (existingBusiness) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SLUG_ALREADY_EXISTS',
          message: 'Business slug is already taken'
        }
      }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 12);

    // Create business and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create business
      const business = await tx.business.create({
        data: {
          name: body.businessName,
          slug: body.businessSlug.toLowerCase(),
          email: body.email.toLowerCase(),
          passwordHash: passwordHash,
          status: 'TRIAL',
          timezone: 'UTC',
          currency: 'USD',
          language: 'en'
        }
      });

      // Create admin user
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          email: body.email.toLowerCase(),
          passwordHash: passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          role: 'ADMIN',
          isActive: true
        }
      });

      // Phase 4: Create business chat config (enabled by default)
      await tx.businessChatConfig.create({
        data: {
          tenantId: business.id,
          isActive: true
        }
      });

      return { business, user };
    });

    console.log('Registration successful:', result);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          isActive: result.user.isActive
        },
        business: {
          id: result.business.id,
          name: result.business.name,
          slug: result.business.slug,
          status: result.business.status
        },
        message: 'Registration successful'
      }
    });

  } catch (error) {
    console.error('Simple registration error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed. Please try again.'
      }
    }, { status: 500 });
  }
}
