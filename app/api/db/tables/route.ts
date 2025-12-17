// ===== FETCH DATABASE TABLES API =====
// Phase 2: Get available tables from tenant's configured database

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { createReadOnlyConnection, getReadOnlyClient } from '@/lib/services/db/connection';
import { decryptPassword } from '@/lib/services/db/encryption';
import { DatabaseConfig } from '@/lib/services/db/connection';

const prisma = getPrismaClient();

/**
 * GET /api/db/tables - Get list of tables from tenant's database
 */
export async function GET(request: NextRequest) {
  let pool: any = null;
  let client: any = null;

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: 'tenantId is required'
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

    // Get list of tables (PostgreSQL query)
    // Note: This assumes PostgreSQL. For other DB types, we'd need to adjust the query
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = result.rows.map((row: any) => row.table_name);

    return NextResponse.json({
      success: true,
      data: tables
    });

  } catch (error: any) {
    console.error('Fetch tables error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tables',
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



