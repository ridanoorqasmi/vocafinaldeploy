// ===== GENERIC READ-ONLY RECORD QUERY API =====
// Phase 2: Performs read-only lookups on tenant databases
// Phase 4: Production hardening - tenant isolation, rate limiting, caching, logging

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { queryRecord, validateTableMapping } from '@/lib/services/db/queryRecord';
import { DatabaseConfig } from '@/lib/services/db/connection';
// Phase 4: Import hardening utilities
import { validateTenantId, sanitizeTenantId } from '@/lib/services/agent/tenantIsolation';
import { checkAgentRateLimit } from '@/lib/services/agent/rateLimiter';
import { getCached, setCached } from '@/lib/services/agent/cache';
import { logDbLookup, logAgentError } from '@/lib/services/agent/logging';
import { getFallbackResponse } from '@/lib/services/agent/fallback';

const prisma = getPrismaClient();

/**
 * POST /api/db/query-record - Query a single record from tenant database
 * STRICT: Read-only SELECT queries only
 * Phase 4: Hardened with tenant isolation, rate limiting, caching, and logging
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tenantId: string | null = null;

  try {
    const body = await request.json();
    const { tenantId: rawTenantId, identifierValue } = body;

    // Phase 4: Sanitize and validate inputs
    const sanitizedTenantId = sanitizeTenantId(rawTenantId);
    if (!sanitizedTenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid tenantId format'
        },
        { status: 400 }
      );
    }

    if (!identifierValue || typeof identifierValue !== 'string' || identifierValue.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'identifierValue is required and must be a non-empty string'
        },
        { status: 400 }
      );
    }

    tenantId = sanitizedTenantId;
    const sanitizedIdentifier = String(identifierValue).trim().substring(0, 200); // Limit length

    // Phase 4: Validate tenantId exists and is active
    const tenantValidation = await validateTenantId(tenantId);
    if (!tenantValidation.valid) {
      logAgentError(tenantId, undefined, tenantValidation.error || 'Tenant validation failed');
      return NextResponse.json(
        {
          success: false,
          error: tenantValidation.error || 'Invalid tenant'
        },
        { status: 403 }
      );
    }

    // Phase 4: Rate limiting (per-tenant)
    const rateLimitResult = await checkAgentRateLimit(tenantId, 'db_query');
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimitResult.error || 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '15',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
            'Retry-After': String(rateLimitResult.retryAfter || 60)
          }
        }
      );
    }

    // Phase 4: Check cache first
    const cacheKey = `${tenantId}:${sanitizedIdentifier}`;
    const cachedResult = getCached<any>(tenantId, 'db_query', cacheKey);
    if (cachedResult) {
      const duration = Date.now() - startTime;
      logDbLookup(tenantId, undefined, sanitizedIdentifier, !!cachedResult, duration);
      return NextResponse.json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    // Get database configuration
    const dbConfig = await (prisma as any).tenantDatabaseConfig.findUnique({
      where: { tenantId }
    });

    if (!dbConfig) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database configuration not found for this tenant'
        },
        { status: 404 }
      );
    }

    // Get table mapping
    const mapping = await (prisma as any).tenantTableMapping.findUnique({
      where: { tenantId }
    });

    if (!mapping) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table mapping not found for this tenant'
        },
        { status: 404 }
      );
    }

    // Validate mapping structure
    const mappingValidation = validateTableMapping({
      tableName: mapping.tableName,
      primaryKeyColumn: mapping.primaryKeyColumn,
      displayFields: mapping.displayFields
    });

    if (!mappingValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid mapping configuration: ${mappingValidation.error}`
        },
        { status: 400 }
      );
    }

    // Prepare database config (password is encrypted, need to decrypt for connection)
    const dbConfigForQuery: DatabaseConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password, // Encrypted, will be decrypted in connection service
      database: dbConfig.database
    };

    // Prepare mapping
    const tableMapping = {
      tableName: mapping.tableName!,
      primaryKeyColumn: mapping.primaryKeyColumn!,
      displayFields: mapping.displayFields as string[]
    };

    // Execute read-only query
    const result = await queryRecord(
      dbConfigForQuery,
      tableMapping,
      String(identifierValue)
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to query record'
        },
        { status: 500 }
      );
    }

    // Phase 4: Cache the result (even if null, to avoid repeated queries)
    if (result.data) {
      setCached(tenantId, 'db_query', cacheKey, result.data);
    }

    const duration = Date.now() - startTime;
    logDbLookup(tenantId, undefined, sanitizedIdentifier, !!result.data, duration);

    // Return result (data may be null if no record found)
    return NextResponse.json({
      success: true,
      data: result.data
    }, {
      headers: {
        'X-Response-Time': `${duration}ms`
      }
    });

  } catch (error: any) {
    // Phase 4: Log error and return safe fallback
    logAgentError(tenantId || 'unknown', undefined, error, {
      endpoint: '/api/db/query-record',
      identifierValue: identifierValue?.substring(0, 50)
    });
    
    const fallbackResponse = getFallbackResponse('db_lookup', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query record',
        data: null
      },
      { status: 500 }
    );
  }
}



