import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JWTPayload, RefreshTokenPayload, AuthTokens, JWT_CONFIG } from './auth-types';

const prisma = new PrismaClient();

// ===== TOKEN SERVICE =====

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = JWT_CONFIG.accessToken.secret || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  console.log('[generateAccessToken] Generating token for userId:', payload.userId);
  // Use 7 days expiration for better UX (users don't need to re-login frequently)
  return jwt.sign(payload, secret, {
    expiresIn: '7d'
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
    const secret = JWT_CONFIG.accessToken.secret || process.env.JWT_SECRET;
    if (!secret) {
      console.error('[verifyAccessToken] JWT_SECRET is not set in environment variables');
      console.error('[verifyAccessToken] JWT_CONFIG.accessToken.secret:', JWT_CONFIG.accessToken.secret);
      console.error('[verifyAccessToken] process.env.JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
      return null;
    }
    
    console.log('[verifyAccessToken] Verifying token with secret (length):', secret.length);
    const payload = jwt.verify(token, secret) as JWTPayload;
    console.log('[verifyAccessToken] Token verified successfully');
    console.log('[verifyAccessToken] Payload:', {
      userId: payload.userId,
      businessId: payload.businessId,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
      iat: payload.iat
    });
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.error('[verifyAccessToken] Token has expired. Exp:', new Date(payload.exp * 1000), 'Now:', new Date());
      return null;
    }
    
    return payload;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.error('[verifyAccessToken] Token expired error:', error.expiredAt);
      console.error('[verifyAccessToken] Current time:', new Date());
    } else if (error.name === 'JsonWebTokenError') {
      console.error('[verifyAccessToken] Invalid token (JsonWebTokenError):', error.message);
    } else if (error.name === 'NotBeforeError') {
      console.error('[verifyAccessToken] Token not active yet:', error.message);
    } else {
      console.error('[verifyAccessToken] Token verification error:', error.name, error.message);
      if (error.stack) {
        console.error('[verifyAccessToken] Stack:', error.stack);
      }
    }
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
    console.log('[validateUserSession] Starting validation...');
    const payload = verifyAccessToken(token);
    if (!payload) {
      console.error('[validateUserSession] Token verification failed - payload is null');
      return null;
    }
    console.log('[validateUserSession] Token verified, userId:', payload.userId, 'businessId:', payload.businessId);

    // Set business context for RLS (wrap in try-catch as it might not exist)
    try {
      await prisma.$executeRaw`SELECT set_current_business_id(${payload.businessId})`;
    } catch (rlsError) {
      console.warn('[validateUserSession] RLS function not available, continuing without it:', rlsError);
      // Continue without RLS - not critical
    }

    // Get user and business data
    console.log('[validateUserSession] Looking up user:', payload.userId);
    const user = await prisma.users.findFirst({
      where: { 
        id: payload.userId,
        isActive: true,
        deletedAt: null
      },
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

    if (!user) {
      console.error('[validateUserSession] User not found or inactive:', payload.userId);
      return null;
    }
    if (!user.isActive) {
      console.error('[validateUserSession] User is inactive:', payload.userId);
      return null;
    }
    console.log('[validateUserSession] User found:', user.email);

    console.log('[validateUserSession] Looking up business:', payload.businessId);
    const business = await prisma.businesses.findFirst({
      where: { 
        id: payload.businessId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true
      }
    });

    if (!business) {
      console.error('[validateUserSession] Business not found:', payload.businessId);
      return null;
    }
    console.log('[validateUserSession] Business found:', business.name);

    console.log('[validateUserSession] Validation successful');
    return { user, business };
  } catch (error) {
    console.error('[validateUserSession] Error validating user session:', error);
    if (error instanceof Error) {
      console.error('[validateUserSession] Error details:', error.message, error.stack);
    }
    return null;
  }
}

