/**
 * Phase 6: Database-Backed Auth Store
 * Data Analyst Agent (Poppy) - Auth Storage with Prisma
 * 
 * This is the database-backed version of auth/store.ts
 * Replace in-memory store with this after migration
 */

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { User, Tenant, AuthSession, TokenUsage, AuditLog } from './types';

/**
 * Create a new tenant
 */
export async function createTenant(name: string): Promise<Tenant> {
  const tenant = await prisma.poppyTenant.create({
    data: { id: uuidv4(), name },
  });

  return {
    id: tenant.id,
    name: tenant.name,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

/**
 * Get tenant by ID
 */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const tenant = await prisma.poppyTenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) return null;

  return {
    id: tenant.id,
    name: tenant.name,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

/**
 * Create a new user
 */
export async function createUser(
  email: string,
  password: string,
  tenantId: string,
  name?: string,
  role: 'owner' | 'member' | 'viewer' = 'member'
): Promise<User> {
  // Check if email already exists
  const existing = await prisma.poppyUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.poppyUser.create({
    data: {
      id: uuidv4(),
      email: email.toLowerCase(),
      name: name || null,
      passwordHash,
      tenantId,
      role: role.toUpperCase() as any,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    tenantId: user.tenantId,
    role: user.role.toLowerCase() as 'owner' | 'member' | 'viewer',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const user = await prisma.poppyUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) return null;

  // Verify password (if passwordHash exists)
  if (user.passwordHash) {
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;
  } else {
    // For demo users without password hash, accept any password
    // In production, all users should have passwordHash
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    tenantId: user.tenantId,
    role: user.role.toLowerCase() as 'owner' | 'member' | 'viewer',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Create an auth session
 */
export async function createSession(
  userId: string,
  tenantId: string,
  role: 'owner' | 'member' | 'viewer'
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

  const session = await prisma.poppyAuthSession.create({
    data: {
      id: uuidv4(),
      userId,
      tenantId,
      role: role.toUpperCase() as any,
      expiresAt,
    },
  });

  return session.id;
}

/**
 * Get session by token
 */
export async function getSession(sessionToken: string): Promise<AuthSession | null> {
  const session = await prisma.poppyAuthSession.findUnique({
    where: { id: sessionToken },
  });

  if (!session) return null;

  // Check expiry
  if (session.expiresAt < new Date()) {
    await prisma.poppyAuthSession.delete({
      where: { id: sessionToken },
    });
    return null;
  }

  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role.toLowerCase() as 'owner' | 'member' | 'viewer',
    expiresAt: session.expiresAt.toISOString(),
  };
}

/**
 * Delete session
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  await prisma.poppyAuthSession.delete({
    where: { id: sessionToken },
  }).catch(() => {
    // Ignore if session doesn't exist
  });
}

/**
 * Get user by ID
 */
export async function getUser(userId: string): Promise<User | null> {
  const user = await prisma.poppyUser.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    tenantId: user.tenantId,
    role: user.role.toLowerCase() as 'owner' | 'member' | 'viewer',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.poppyUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    tenantId: user.tenantId,
    role: user.role.toLowerCase() as 'owner' | 'member' | 'viewer',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Track token usage
 */
export async function trackTokenUsage(
  usage: Omit<TokenUsage, 'timestamp'>
): Promise<void> {
  await prisma.poppyTokenUsage.create({
    data: {
      id: uuidv4(),
      userId: usage.userId,
      tenantId: usage.tenantId,
      sessionId: usage.sessionId || null,
      artifactId: usage.artifactId || null,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedCost: usage.estimatedCost,
    },
  });
}

/**
 * Get token usage for user
 */
export async function getTokenUsage(userId: string, limit = 100): Promise<TokenUsage[]> {
  const usages = await prisma.poppyTokenUsage.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return usages.map(u => ({
    userId: u.userId,
    tenantId: u.tenantId,
    sessionId: u.sessionId || undefined,
    artifactId: u.artifactId || undefined,
    promptTokens: u.promptTokens,
    completionTokens: u.completionTokens,
    totalTokens: u.totalTokens,
    estimatedCost: u.estimatedCost,
    timestamp: u.timestamp.toISOString(),
  }));
}

/**
 * Get token usage for tenant
 */
export async function getTenantTokenUsage(
  tenantId: string,
  limit = 1000
): Promise<TokenUsage[]> {
  const usages = await prisma.poppyTokenUsage.findMany({
    where: { tenantId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return usages.map(u => ({
    userId: u.userId,
    tenantId: u.tenantId,
    sessionId: u.sessionId || undefined,
    artifactId: u.artifactId || undefined,
    promptTokens: u.promptTokens,
    completionTokens: u.completionTokens,
    totalTokens: u.totalTokens,
    estimatedCost: u.estimatedCost,
    timestamp: u.timestamp.toISOString(),
  }));
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
  userId: string,
  tenantId: string,
  action: string,
  resourceType: 'dataset' | 'session' | 'artifact' | 'user' | 'tenant',
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<AuditLog> {
  const log = await prisma.poppyAuditLog.create({
    data: {
      id: uuidv4(),
      userId,
      tenantId,
      action,
      resourceType,
      resourceId: resourceId || null,
      metadata: metadata || null,
    },
  });

  return {
    id: log.id,
    userId: log.userId,
    tenantId: log.tenantId,
    action: log.action,
    resourceType: log.resourceType as any,
    resourceId: log.resourceId || undefined,
    metadata: (log.metadata as any) || undefined,
    timestamp: log.timestamp.toISOString(),
  };
}

/**
 * Get audit logs for tenant
 */
export async function getAuditLogsByTenant(
  tenantId: string,
  limit = 1000
): Promise<AuditLog[]> {
  const logs = await prisma.poppyAuditLog.findMany({
    where: { tenantId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return logs.map(log => ({
    id: log.id,
    userId: log.userId,
    tenantId: log.tenantId,
    action: log.action,
    resourceType: log.resourceType as any,
    resourceId: log.resourceId || undefined,
    metadata: (log.metadata as any) || undefined,
    timestamp: log.timestamp.toISOString(),
  }));
}

/**
 * Get audit logs for user
 */
export async function getAuditLogsByUser(
  userId: string,
  limit = 1000
): Promise<AuditLog[]> {
  const logs = await prisma.poppyAuditLog.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return logs.map(log => ({
    id: log.id,
    userId: log.userId,
    tenantId: log.tenantId,
    action: log.action,
    resourceType: log.resourceType as any,
    resourceId: log.resourceId || undefined,
    metadata: (log.metadata as any) || undefined,
    timestamp: log.timestamp.toISOString(),
  }));
}

/**
 * Initialize demo tenant and user (for development)
 */
export async function initializeDemoTenant(): Promise<{ tenant: Tenant; user: User }> {
  // Check if demo tenant already exists
  let tenant = await prisma.poppyTenant.findFirst({
    where: { name: 'Demo Tenant' },
    include: {
      users: {
        take: 1,
      },
    },
  });

  if (tenant && tenant.users.length > 0) {
    const user = tenant.users[0];
    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        tenantId: user.tenantId,
        role: user.role.toLowerCase() as 'owner' | 'member' | 'viewer',
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  // Create demo tenant
  tenant = await prisma.poppyTenant.create({
    data: {
      id: uuidv4(),
      name: 'Demo Tenant',
      users: {
        create: {
          id: uuidv4(),
          email: 'demo@example.com',
          name: 'Demo User',
          passwordHash: await bcrypt.hash('demo123', 10),
          role: 'OWNER',
        },
      },
    },
    include: {
      users: {
        take: 1,
      },
    },
  });

  const user = tenant.users[0];

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      tenantId: user.tenantId,
      role: user.role.toLowerCase() as 'owner' | 'member' | 'viewer',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  };
}

