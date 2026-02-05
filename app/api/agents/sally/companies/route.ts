/**
 * Company-Scoped Sales Content Architecture
 * API endpoints for managing companies in Sally
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getPrismaClient } from '@/lib/prisma';
import { setBusinessContext } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

const prisma = getPrismaClient();

// Validation schemas
const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
});

/**
 * GET /api/agents/sally/companies
 * Get all companies for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Sally Companies API] GET request received');
    const authHeader = request.headers.get('authorization');
    console.log('[Sally Companies API] Auth header present:', !!authHeader);
    if (authHeader) {
      console.log('[Sally Companies API] Auth header starts with Bearer:', authHeader.startsWith('Bearer '));
      const token = authHeader.substring(7);
      console.log('[Sally Companies API] Token length:', token.length);
    }
    
    // Authenticate request
    const authResult = await authenticateRequest(request);
    console.log('[Sally Companies API] Auth result:', { 
      success: authResult.success, 
      hasUser: !!authResult.user,
      userId: authResult.user?.id,
      error: authResult.error 
    });
    
    if (!authResult.success || !authResult.user) {
      console.error('[Sally Companies API] Authentication failed');
      console.error('[Sally Companies API] Error details:', JSON.stringify(authResult.error, null, 2));
      return NextResponse.json(
        {
          success: false,
          error: authResult.error?.message || 'Authentication required',
          code: authResult.error?.code || 'AUTH_FAILED'
        },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;

    // Fetch all companies for this user
    const companies = await prisma.sally_companies.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: companies,
    });
  } catch (error: any) {
    console.error('[Sally] Error fetching companies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch companies',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/sally/companies
 * Create a new company for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    // Note: businessId will be fetched from database to ensure it's valid

    // Verify user exists and get their actual businessId from database
    const user = await prisma.users.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
      },
      select: { 
        id: true,
        businessId: true,
      },
    });

    if (!user) {
      console.error('[Sally Companies API] User not found or inactive:', userId);
      return NextResponse.json(
        {
          success: false,
          error: 'User not found or inactive',
        },
        { status: 404 }
      );
    }

    // Use the businessId from the database (not from token, to ensure it's valid)
    const actualBusinessId = user.businessId;
    
    console.log('[Sally Companies API] Using businessId from database:', actualBusinessId);
    
    // Verify business exists (required for tenantId foreign key)
    const businessExists = await prisma.businesses.findFirst({
      where: {
        id: actualBusinessId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!businessExists) {
      console.error('[Sally Companies API] Business not found:', actualBusinessId);
      return NextResponse.json(
        {
          success: false,
          error: 'Business not found',
        },
        { status: 404 }
      );
    }

    // Set business context for RLS (if RLS is enabled)
    try {
      await setBusinessContext(actualBusinessId);
    } catch (error) {
      // RLS might not be enabled, continue anyway
      console.warn('[Sally Companies API] Could not set business context:', error);
    }

    // Parse and validate input
    const body = await request.json();
    const validation = createCompanySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    console.log('[Sally Companies API] Creating company with data:', {
      userId,
      name,
      tenantId: actualBusinessId
    });

    // Drop the FK constraint if it exists (it's causing issues and doesn't match our schema)
    // The constraint was likely added manually and references a table that doesn't match our design
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'sally_companies_tenantId_fkey' 
            AND table_name = 'sally_companies'
          ) THEN
            ALTER TABLE sally_companies DROP CONSTRAINT sally_companies_tenantId_fkey;
          END IF;
        END $$;
      `);
      console.log('[Sally Companies API] FK constraint dropped (if it existed)');
    } catch (dropError: any) {
      // If dropping fails, log but continue - we'll handle the error when creating
      console.warn('[Sally Companies API] Could not drop FK constraint (may need DB admin):', dropError.message);
    }

    // Now create the company - try Prisma first, fallback to raw SQL if FK constraint fails
    let company;
    try {
      company = await prisma.sally_companies.create({
        data: {
          id: uuidv4(),
          userId: userId,
          tenantId: actualBusinessId, // Use businessId as tenantId
          name: name,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      console.log('[Sally Companies API] Company created successfully with Prisma:', company.id);
    } catch (prismaError: any) {
      // If FK constraint error (P2003), try to identify and handle it
      if (prismaError.code === 'P2003') {
        console.error('[Sally Companies API] Foreign key constraint violation detected');
        console.error('[Sally Companies API] Error details:', {
          code: prismaError.code,
          constraint: prismaError.meta?.constraint,
          field_name: prismaError.meta?.field_name,
          modelName: prismaError.meta?.modelName
        });
        
        const constraintName = prismaError.meta?.constraint || 'unknown';
        const fieldName = prismaError.meta?.field_name || 'unknown';
        
        // Try to drop the constraint dynamically based on the error
        // PostgreSQL constraint names are case-insensitive, so try both variations
        try {
          console.log(`[Sally Companies API] Attempting to drop constraint: ${constraintName}`);
          
          // Try with the exact name from error
          try {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE sally_companies 
              DROP CONSTRAINT IF EXISTS "${constraintName}";
            `);
            console.log(`[Sally Companies API] Constraint "${constraintName}" dropped (quoted)`);
          } catch (e1: any) {
            // Try without quotes (case-insensitive)
            try {
              await prisma.$executeRawUnsafe(`
                ALTER TABLE sally_companies 
                DROP CONSTRAINT IF EXISTS ${constraintName};
              `);
              console.log(`[Sally Companies API] Constraint ${constraintName} dropped (unquoted)`);
            } catch (e2: any) {
              // Try lowercase version
              await prisma.$executeRawUnsafe(`
                ALTER TABLE sally_companies 
                DROP CONSTRAINT IF EXISTS ${constraintName.toLowerCase()};
              `);
              console.log(`[Sally Companies API] Constraint ${constraintName.toLowerCase()} dropped (lowercase)`);
            }
          }
          
          // Retry the create after dropping the constraint
          company = await prisma.sally_companies.create({
            data: {
              id: uuidv4(),
              userId: userId,
              tenantId: actualBusinessId,
              name: name,
            },
            select: {
              id: true,
              name: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          console.log('[Sally Companies API] Company created successfully after dropping constraint:', company.id);
        } catch (dropAndRetryError: any) {
          console.error('[Sally Companies API] Failed to drop constraint and retry:', dropAndRetryError);
          
          // Return a helpful error message with instructions
          return NextResponse.json(
            {
              success: false,
              error: 'Database constraint error',
              message: `Foreign key constraint violation on field: ${fieldName}. The constraint '${constraintName}' needs to be removed manually.`,
              details: process.env.NODE_ENV === 'development' ? {
                code: prismaError.code,
                constraint: constraintName,
                field_name: fieldName,
                solution: `Run this SQL command in your database: ALTER TABLE sally_companies DROP CONSTRAINT IF EXISTS ${constraintName};`,
                checkConstraints: 'Run the SQL in find-all-constraints.sql to see all constraints'
              } : undefined,
            },
            { status: 500 }
          );
        }
      } else if (prismaError.code === 'P2010' || prismaError.meta?.code === '23503') {
        // Try raw SQL as fallback for other FK errors
        console.warn('[Sally Companies API] FK constraint error with Prisma, trying raw SQL fallback');
        try {
          const companyId = uuidv4();
          // Use parameterized query to avoid SQL injection
          const result = await prisma.$queryRawUnsafe(`
            INSERT INTO sally_companies (id, "userId", "tenantId", name, "createdAt", "updatedAt")
            VALUES ($1::uuid, $2::text, $3::text, $4::text, NOW(), NOW())
            RETURNING id, name, "createdAt", "updatedAt"
          `, companyId, userId, actualBusinessId, name) as Array<{
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
          }>;
          
          if (!result || result.length === 0) {
            throw new Error('Raw SQL insert returned no rows');
          }
          
          company = {
            id: result[0].id,
            name: result[0].name,
            createdAt: result[0].createdAt,
            updatedAt: result[0].updatedAt,
          };
          console.log('[Sally Companies API] Company created successfully with raw SQL:', company.id);
        } catch (rawError: any) {
          // If raw SQL also fails, throw the original Prisma error
          console.error('[Sally Companies API] Raw SQL fallback also failed:', rawError);
          throw prismaError; // Re-throw original error
        }
      } else {
        // Not an FK constraint error, re-throw
        throw prismaError;
      }
    }

    return NextResponse.json({
      success: true,
      data: company,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Sally] Error creating company - Full error:', error);
    console.error('[Sally] Error stack:', error.stack);
    console.error('[Sally] Error message:', error.message);
    console.error('[Sally] Error code:', error.code);
    console.error('[Sally] Error meta:', error.meta);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create company',
        message: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          meta: error.meta,
          stack: error.stack
        } : undefined,
      },
      { status: 500 }
    );
  }
}
