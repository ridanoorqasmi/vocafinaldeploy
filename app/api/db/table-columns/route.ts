// ===== FETCH TABLE COLUMNS API =====
// Phase 2: Get available columns from a specific table in tenant's database

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { createReadOnlyConnection, getReadOnlyClient } from '@/lib/services/db/connection';
import { decryptPassword } from '@/lib/services/db/encryption';
import { DatabaseConfig } from '@/lib/services/db/connection';

const prisma = getPrismaClient();

/**
 * GET /api/db/table-columns - Get columns for a specific table
 */
export async function GET(request: NextRequest) {
  let pool: any = null;
  let client: any = null;

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const tableName = searchParams.get('tableName');

    if (!tenantId || !tableName) {
      return NextResponse.json(
        {
          success: false,
          error: 'tenantId and tableName are required'
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

    // Prepare database config
    const dbConfigForQuery: DatabaseConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password, // Encrypted, will be decrypted in connection service
      database: dbConfig.database
    };

    // Create read-only connection
    pool = await createReadOnlyConnection(dbConfigForQuery);
    client = await getReadOnlyClient(pool);

    // Get columns for the table (PostgreSQL query)
    const result = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);

    const columns = result.rows.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES'
    }));

    return NextResponse.json({
      success: true,
      data: columns
    });

  } catch (error: any) {
    console.error('Fetch columns error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch columns',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
}



