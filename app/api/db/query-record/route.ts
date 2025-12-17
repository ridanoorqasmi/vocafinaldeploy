// ===== GENERIC READ-ONLY RECORD QUERY API =====
// Phase 2: Performs read-only lookups on tenant databases

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { queryRecord, validateTableMapping } from '@/lib/services/db/queryRecord';
import { DatabaseConfig } from '@/lib/services/db/connection';
import { decryptPassword } from '@/lib/services/db/encryption';

const prisma = getPrismaClient();

/**
 * POST /api/db/query-record - Query a single record from tenant database
 * STRICT: Read-only SELECT queries only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, identifierValue } = body;

    // Validate required fields
    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'tenantId is required'
        },
        { status: 400 }
      );
    }

    if (!identifierValue) {
      return NextResponse.json(
        {
          success: false,
          error: 'identifierValue is required'
        },
        { status: 400 }
      );
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

    // Return result (data may be null if no record found)
    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error('Query record error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query record',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}



