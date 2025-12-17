import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JWTPayload, RefreshTokenPayload, AuthTokens, JWT_CONFIG } from './auth-types';

const prisma = new PrismaClient();

// ===== TOKEN SERVICE =====

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign(payload, secret, {
    expiresIn: '15m'
  });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  }
  return jwt.sign(payload, secret, {
    expiresIn: '7d'
  });
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(user: {
  id: string;
  businessId: string;
  role: string;
  email: string;
  businessSlug: string;
}): AuthTokens {
  const accessToken = generateAccessToken({
    userId: user.id,
    businessId: user.businessId,
    role: user.role as 'ADMIN' | 'MANAGER' | 'STAFF',
    email: user.email,
    businessSlug: user.businessSlug
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
    businessId: user.businessId,
    tokenVersion: 1 // Start with version 1
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60 * 1000 // 15 minutes in milliseconds
  };
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_CONFIG.accessToken.secret) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Verify JWT refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, JWT_CONFIG.refreshToken.secret) as RefreshTokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  } catch (error) {
    return true;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return null;
    
    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
}

/**
 * Invalidate refresh token by incrementing token version
 */
export async function invalidateRefreshToken(userId: string): Promise<void> {
  try {
    // In a real implementation, you might want to store token versions in the database
    // For now, we'll just log the invalidation
    console.log(`Invalidating refresh token for user: ${userId}`);
  } catch (error) {
    console.error('Error invalidating refresh token:', error);
  }
}

/**
 * Validate user session and return user data
 */
export async function validateUserSession(token: string): Promise<{
  user: any;
  business: any;
} | null> {
  try {
    const payload = verifyAccessToken(token);
    if (!payload) return null;

    // Set business context for RLS
    await prisma.$executeRaw`SELECT set_current_business_id(${payload.businessId})`;

    // Get user and business data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        businessId: true
      }
    });

    if (!user || !user.isActive) return null;

    const business = await prisma.business.findUnique({
      where: { id: payload.businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true
      }
    });

    if (!business) return null;

    return { user, business };
  } catch (error) {
    console.error('Error validating user session:', error);
    return null;
  }
}

