// ===== AUTHENTICATION TYPES & INTERFACES =====

export interface JWTPayload {
  userId: string;
  businessId: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  email: string;
  businessSlug: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  businessId: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  businessName: string;
  businessSlug: string;
  industry?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  timezone?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface InviteUserRequest {
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  firstName: string;
  lastName: string;
}

export interface AcceptInviteRequest {
  token: string;
  password: string;
}

export interface ChangeRoleRequest {
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
    };
    business: {
      id: string;
      name: string;
      slug: string;
      status: string;
    };
    tokens: AuthTokens;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

// ===== ERROR CODES =====
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  BUSINESS_NOT_FOUND: 'BUSINESS_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  SLUG_ALREADY_EXISTS: 'SLUG_ALREADY_EXISTS',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_INVALID: 'INVITATION_INVALID',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT: 'INVALID_INPUT'
} as const;

export const AUTH_ERROR_MESSAGES = {
  [AUTH_ERRORS.INVALID_CREDENTIALS]: 'Invalid email or password',
  [AUTH_ERRORS.TOKEN_EXPIRED]: 'Authentication token has expired',
  [AUTH_ERRORS.TOKEN_INVALID]: 'Invalid authentication token',
  [AUTH_ERRORS.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this operation',
  [AUTH_ERRORS.BUSINESS_NOT_FOUND]: 'Business not found or access denied',
  [AUTH_ERRORS.USER_NOT_FOUND]: 'User not found',
  [AUTH_ERRORS.EMAIL_ALREADY_EXISTS]: 'Email address is already registered',
  [AUTH_ERRORS.SLUG_ALREADY_EXISTS]: 'Business slug is already taken',
  [AUTH_ERRORS.INVITATION_EXPIRED]: 'Invitation link has expired',
  [AUTH_ERRORS.INVITATION_INVALID]: 'Invalid invitation token',
  [AUTH_ERRORS.EMAIL_NOT_VERIFIED]: 'Please verify your email address before logging in',
  [AUTH_ERRORS.ACCOUNT_SUSPENDED]: 'Your account has been suspended',
  [AUTH_ERRORS.PASSWORD_TOO_WEAK]: 'Password does not meet security requirements',
  [AUTH_ERRORS.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later',
  [AUTH_ERRORS.INVALID_INPUT]: 'Invalid input provided'
} as const;

// ===== JWT CONFIGURATION =====
export const JWT_CONFIG = {
  accessToken: {
    secret: process.env.JWT_SECRET!,
    expiresIn: '15m'
  },
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: '7d'
  }
};

// ===== PASSWORD CONFIGURATION =====
export const PASSWORD_CONFIG = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
};

// ===== EMAIL CONFIGURATION =====
export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'noreply@voca-ai.com',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  invitationExpiresHours: parseInt(process.env.INVITATION_EXPIRES_HOURS || '72')
};

