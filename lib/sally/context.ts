/**
 * SALLY — SALES AGENT (V1)
 *
 * Responsibilities:
 * - Generate sales content inside workspaces
 * - Coach and refine sales messaging
 * - Guide manual sales execution via Playbooks
 *
 * Explicitly excluded:
 * - Lead analysis
 * - CRM behavior
 * - Automation
 * - Data enrichment
 *
 * Sally is a human-in-the-loop sales assistant,
 * not an autonomous sales agent.
 *
 * Execution Mode: CONTENT_AND_GUIDED_EXECUTION_V1
 * 
 * Tenant Context Resolution
 * 
 * This module provides tenant context resolution for Sally by reusing
 * the existing authentication and tenant isolation patterns from the codebase.
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import type { SallyTenantContext } from './types';

/**
 * Resolves tenant context from request
 * Reuses existing authenticateRequest middleware
 * 
 * Phase 0: Returns tenant context but does not use it
 * Phase 1+: Will use tenant context for multi-tenant operations
 */
export async function getSallyTenantContext(
  request: NextRequest
): Promise<SallyTenantContext | null> {
  try {
    // Reuse existing authentication middleware
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.businessId) {
      return null;
    }
    
    // Build tenant context from auth result
    const context: SallyTenantContext = {
      tenantId: authResult.businessId,
      businessName: authResult.businessName,
      userId: authResult.user?.id,
      authType: authResult.authType,
    };
    
    return context;
  } catch (error) {
    console.error('[Sally] Error resolving tenant context:', error);
    return null;
  }
}

/**
 * Validates that tenant context exists and is valid
 * Phase 0: Basic validation only
 */
export function validateSallyTenantContext(
  context: SallyTenantContext | null
): context is SallyTenantContext {
  if (!context) {
    return false;
  }
  
  if (!context.tenantId || typeof context.tenantId !== 'string' || context.tenantId.trim().length === 0) {
    return false;
  }
  
  return true;
}

