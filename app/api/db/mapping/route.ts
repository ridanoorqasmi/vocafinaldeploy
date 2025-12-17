// ===== TENANT TABLE MAPPING API =====
// Phase 2: Save and retrieve table/field mappings for tenant databases

import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/prisma';
import { validateTableMapping } from '@/lib/services/db/queryRecord';

const prisma = getPrismaClient();

/**
 * POST /api/db/mapping - Save table/field mapping
 * Ensures only one mapping per tenant (upsert)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, tableName, primaryKeyColumn, displayFields } = body;

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

    // Validate mapping structure
    const mappingValidation = validateTableMapping({
      tableName,
      primaryKeyColumn,
      displayFields
    });

    if (!mappingValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: mappingValidation.error || 'Invalid mapping configuration'
        },
        { status: 400 }
      );
    }

    // Ensure displayFields is stored as JSON array
    const displayFieldsArray = Array.isArray(displayFields) 
      ? displayFields 
      : [];

    // Save or update mapping (upsert - one per tenant)
    const mapping = await (prisma as any).tenantTableMapping.upsert({
      where: { tenantId },
      update: {
        tableName,
        primaryKeyColumn,
        displayFields: displayFieldsArray,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        tableName,
        primaryKeyColumn,
        displayFields: displayFieldsArray
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: mapping.id,
        tenantId: mapping.tenantId,
        tableName: mapping.tableName,
        primaryKeyColumn: mapping.primaryKeyColumn,
        displayFields: mapping.displayFields,
        createdAt: mapping.createdAt,
        updatedAt: mapping.updatedAt
      }
    });

  } catch (error: any) {
    console.error('Table mapping save error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save table mapping',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/db/mapping - Get table/field mapping
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

    // Get mapping
    const mapping = await (prisma as any).tenantTableMapping.findUnique({
      where: { tenantId }
    });

    if (!mapping) {
      return NextResponse.json({
        success: true,
        data: null
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: mapping.id,
        tenantId: mapping.tenantId,
        tableName: mapping.tableName,
        primaryKeyColumn: mapping.primaryKeyColumn,
        displayFields: mapping.displayFields,
        createdAt: mapping.createdAt,
        updatedAt: mapping.updatedAt
      }
    });

  } catch (error: any) {
    console.error('Table mapping get error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve table mapping',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


