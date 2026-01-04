/**
 * Phase 6: Authentication Types
 * Data Analyst Agent (Poppy) - Auth & Tenant Types
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  tenantId: string;
  role: 'owner' | 'member' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  userId: string;
  tenantId: string;
  role: 'owner' | 'member' | 'viewer';
  expiresAt: string;
}

export interface TokenUsage {
  userId: string;
  tenantId: string;
  sessionId?: string;
  artifactId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number; // USD
  timestamp: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  resourceType: 'dataset' | 'session' | 'artifact' | 'user' | 'tenant';
  resourceId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}







