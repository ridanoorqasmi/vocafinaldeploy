// ===== VALIDATION SERVICE =====

import { 
  ValidationResult, 
  RateLimitResult, 
  QUERY_ERRORS, 
  QUERY_ERROR_MESSAGES,
  DEFAULT_QUERY_CONFIG 
} from './query-types';

export interface ValidationServiceConfig {
  maxQueryLength: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  enableContentFiltering: boolean;
  enableLanguageDetection: boolean;
  blockedWords: string[];
  allowedLanguages: string[];
}

export class ValidationService {
  private config: ValidationServiceConfig;
  private rateLimitCache: Map<string, { count: number; resetTime: Date }> = new Map();

  constructor(config?: Partial<ValidationServiceConfig>) {
    this.config = {
      maxQueryLength: DEFAULT_QUERY_CONFIG.maxQueryLength,
      rateLimitPerMinute: DEFAULT_QUERY_CONFIG.rateLimitPerMinute,
      rateLimitPerHour: DEFAULT_QUERY_CONFIG.rateLimitPerHour,
      enableContentFiltering: true,
      enableLanguageDetection: true,
      blockedWords: [
        'spam', 'scam', 'hack', 'exploit', 'inject', 'sql',
        'script', 'xss', 'csrf', 'ddos', 'phishing'
      ],
      allowedLanguages: ['en', 'es', 'fr', 'de'],
      ...config
    };
  }

