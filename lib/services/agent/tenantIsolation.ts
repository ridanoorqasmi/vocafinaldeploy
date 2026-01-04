/**
 * Phase 4: Tenant Isolation Enforcement
 * Defensive checks to prevent cross-tenant data leakage
 */

import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

export interface TenantValidationResult {
  valid: boolean;
  error?: string;
  tenantId?: string;
}

/**
 * Validates that tenantId exists and is active
 */
export async function validateTenantId(tenantId: string): Promise<TenantValidationResult> {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    return {
      valid: false,
      error: 'Invalid tenantId: must be a non-empty string'
    };
  }

  try {
    // Check if business exists
    const business = await prisma.business.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true }
    });

    if (!business) {
      return {
        valid: false,
        error: 'Tenant not found'
      };
    }

    // Check if business chat is active (if BusinessChatConfig exists)
    const chatConfig = await prisma.businessChatConfig.findUnique({
      where: { tenantId },
      select: { isActive: true }
    });

    if (chatConfig && !chatConfig.isActive) {
      return {
        valid: false,
        error: 'Chat support is not active for this tenant'
      };
    }

    return {
      valid: true,
      tenantId: tenantId.trim()
    };
  } catch (error) {
    console.error('Tenant validation error:', error);
    return {
      valid: false,
      error: 'Failed to validate tenant'
    };
  }
}

/**
 * Validates that a conversation belongs to the specified tenant
 */
export async function validateConversationTenant(
  conversationId: string,
  tenantId: string
): Promise<TenantValidationResult> {
  if (!conversationId || !tenantId) {
    return {
      valid: false,
      error: 'conversationId and tenantId are required'
    };
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId
      },
      select: { id: true, tenantId: true }
    });

    if (!conversation) {
      return {
        valid: false,
        error: 'Conversation not found or access denied'
      };
    }

    return {
      valid: true,
      tenantId: conversation.tenantId
    };
  } catch (error) {
    console.error('Conversation tenant validation error:', error);
    return {
      valid: false,
      error: 'Failed to validate conversation ownership'
    };
  }
}

/**
 * Validates that a resource (KB document, ticket, etc.) belongs to the tenant
 */
export async function validateResourceTenant(
  resourceId: string,
  tenantId: string,
  resourceType: 'kb_document' | 'ticket' | 'kb_chunk'
): Promise<TenantValidationResult> {
  if (!resourceId || !tenantId) {
    return {
      valid: false,
      error: 'resourceId and tenantId are required'
    };
  }

  try {
    let resource: any = null;

    switch (resourceType) {
      case 'kb_document':
        resource = await prisma.kbDocument.findFirst({
          where: { id: resourceId, tenantId },
          select: { id: true, tenantId: true }
        });
        break;
      case 'ticket':
        resource = await prisma.supportTicket.findFirst({
          where: { id: resourceId, tenantId },
          select: { id: true, tenantId: true }
        });
        break;
      case 'kb_chunk':
        resource = await prisma.kbChunk.findFirst({
          where: { id: resourceId, tenantId },
          select: { id: true, tenantId: true }
        });
        break;
    }

    if (!resource) {
      return {
        valid: false,
        error: `${resourceType} not found or access denied`
      };
    }

    return {
      valid: true,
      tenantId: resource.tenantId
    };
  } catch (error) {
    console.error('Resource tenant validation error:', error);
    return {
      valid: false,
      error: `Failed to validate ${resourceType} ownership`
    };
  }
}

/**
 * Sanitizes tenantId to prevent injection
 */
export function sanitizeTenantId(tenantId: unknown): string | null {
  if (typeof tenantId !== 'string') {
    return null;
  }

  // Remove any whitespace and validate format (alphanumeric + dashes, typical for CUID)
  const sanitized = tenantId.trim();
  if (!/^[a-z0-9-]+$/i.test(sanitized)) {
    return null;
  }

  // Reasonable length check (CUIDs are typically 25 chars)
  if (sanitized.length < 1 || sanitized.length > 100) {
    return null;
  }

  return sanitized;
}














