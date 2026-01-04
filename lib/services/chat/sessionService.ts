// ===== CHAT SESSION SERVICE =====
// Phase 4: Business-level chat isolation and session management

import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

export interface ChatSessionResult {
  success: boolean;
  session?: {
    id: string;
    tenantId: string;
    conversationId: string;
    isActive: boolean;
  };
  error?: string;
}

/**
 * Create a new chat session for a business
 * Validates that the business has chat enabled
 */
export async function createChatSession(
  tenantId: string,
  conversationId: string
): Promise<ChatSessionResult> {
  try {
    // Check if business has chat enabled
    const chatConfig = await prisma.businessChatConfig.findUnique({
      where: { tenantId }
    });

    // If config doesn't exist, create it (backward compatibility)
    if (!chatConfig) {
      await prisma.businessChatConfig.create({
        data: {
          tenantId,
          isActive: true
        }
      });
    } else if (!chatConfig.isActive) {
      return {
        success: false,
        error: 'Chat is not enabled for this business'
      };
    }

    // Create chat session
    const session = await prisma.chatSession.create({
      data: {
        tenantId,
        conversationId,
        isActive: true,
        // Sessions expire after 24 hours of inactivity
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    return {
      success: true,
      session: {
        id: session.id,
        tenantId: session.tenantId,
        conversationId: session.conversationId,
        isActive: session.isActive
      }
    };
  } catch (error) {
    console.error('Error creating chat session:', error);
    return {
      success: false,
      error: 'Failed to create chat session'
    };
  }
}

/**
 * Validate a chat session
 * Ensures session exists, belongs to tenant, and is active
 */
export async function validateChatSession(
  chatSessionId: string,
  tenantId: string
): Promise<ChatSessionResult> {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: chatSessionId }
    });

    if (!session) {
      return {
        success: false,
        error: 'Chat session not found'
      };
    }

    // Verify session belongs to tenant
    if (session.tenantId !== tenantId) {
      return {
        success: false,
        error: 'Chat session does not belong to this business'
      };
    }

    // Check if session is active
    if (!session.isActive) {
      return {
        success: false,
        error: 'Chat session is not active'
      };
    }

    // Check if session has expired
    if (session.expiresAt && new Date() > session.expiresAt) {
      // Mark session as inactive
      await prisma.chatSession.update({
        where: { id: chatSessionId },
        data: { isActive: false }
      });

      return {
        success: false,
        error: 'Chat session has expired'
      };
    }

    return {
      success: true,
      session: {
        id: session.id,
        tenantId: session.tenantId,
        conversationId: session.conversationId,
        isActive: session.isActive
      }
    };
  } catch (error) {
    console.error('Error validating chat session:', error);
    return {
      success: false,
      error: 'Failed to validate chat session'
    };
  }
}

/**
 * Get tenantId from chat session
 * Used to ensure KB queries are isolated by business
 */
export async function getTenantIdFromSession(
  chatSessionId: string
): Promise<string | null> {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      select: { tenantId: true, isActive: true, expiresAt: true }
    });

    if (!session || !session.isActive) {
      return null;
    }

    // Check expiration
    if (session.expiresAt && new Date() > session.expiresAt) {
      return null;
    }

    return session.tenantId;
  } catch (error) {
    console.error('Error getting tenantId from session:', error);
    return null;
  }
}














