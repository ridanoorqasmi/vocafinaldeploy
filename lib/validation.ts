import { RegisterRequest, LoginRequest, ForgotPasswordRequest, ResetPasswordRequest, InviteUserRequest } from './auth-types';

// ===== VALIDATION SCHEMAS =====

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate business slug format
 */
export function validateBusinessSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validate registration request
 */
export function validateRegistration(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Business name validation
  if (!data.businessName || typeof data.businessName !== 'string') {
    errors.push('Business name is required');
  } else if (data.businessName.length < 2 || data.businessName.length > 100) {
    errors.push('Business name must be between 2 and 100 characters');
  }

  // Business slug validation
  if (!data.businessSlug || typeof data.businessSlug !== 'string') {
    errors.push('Business slug is required');
  } else if (!validateBusinessSlug(data.businessSlug)) {
    errors.push('Business slug must be 3-50 characters, lowercase letters, numbers, and hyphens only');
  }

  // Email validation
  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (!validateEmail(data.email)) {
    errors.push('Invalid email format');
  }

  // Password validation
  if (!data.password || typeof data.password !== 'string') {
    errors.push('Password is required');
  } else if (data.password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // First name validation
  if (!data.firstName || typeof data.firstName !== 'string') {
    errors.push('First name is required');
  } else if (data.firstName.length < 1 || data.firstName.length > 50) {
    errors.push('First name must be between 1 and 50 characters');
  }

  // Last name validation
  if (!data.lastName || typeof data.lastName !== 'string') {
    errors.push('Last name is required');
  } else if (data.lastName.length < 1 || data.lastName.length > 50) {
    errors.push('Last name must be between 1 and 50 characters');
  }

  // Optional phone validation
  if (data.phone && !validatePhone(data.phone)) {
    errors.push('Invalid phone number format');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate login request
 */
export function validateLogin(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (!validateEmail(data.email)) {
    errors.push('Invalid email format');
  }

  if (!data.password || typeof data.password !== 'string') {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate forgot password request
 */
export function validateForgotPassword(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (!validateEmail(data.email)) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate reset password request
 */
export function validateResetPassword(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.token || typeof data.token !== 'string') {
    errors.push('Reset token is required');
  }

  if (!data.password || typeof data.password !== 'string') {
    errors.push('Password is required');
  } else if (data.password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate invite user request
 */
export function validateInviteUser(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else if (!validateEmail(data.email)) {
    errors.push('Invalid email format');
  }

  if (!data.role || !['ADMIN', 'MANAGER', 'STAFF'].includes(data.role)) {
    errors.push('Valid role is required (ADMIN, MANAGER, or STAFF)');
  }

  if (!data.firstName || typeof data.firstName !== 'string') {
    errors.push('First name is required');
  } else if (data.firstName.length < 1 || data.firstName.length > 50) {
    errors.push('First name must be between 1 and 50 characters');
  }

  if (!data.lastName || typeof data.lastName !== 'string') {
    errors.push('Last name is required');
  } else if (data.lastName.length < 1 || data.lastName.length > 50) {
    errors.push('Last name must be between 1 and 50 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate change role request
 */
export function validateChangeRole(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.role || !['ADMIN', 'MANAGER', 'STAFF'].includes(data.role)) {
    errors.push('Valid role is required (ADMIN, MANAGER, or STAFF)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize input string
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Sanitize business slug
 */
export function sanitizeBusinessSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Menu item validation schemas
export const menuItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100, 'Item name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  price: z.number().positive('Price must be positive'),
  image: z.string().url('Invalid URL format').optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0, 'Sort order must be non-negative').optional(),
  allergens: z.array(z.string()).optional(),
  calories: z.number().int().min(0, 'Calories must be non-negative').optional(),
  prepTime: z.number().int().min(0, 'Prep time must be non-negative').optional()
});

// Order validation schemas
export const orderSchema = z.object({
  items: z.array(z.string().uuid('Invalid item ID')),
  total: z.number().positive('Total must be positive'),
  customerName: z.string().min(1, 'Customer name is required').max(100, 'Customer name too long'),
  customerPhone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format'),
  customerEmail: z.string().email('Invalid email format').optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
  deliveryAddress: z.string().max(200, 'Address too long').optional(),
  pickupTime: z.string().datetime().optional()
});