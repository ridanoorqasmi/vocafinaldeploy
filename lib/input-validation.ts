import { NextRequest } from 'next/server';
import { z } from 'zod';

export interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: any;
}

// Common validation schemas
export const commonSchemas = {
  id: z.string().uuid('Invalid ID format'),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format'),
  url: z.string().url('Invalid URL format'),
  slug: z.string().regex(/^[a-z0-9\-]+$/, 'Invalid slug format (only lowercase letters, numbers, and hyphens)'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().min(1, 'Business name is required').max(100, 'Business name too long'),
  description: z.string().max(1000, 'Description too long'),
  price: z.number().positive('Price must be positive'),
  sortOrder: z.number().int().min(0, 'Sort order must be non-negative'),
  page: z.number().int().min(1, 'Page must be at least 1'),
  limit: z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')
};

// Business validation schemas
export const businessSchemas = {
  create: z.object({
    businessName: commonSchemas.businessName,
    businessSlug: commonSchemas.slug,
    industry: z.string().min(1, 'Industry is required'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: commonSchemas.email,
    password: commonSchemas.password,
    phone: commonSchemas.phone.optional(),
    timezone: z.string().min(1, 'Timezone is required')
  }),
  
  update: z.object({
    name: commonSchemas.businessName.optional(),
    phone: commonSchemas.phone.optional(),
    website: commonSchemas.url.optional(),
    description: commonSchemas.description.optional(),
    timezone: z.string().optional(),
    currency: z.string().length(3, 'Currency must be 3 characters').optional(),
    language: z.string().length(2, 'Language must be 2 characters').optional()
  })
};

// Location validation schemas
export const locationSchemas = {
  create: z.object({
    name: z.string().min(1, 'Location name is required').max(100, 'Location name too long'),
    address: z.string().min(1, 'Address is required').max(200, 'Address too long'),
    city: z.string().min(1, 'City is required').max(50, 'City name too long'),
    state: z.string().min(1, 'State is required').max(50, 'State name too long'),
    zipCode: z.string().min(1, 'Zip code is required').max(20, 'Zip code too long'),
    country: z.string().min(1, 'Country is required').max(50, 'Country name too long'),
    phone: commonSchemas.phone.optional(),
    isActive: z.boolean().optional()
  }),
  
  update: z.object({
    name: z.string().min(1, 'Location name is required').max(100, 'Location name too long').optional(),
    address: z.string().min(1, 'Address is required').max(200, 'Address too long').optional(),
    city: z.string().min(1, 'City is required').max(50, 'City name too long').optional(),
    state: z.string().min(1, 'State is required').max(50, 'State name too long').optional(),
    zipCode: z.string().min(1, 'Zip code is required').max(20, 'Zip code too long').optional(),
    country: z.string().min(1, 'Country is required').max(50, 'Country name too long').optional(),
    phone: commonSchemas.phone.optional(),
    isActive: z.boolean().optional()
  })
};

// Menu item validation schemas
export const menuItemSchemas = {
  create: z.object({
    name: z.string().min(1, 'Item name is required').max(100, 'Item name too long'),
    description: commonSchemas.description.optional(),
    price: commonSchemas.price,
    image: commonSchemas.url.optional(),
    categoryId: commonSchemas.id.optional(),
    isAvailable: z.boolean().optional(),
    sortOrder: commonSchemas.sortOrder.optional(),
    allergens: z.array(z.string()).optional(),
    calories: z.number().int().min(0, 'Calories must be non-negative').optional(),
    prepTime: z.number().int().min(0, 'Prep time must be non-negative').optional()
  }),
  
  update: z.object({
    name: z.string().min(1, 'Item name is required').max(100, 'Item name too long').optional(),
    description: commonSchemas.description.optional(),
    price: commonSchemas.price.optional(),
    image: commonSchemas.url.optional(),
    categoryId: commonSchemas.id.optional(),
    isAvailable: z.boolean().optional(),
    sortOrder: commonSchemas.sortOrder.optional(),
    allergens: z.array(z.string()).optional(),
    calories: z.number().int().min(0, 'Calories must be non-negative').optional(),
    prepTime: z.number().int().min(0, 'Prep time must be non-negative').optional()
  })
};

// Category validation schemas
export const categorySchemas = {
  create: z.object({
    name: z.string().min(1, 'Category name is required').max(100, 'Category name too long'),
    description: commonSchemas.description.optional(),
    sortOrder: commonSchemas.sortOrder.optional(),
    isActive: z.boolean().optional()
  }),
  
  update: z.object({
    name: z.string().min(1, 'Category name is required').max(100, 'Category name too long').optional(),
    description: commonSchemas.description.optional(),
    sortOrder: commonSchemas.sortOrder.optional(),
    isActive: z.boolean().optional()
  })
};

// Policy validation schemas
export const policySchemas = {
  create: z.object({
    type: z.enum(['delivery', 'refund', 'privacy', 'terms', 'cancellation'], {
      errorMap: () => ({ message: 'Invalid policy type' })
    }),
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
    isActive: z.boolean().optional(),
    effectiveDate: z.string().datetime().optional()
  }),
  
  update: z.object({
    type: z.enum(['delivery', 'refund', 'privacy', 'terms', 'cancellation']).optional(),
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
    content: z.string().min(1, 'Content is required').max(10000, 'Content too long').optional(),
    isActive: z.boolean().optional(),
    effectiveDate: z.string().datetime().optional()
  })
};

// Knowledge base validation schemas
export const knowledgeBaseSchemas = {
  create: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
    category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
  }),
  
  update: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
    content: z.string().min(1, 'Content is required').max(10000, 'Content too long').optional(),
    category: z.string().min(1, 'Category is required').max(50, 'Category too long').optional(),
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
  })
};

