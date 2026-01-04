/**
 * Phase 6: Authentication API
 * Data Analyst Agent (Poppy) - Logout Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth/store-db';
import { getAuthContext } from '@/lib/auth/middleware';
import { createAuditLog } from '@/lib/auth/store-db';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/logout
 * Destroy session
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('poppy_session')?.value;

    if (sessionToken) {
      // Get auth context for audit log
      const auth = await getAuthContext(request);
      if (auth) {
        await createAuditLog(auth.userId, auth.tenantId, 'logout', 'user', auth.userId);
      }

      // Delete session
      await deleteSession(sessionToken);
    }

    // Clear cookie
    cookieStore.delete('poppy_session');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return NextResponse.json(
      { error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
