/**
 * Phase 6: Authentication Middleware
 * Data Analyst Agent (Poppy) - Auth & Authorization Helpers
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, getUser } from './store-db';
import type { AuthSession, User } from './types';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: 'owner' | 'member' | 'viewer';
  user: User;
  session: AuthSession;
}

/**
 * Get auth context from request (server-side)
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  try {
    // Get session token from cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('poppy_session')?.value;

    if (!sessionToken) {
      return null;
    }

    const session = await getSession(sessionToken);
    if (!session) {
      return null;
    }

    const user = await getUser(session.userId);
    if (!user) {
      return null;
    }

    // Verify tenant matches
    if (user.tenantId !== session.tenantId) {
      return null;
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      user,
      session,
    };
  } catch (error) {
    console.error('[Auth] Error getting auth context:', error);
    return null;
  }
}

/**
 * Require authentication (throws if not authenticated)
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const auth = await getAuthContext(request);
  if (!auth) {
    throw new Error('UNAUTHORIZED');
  }
  return auth;
}

/**
 * Check if user has permission
 */
export function hasPermission(
  userRole: 'owner' | 'member' | 'viewer',
  requiredPermission: 'upload_dataset' | 'run_analysis' | 'view_artifacts' | 'delete_dataset'
): boolean {
  const permissions: Record<string, ('owner' | 'member' | 'viewer')[]> = {
    upload_dataset: ['owner', 'member'],
    run_analysis: ['owner', 'member'],
    view_artifacts: ['owner', 'member', 'viewer'],
    delete_dataset: ['owner'],
  };

  return permissions[requiredPermission]?.includes(userRole) ?? false;
}

/**
 * Require permission (throws if user doesn't have permission)
 */
export async function requirePermission(
  request: NextRequest,
  permission: 'upload_dataset' | 'run_analysis' | 'view_artifacts' | 'delete_dataset'
): Promise<AuthContext> {
  const auth = await requireAuth(request);
  
  if (!hasPermission(auth.role, permission)) {
    throw new Error('FORBIDDEN');
  }

  return auth;
}

/**
 * Verify tenant ownership of resource
 */
export function verifyTenantOwnership(
  tenantId: string,
  resourceTenantId: string
): boolean {
  return tenantId === resourceTenantId;
}

/**
 * Require tenant ownership (throws if resource doesn't belong to tenant)
 */
export function requireTenantOwnership(
  tenantId: string,
  resourceTenantId: string,
  resourceType: string
): void {
  if (!verifyTenantOwnership(tenantId, resourceTenantId)) {
    throw new Error(`FORBIDDEN: ${resourceType} does not belong to tenant`);
  }
}



