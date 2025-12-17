import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('Simple login endpoint called');
    
    const body = await request.json();
    console.log('Request body:', body);

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { 
        email: body.email.toLowerCase(),
        isActive: true
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      }, { status: 401 });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(body.password, user.passwordHash);
    
    if (!isPasswordValid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      }, { status: 401 });
    }

    console.log('Login successful for user:', user.email);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          businessId: user.businessId
        },
        business: {
          id: user.business.id,
          name: user.business.name,
          slug: user.business.slug,
          status: user.business.status
        },
        message: 'Login successful'
      }
    });

  } catch (error) {
    console.error('Simple login error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed. Please try again.'
      }
    }, { status: 500 });
  }
}
