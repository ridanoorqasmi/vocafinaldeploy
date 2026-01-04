/**
 * Phase 6: Authentication API
 * Data Analyst Agent (Poppy) - Login Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser, createSession, initializeDemoTenant } from '@/lib/auth/store-db';
import { createAuditLog } from '@/lib/auth/store-db';
import { cookies } from 'next/headers';

const loginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { message: 'Invalid request', code: 'VALIDATION_ERROR', details: validation.error.errors } },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // For demo mode: initialize demo tenant if needed
    if (email === 'demo@example.com') {
      const { tenant, user } = await initializeDemoTenant();
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
      await createAuditLog(user.id, tenant.id, 'login', 'user', user.id);

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
        },
      });
    }

    // Authenticate user
    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json(
        { error: { message: 'Invalid email or password', code: 'AUTH_ERROR' } },
        { status: 401 }
      );
    }

    // Create session
    const sessionToken = await createSession(user.id, user.tenantId, user.role);

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
    await createAuditLog(user.id, user.tenantId, 'login', 'user', user.id);

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
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