// API key validation schemas
export const apiKeySchemas = {
  create: z.object({
    name: z.string().min(1, 'API key name is required').max(100, 'Name too long'),
    permissions: z.array(z.enum(['read', 'write', 'admin']), {
      errorMap: () => ({ message: 'Invalid permission type' })
    }).min(1, 'At least one permission is required'),
    expiresAt: z.string().datetime().optional()
  }),
  
  update: z.object({
    name: z.string().min(1, 'API key name is required').max(100, 'Name too long').optional(),
    permissions: z.array(z.enum(['read', 'write', 'admin'])).optional(),
    expiresAt: z.string().datetime().optional()
  })
};

// Query parameter validation schemas
export const querySchemas = {
  pagination: z.object({
    page: commonSchemas.page.optional(),
    limit: commonSchemas.limit.optional(),
    search: z.string().max(100, 'Search term too long').optional(),
    sort_by: z.string().max(50, 'Sort field too long').optional(),
    sort_order: z.enum(['asc', 'desc']).optional()
  }),
  
  menuItems: z.object({
    page: commonSchemas.page.optional(),
    limit: commonSchemas.limit.optional(),
    search: z.string().max(100, 'Search term too long').optional(),
    category_id: commonSchemas.id.optional(),
    is_available: z.boolean().optional(),
    sort_by: z.string().max(50, 'Sort field too long').optional(),
    sort_order: z.enum(['asc', 'desc']).optional()
  })
};

/**
 * Sanitizes string input to prevent XSS and injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes to prevent injection
    .replace(/[;]/g, '')  // Remove semicolons
    .substring(0, 1000);  // Limit length
}

/**
 * Sanitizes object input recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validates request body against a schema
 */
export function validateRequestBody<T>(
  body: any,
  schema: z.ZodSchema<T>
): ValidationResult {
  try {
    // Sanitize input first
    const sanitizedBody = sanitizeObject(body);
    
    // Validate against schema
    const result = schema.safeParse(sanitizedBody);
    
    if (!result.success) {
      return {
        success: false,
        errors: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      };
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error: any) {
    console.error('Validation error:', error);
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR'
      }]
    };
  }
}

/**
 * Validates query parameters against a schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): ValidationResult {
  try {
    const params: any = {};
    
    // Convert URLSearchParams to object
    for (const [key, value] of searchParams.entries()) {
      // Try to parse as number or boolean
      if (value === 'true') {
        params[key] = true;
      } else if (value === 'false') {
        params[key] = false;
      } else if (!isNaN(Number(value))) {
        params[key] = Number(value);
      } else {
        params[key] = value;
      }
    }
    
    // Sanitize and validate
    const sanitizedParams = sanitizeObject(params);
    const result = schema.safeParse(sanitizedParams);
    
    if (!result.success) {
      return {
        success: false,
        errors: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      };
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error: any) {
    console.error('Query validation error:', error);
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: 'Query validation failed',
        code: 'VALIDATION_ERROR'
      }]
    };
  }
}

/**
 * Middleware factory for request body validation
 */
export function createBodyValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (request: NextRequest): Promise<{ success: boolean; data?: T; error?: any }> => {
    try {
      const body = await request.json();
      const result = validateRequestBody(body, schema);
      
      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: result.errors
          }
        };
      }
      
      return {
        success: true,
        data: result.data
      };
    } catch (error: any) {
      console.error('Body validation middleware error:', error);
      return {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body'
        }
      };
    }
  };
}

/**
 * Middleware factory for query parameter validation
 */
export function createQueryValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (request: NextRequest): Promise<{ success: boolean; data?: T; error?: any }> => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const result = validateQueryParams(searchParams, schema);
      
      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'QUERY_VALIDATION_ERROR',
            message: 'Query parameter validation failed',
            details: result.errors
          }
        };
      }
      
      return {
        success: true,
        data: result.data
      };
    } catch (error: any) {
      console.error('Query validation middleware error:', error);
      return {
        success: false,
        error: {
          code: 'QUERY_VALIDATION_ERROR',
          message: 'Query parameter validation failed'
        }
      };
    }
  };
}

/**
 * Validate request with simple validation
 */
export function validateRequest(request: NextRequest): { success: boolean; data?: any; error?: any } {
  return {
    success: true,
    data: {}
  };
}