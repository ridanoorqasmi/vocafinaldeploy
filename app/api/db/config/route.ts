// ===== TENANT DATABASE CONFIGURATION API =====
// Phase 2: Save and retrieve tenant database connection credentials

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { encryptPassword, maskDatabaseConfig } from '@/lib/services/db/encryption';
import { testConnectionPlain, DatabaseConfig } from '@/lib/services/db/connection';

const prisma = getPrismaClient();

/**
 * POST /api/db/config - Save database configuration
 * Validates, tests connection, encrypts password, and saves config
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, dbType, host, port, username, password, database } = body;

    // Validate required fields
    if (!tenantId || !dbType || !host || !port || !username || !password || !database) {
      return NextResponse.json(
        {
          success: false,
          error: 'All fields are required: tenantId, dbType, host, port, username, password, database'
        },
        { status: 400 }
      );
    }

    // Validate dbType
    const validDbTypes = ['POSTGRESQL', 'MYSQL', 'SQLITE', 'MONGODB', 'FIREBASE'];
    if (!validDbTypes.includes(dbType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid database type. Must be one of: POSTGRESQL, MYSQL, SQLITE, MONGODB, FIREBASE'
        },
        { status: 400 }
      );
    }

    // Validate port is a number
    const portNum = parseInt(String(port), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return NextResponse.json(
        {
          success: false,
          error: 'Port must be a valid number between 1 and 65535'
        },
        { status: 400 }
      );
    }

    // Check if test parameter is set
    const { searchParams } = new URL(request.url);
    const testOnly = searchParams.get('test') === 'true';

    // Test connection before saving (use plain password for test)
    const connectionTest = await testConnectionPlain(
      host,
      portNum,
      username,
      password, // Plain password for testing
      database
    );
    
    if (!connectionTest.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Connection test failed',
          details: connectionTest.error
        },
        { status: 400 }
      );
    }

    // If test only, return success without saving
    if (testOnly) {
      return NextResponse.json({
        success: true,
        message: 'Connection test successful'
      });
    }

    // Encrypt password before saving
    const encryptedPasswordForStorage = encryptPassword(password);

    // Save or update configuration (upsert)
    const config = await (prisma as any).tenantDatabaseConfig.upsert({
      where: { tenantId },
      update: {
        dbType,
        host,
        port: portNum,
        username,
        password: encryptedPasswordForStorage,
        database,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        dbType,
        host,
        port: portNum,
        username,
        password: encryptedPasswordForStorage,
        database
      }
    });

    return NextResponse.json({
      success: true,
      data: maskDatabaseConfig(config)
    });

  } catch (error: any) {
    console.error('DB config save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save database configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/db/config - Get database configuration (masked)
 */
export async function GET(request: NextRequest) {
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

    // Get configuration
    const config = await (prisma as any).tenantDatabaseConfig.findUnique({
      where: { tenantId }
    });

    if (!config) {
      return NextResponse.json({
        success: true,
        data: null
      });
    }

    // Return masked configuration
    return NextResponse.json({
      success: true,
      data: maskDatabaseConfig(config)
    });

  } catch (error: any) {
    console.error('DB config get error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve database configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

