import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface ApiKeyData {
  id: string;
  name: string;
  keyHash: string;
  status: 'ACTIVE' | 'INACTIVE' | 'REVOKED';
  permissions: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  expiresAt?: Date;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key: string; // Only returned on creation
  status: string;
  permissions: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * Generates a secure API key
 */
export function generateApiKey(): string {
  const prefix = 'voca_';
  const randomBytes = crypto.randomBytes(32);
  const key = randomBytes.toString('base64url');
  return `${prefix}${key}`;
}

/**
 * Hashes an API key for secure storage
 */
export async function hashApiKey(key: string): Promise<string> {
  return await bcrypt.hash(key, 12);
}

/**
 * Verifies an API key against its hash
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(key, hash);
}

/**
 * Creates a new API key for a business
 */
export async function createApiKey(
  businessId: string, 
  data: CreateApiKeyRequest
): Promise<{ success: boolean; data?: ApiKeyResponse; error?: any }> {
  try {
    // Validate business exists and is active
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        status: { in: ['ACTIVE', 'TRIAL'] },
        deletedAt: null
      },
      select: { id: true }
    });

    if (!business) {
      return {
        success: false,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: 'Business not found or inactive'
        }
      };
    }

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);

    // Create API key record
    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        businessId,
        name: data.name,
        keyHash,
        status: 'ACTIVE',
        permissions: data.permissions,
        expiresAt: data.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
        lastUsedAt: null
      }
    });

    return {
      success: true,
      data: {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        key: apiKey, // Only return the actual key on creation
        status: apiKeyRecord.status,
        permissions: apiKeyRecord.permissions,
        lastUsedAt: apiKeyRecord.lastUsedAt,
        expiresAt: apiKeyRecord.expiresAt,
        createdAt: apiKeyRecord.createdAt
      }
    };
  } catch (error: any) {
    console.error('Create API key error:', error);
    return {
      success: false,
      error: {
        code: 'CREATE_API_KEY_ERROR',
        message: 'Failed to create API key'
      }
    };
  }
}

/**
 * Lists all API keys for a business
 */
export async function listApiKeys(
  businessId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const skip = (page - 1) * limit;

    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where: {
          businessId,
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          status: true,
          permissions: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.apiKey.count({
        where: {
          businessId,
          deletedAt: null
        }
      })
    ]);

    return {
      success: true,
      data: {
        items: apiKeys,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    };
  } catch (error: any) {
    console.error('List API keys error:', error);
    return {
      success: false,
      error: {
        code: 'LIST_API_KEYS_ERROR',
        message: 'Failed to list API keys'
      }
    };
  }
}

/**
 * Updates an API key
 */
export async function updateApiKey(
  businessId: string,
  keyId: string,
  updates: Partial<CreateApiKeyRequest>
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        businessId,
        deletedAt: null
      }
    });

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      };
    }

    const updatedApiKey = await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.permissions && { permissions: updates.permissions }),
        ...(updates.expiresAt && { expiresAt: updates.expiresAt }),
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        status: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return {
      success: true,
      data: updatedApiKey
    };
  } catch (error: any) {
    console.error('Update API key error:', error);
    return {
      success: false,
      error: {
        code: 'UPDATE_API_KEY_ERROR',
        message: 'Failed to update API key'
      }
    };
  }
}

/**
 * Revokes an API key (soft delete)
 */
export async function revokeApiKey(
  businessId: string,
  keyId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        businessId,
        deletedAt: null
      }
    });

    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      };
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        status: 'REVOKED',
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Revoke API key error:', error);
    return {
      success: false,
      error: {
        code: 'REVOKE_API_KEY_ERROR',
        message: 'Failed to revoke API key'
      }
    };
  }
}

/**
 * Validates an API key and returns business/user info
 */
export async function validateApiKey(
  apiKey: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    // Find all active API keys and check against hashes
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            status: true,
            deletedAt: true
          }
        }
      }
    });

    // Check each API key hash
    for (const keyRecord of apiKeys) {
      const isValid = await verifyApiKey(apiKey, keyRecord.keyHash);
      if (isValid) {
        // Check if business is active
        if (keyRecord.business.status !== 'ACTIVE' && keyRecord.business.status !== 'TRIAL') {
          return {
            success: false,
            error: {
              code: 'BUSINESS_INACTIVE',
              message: 'Business is inactive'
            }
          };
        }

        // Update last used timestamp
        await prisma.apiKey.update({
          where: { id: keyRecord.id },
          data: { lastUsedAt: new Date() }
        });

        return {
          success: true,
          data: {
            businessId: keyRecord.businessId,
            businessName: keyRecord.business.name,
            permissions: keyRecord.permissions,
            apiKeyId: keyRecord.id
          }
        };
      }
    }

    return {
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid or expired API key'
      }
    };
  } catch (error: any) {
    console.error('Validate API key error:', error);
    return {
      success: false,
      error: {
        code: 'API_KEY_VALIDATION_ERROR',
        message: 'Failed to validate API key'
      }
    };
  }
}