  /**
   * Validate and sanitize query input
   */
  async validateQuery(query: string): Promise<ValidationResult> {
    const errors: string[] = [];
    let sanitizedQuery = query;

    // Check query length
    if (!query || query.trim().length === 0) {
      errors.push('Query cannot be empty');
      return { isValid: false, errors };
    }

    if (query.length > this.config.maxQueryLength) {
      errors.push(`Query exceeds maximum length of ${this.config.maxQueryLength} characters`);
    }

    // Sanitize query
    sanitizedQuery = this.sanitizeInput(query);

    // Check for blocked content
    if (this.config.enableContentFiltering) {
      const contentValidation = this.validateContent(sanitizedQuery);
      if (!contentValidation.isValid) {
        errors.push(...contentValidation.errors);
      }
    }

    // Check for SQL injection patterns
    const sqlInjectionCheck = this.checkSQLInjection(sanitizedQuery);
    if (!sqlInjectionCheck.isValid) {
      errors.push(...sqlInjectionCheck.errors);
    }

    // Language detection (basic)
    if (this.config.enableLanguageDetection) {
      const languageCheck = this.detectLanguage(sanitizedQuery);
      if (!languageCheck.isValid) {
        errors.push(...languageCheck.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedQuery: errors.length === 0 ? sanitizedQuery : undefined
    };
  }

  /**
   * Check rate limiting for a given identifier
   */
  async checkRateLimit(identifier: string): Promise<RateLimitResult> {
    const now = new Date();
    const key = identifier;
    const cached = this.rateLimitCache.get(key);

    if (!cached || now > cached.resetTime) {
      // Reset or initialize rate limit
      const resetTime = new Date(now.getTime() + 60 * 1000); // 1 minute
      this.rateLimitCache.set(key, { count: 1, resetTime });
      
      return {
        allowed: true,
        remaining: this.config.rateLimitPerMinute - 1,
        resetTime
      };
    }

    if (cached.count >= this.config.rateLimitPerMinute) {
      const retryAfter = Math.ceil((cached.resetTime.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime: cached.resetTime,
        retryAfter
      };
    }

    // Increment count
    cached.count++;
    this.rateLimitCache.set(key, cached);

    return {
      allowed: true,
      remaining: this.config.rateLimitPerMinute - cached.count,
      resetTime: cached.resetTime
    };
  }

  /**
   * Validate session ID format
   */
  validateSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }

    // Session ID should be alphanumeric with hyphens, 8-64 characters
    const sessionIdRegex = /^[a-zA-Z0-9\-]{8,64}$/;
    return sessionIdRegex.test(sessionId);
  }

  /**
   * Validate customer ID format
   */
  validateCustomerId(customerId: string): boolean {
    if (!customerId || typeof customerId !== 'string') {
      return false;
    }

    // Customer ID should be alphanumeric, 3-50 characters
    const customerIdRegex = /^[a-zA-Z0-9]{3,50}$/;
    return customerIdRegex.test(customerId);
  }

  /**
   * Validate business context
   */
  validateBusinessContext(context: any): boolean {
    if (!context || typeof context !== 'object') {
      return false;
    }

    // Check for required fields if provided
    if (context.location && typeof context.location !== 'string') {
      return false;
    }

    if (context.preferences && !Array.isArray(context.preferences)) {
      return false;
    }

    if (context.metadata && typeof context.metadata !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  private sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes that could break SQL
      .replace(/[;]/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL block comments
      .replace(/\*\//g, '')
      .substring(0, this.config.maxQueryLength);
  }

  /**
   * Validate content for inappropriate material
   */
  private validateContent(query: string): ValidationResult {
    const errors: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Check for blocked words
    for (const blockedWord of this.config.blockedWords) {
      if (lowerQuery.includes(blockedWord.toLowerCase())) {
        errors.push(`Query contains inappropriate content`);
        break;
      }
    }

    // Check for excessive repetition (spam detection)
    const words = query.split(/\s+/);
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      const count = wordCounts.get(word) || 0;
      wordCounts.set(word, count + 1);
    }

    const maxRepetition = Math.max(...wordCounts.values());
    if (maxRepetition > words.length * 0.5) {
      errors.push('Query appears to be spam');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for SQL injection patterns
   */
  private checkSQLInjection(query: string): ValidationResult {
    const errors: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Common SQL injection patterns
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i,
      /alter\s+table/i,
      /create\s+table/i,
      /exec\s*\(/i,
      /execute\s*\(/i,
      /sp_executesql/i,
      /xp_cmdshell/i,
      /waitfor\s+delay/i,
      /benchmark\s*\(/i,
      /sleep\s*\(/i
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(lowerQuery)) {
        errors.push('Query contains potentially malicious SQL patterns');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Basic language detection
   */
  private detectLanguage(query: string): ValidationResult {
    const errors: string[] = [];

    // Simple language detection based on character patterns
    const hasLatinChars = /[a-zA-Z]/.test(query);
    const hasCyrillicChars = /[а-яА-Я]/.test(query);
    const hasChineseChars = /[\u4e00-\u9fff]/.test(query);
    const hasArabicChars = /[\u0600-\u06ff]/.test(query);

    // For now, we primarily support English
    if (!hasLatinChars && (hasCyrillicChars || hasChineseChars || hasArabicChars)) {
      errors.push('Language not supported. Please use English.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimitCache(): void {
    const now = new Date();
    for (const [key, value] of this.rateLimitCache.entries()) {
      if (now > value.resetTime) {
        this.rateLimitCache.delete(key);
      }
    }
  }

  /**
   * Get rate limit statistics
   */
  getRateLimitStats(): {
    activeEntries: number;
    totalRequests: number;
    cacheSize: number;
  } {
    const now = new Date();
    let totalRequests = 0;
    let activeEntries = 0;

    for (const [key, value] of this.rateLimitCache.entries()) {
      if (now <= value.resetTime) {
        activeEntries++;
        totalRequests += value.count;
      }
    }

    return {
      activeEntries,
      totalRequests,
      cacheSize: this.rateLimitCache.size
    };
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.maxQueryLength < 1 || this.config.maxQueryLength > 10000) {
      errors.push('maxQueryLength must be between 1 and 10000');
    }

    if (this.config.rateLimitPerMinute < 1 || this.config.rateLimitPerMinute > 1000) {
      errors.push('rateLimitPerMinute must be between 1 and 1000');
    }

    if (this.config.rateLimitPerHour < 1 || this.config.rateLimitPerHour > 10000) {
      errors.push('rateLimitPerHour must be between 1 and 10000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ===== SINGLETON INSTANCE =====
let validationServiceInstance: ValidationService | null = null;

export function getValidationService(config?: Partial<ValidationServiceConfig>): ValidationService {
  if (!validationServiceInstance) {
    validationServiceInstance = new ValidationService(config);
  }
  return validationServiceInstance;
}

