/**
 * Phase 6: Authentication API
 * Data Analyst Agent (Poppy) - Registration Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createTenant, createUser, createSession } from '@/lib/auth/store-db';
import { createAuditLog } from '@/lib/auth/store-db';
import { cookies } from 'next/headers';

const registerRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * POST /api/auth/register-poppy
 * Register a new user and create a tenant
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request', code: 'VALIDATION_ERROR', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const { name, email, password } = validation.data;

    // Check if user already exists
    try {
      // Create a new tenant for the user
      const tenant = await createTenant(`${name}'s Organization`);
      
      // Create the user as owner of the tenant
      const user = await createUser(email, password, tenant.id, name, 'owner');
      
      // Create session
      const sessionToken = await createSession(user.id, tenant.id, user.role);
      
      // Set HTTP-only cookie
      const cookieStore = await cookies();
      cookieStore.set('poppy_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });

      // Audit log
      await createAuditLog(user.id, tenant.id, 'register', 'user', user.id);

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
        },
      });
    } catch (error) {
      // Check if error is due to existing email
      if (error instanceof Error && error.message.includes('already exists')) {
        return NextResponse.json(
          { error: { message: 'Email already registered', code: 'EMAIL_EXISTS' } },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    return NextResponse.json(
      { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}





