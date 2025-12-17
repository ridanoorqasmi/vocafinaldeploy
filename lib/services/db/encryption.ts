// ===== DATABASE CREDENTIALS ENCRYPTION SERVICE =====
// Phase 2: Encrypt/decrypt sensitive database credentials

import { encrypt, decrypt } from '@/lib/encryption';

/**
 * Encrypt database password before storing
 */
export function encryptPassword(password: string): string {
  if (!password || password.trim().length === 0) {
    throw new Error('Password cannot be empty');
  }
  return encrypt(password);
}

/**
 * Decrypt database password for use
 */
export function decryptPassword(encryptedPassword: string): string {
  if (!encryptedPassword || encryptedPassword.trim().length === 0) {
    throw new Error('Encrypted password cannot be empty');
  }
  return decrypt(encryptedPassword);
}

/**
 * Mask sensitive fields for API responses
 */
export function maskDatabaseConfig(config: {
  id?: string;
  tenantId: string;
  dbType?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  createdAt?: Date;
  updatedAt?: Date;
}): {
  id?: string;
  tenantId: string;
  dbType?: string;
  host: string;
  port: number;
  username: string;
  password: string; // Will be masked
  database: string;
  createdAt?: Date;
  updatedAt?: Date;
} {
  return {
    ...config,
    password: '***'
  };
}


