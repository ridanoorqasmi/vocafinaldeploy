/**
 * Phase 6: Authentication Store
 * Data Analyst Agent (Poppy) - In-Memory Auth Store
 * 
 * Stores users, tenants, and sessions
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import type { User, Tenant, AuthSession, TokenUsage, AuditLog } from './types';

// In-memory stores
const users = new Map<string, User>();
const tenants = new Map<string, Tenant>();
const sessions = new Map<string, AuthSession>(); // sessionToken -> AuthSession
const tokenUsage = new Map<string, TokenUsage[]>(); // userId -> TokenUsage[]
const auditLogs = new Map<string, AuditLog>(); // logId -> AuditLog

// Indexes
const usersByEmail = new Map<string, string>(); // email -> userId
const usersByTenant = new Map<string, string[]>(); // tenantId -> userIds[]
const sessionsByUserId = new Map<string, string[]>(); // userId -> sessionTokens[]
const auditLogsByTenant = new Map<string, string[]>(); // tenantId -> logIds[]
const auditLogsByUserId = new Map<string, string[]>(); // userId -> logIds[]

/**
 * Create a new tenant
 */
export function createTenant(name: string): Tenant {
  const tenant: Tenant = {
    id: uuidv4(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tenants.set(tenant.id, tenant);
  usersByTenant.set(tenant.id, []);

  return tenant;
}

/**
 * Get tenant by ID
 */
export function getTenant(tenantId: string): Tenant | null {
  return tenants.get(tenantId) || null;
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
  if (usersByEmail.has(email.toLowerCase())) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const user: User = {
    id: uuidv4(),
    email: email.toLowerCase(),
    name,
    tenantId,
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.set(user.id, user);
  usersByEmail.set(user.email, user.id);

  // Update indexes
  const userIds = usersByTenant.get(tenantId) || [];
  userIds.push(user.id);
  usersByTenant.set(tenantId, userIds);

  return user;
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const userId = usersByEmail.get(email.toLowerCase());
  if (!userId) {
    return null;
  }

  const user = users.get(userId);
  if (!user) {
    return null;
  }

  // In a real implementation, we'd verify the password hash
  // For now, we'll use a simple check (Phase 6: implement proper password verification)
  // For demo purposes, accept any password if user exists
  // TODO: Implement proper password verification with stored hashes

  return user;
}

/**
 * Create an auth session
 */
export function createSession(userId: string, tenantId: string, role: 'owner' | 'member' | 'viewer'): string {
  const sessionToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

  const session: AuthSession = {
    userId,
    tenantId,
    role,
    expiresAt: expiresAt.toISOString(),
  };

  sessions.set(sessionToken, session);

  // Update indexes
  const sessionTokens = sessionsByUserId.get(userId) || [];
  sessionTokens.push(sessionToken);
  sessionsByUserId.set(userId, sessionTokens);

  return sessionToken;
}

/**
 * Get session by token
 */
export function getSession(sessionToken: string): AuthSession | null {
  const session = sessions.get(sessionToken);
  if (!session) {
    return null;
  }

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    sessions.delete(sessionToken);
    return null;
  }

  return session;
}

/**
 * Delete session
 */
export function deleteSession(sessionToken: string): void {
  const session = sessions.get(sessionToken);
  if (session) {
    sessions.delete(sessionToken);
    
    // Update indexes
    const sessionTokens = sessionsByUserId.get(session.userId) || [];
    const index = sessionTokens.indexOf(sessionToken);
    if (index > -1) {
      sessionTokens.splice(index, 1);
      sessionsByUserId.set(session.userId, sessionTokens);
    }
  }
}

/**
 * Get user by ID
 */
export function getUser(userId: string): User | null {
  return users.get(userId) || null;
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
  const userId = usersByEmail.get(email.toLowerCase());
  if (!userId) return null;
  return users.get(userId) || null;
}

/**
 * Track token usage
 */
export function trackTokenUsage(usage: Omit<TokenUsage, 'timestamp'>): void {
  const log: TokenUsage = {
    ...usage,
    timestamp: new Date().toISOString(),
  };

  const usages = tokenUsage.get(usage.userId) || [];
  usages.push(log);
  tokenUsage.set(usage.userId, usages);
}

/**
 * Get token usage for user
 */
export function getTokenUsage(userId: string, limit = 100): TokenUsage[] {
  const usages = tokenUsage.get(userId) || [];
  return usages.slice(-limit);
}

/**
 * Get token usage for tenant
 */
export function getTenantTokenUsage(tenantId: string, limit = 1000): TokenUsage[] {
  const allUsages: TokenUsage[] = [];
  const userIds = usersByTenant.get(tenantId) || [];
  
  for (const userId of userIds) {
    const usages = tokenUsage.get(userId) || [];
    allUsages.push(...usages);
  }

  return allUsages
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Create audit log entry
 */
export function createAuditLog(
  userId: string,
  tenantId: string,
  action: string,
  resourceType: 'dataset' | 'session' | 'artifact' | 'user' | 'tenant',
  resourceId?: string,
  metadata?: Record<string, unknown>
): AuditLog {
  const log: AuditLog = {
    id: uuidv4(),
    userId,
    tenantId,
    action,
    resourceType,
    resourceId,
    metadata,
    timestamp: new Date().toISOString(),
  };

  auditLogs.set(log.id, log);

  // Update indexes
  const logIds = auditLogsByTenant.get(tenantId) || [];
  logIds.push(log.id);
  auditLogsByTenant.set(tenantId, logIds);

  const userLogIds = auditLogsByUserId.get(userId) || [];
  userLogIds.push(log.id);
  auditLogsByUserId.set(userId, userLogIds);

  return log;
}

/**
 * Get audit logs for tenant
 */
export function getAuditLogsByTenant(tenantId: string, limit = 1000): AuditLog[] {
  const logIds = auditLogsByTenant.get(tenantId) || [];
  return logIds
    .map(id => auditLogs.get(id))
    .filter((log): log is AuditLog => log !== undefined)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Get audit logs for user
 */
export function getAuditLogsByUser(userId: string, limit = 1000): AuditLog[] {
  const logIds = auditLogsByUserId.get(userId) || [];
  return logIds
    .map(id => auditLogs.get(id))
    .filter((log): log is AuditLog => log !== undefined)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Initialize demo tenant and user (for development)
 */
export async function initializeDemoTenant(): Promise<{ tenant: Tenant; user: User }> {
  // Check if demo tenant already exists
  const existingTenant = Array.from(tenants.values()).find(t => t.name === 'Demo Tenant');
  if (existingTenant) {
    const userIds = usersByTenant.get(existingTenant.id) || [];
    if (userIds.length > 0) {
      const user = users.get(userIds[0]);
      if (user) {
        return { tenant: existingTenant, user };
      }
    }
  }

  // Create demo tenant
  const tenant = createTenant('Demo Tenant');
  
  // Create demo user
  const user = await createUser(
    'demo@example.com',
    'demo123',
    tenant.id,
    'Demo User',
    'owner'
  );

  return { tenant, user };
}

