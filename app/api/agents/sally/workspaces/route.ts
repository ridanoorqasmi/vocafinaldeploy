/**
 * Sales Workspaces API
 * 
 * Endpoints for managing saved sales workspaces
 * - GET: List workspaces for a user/company
 * - POST: Create a new workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getPrismaClient } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

const prisma = getPrismaClient();

/**
 * GET /api/agents/sally/workspaces?companyId=xxx
 * List all workspaces for a user and company
 */
export async function GET(request: NextRequest) {
  try {
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
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    // companyId is optional - if provided, verify ownership; if not, return all workspaces for user
    if (companyId) {
      // Verify company ownership if companyId is provided
      const company = await prisma.sally_companies.findFirst({
        where: {
          id: companyId,
          userId: userId,
        },
      });

      if (!company) {
        return NextResponse.json(
          {
            success: false,
            error: 'Company not found or access denied',
          },
          { status: 404 }
        );
      }
    }

    // Fetch workspaces for this user
    // If companyId is provided, filter by it; otherwise, get all workspaces for the user
    const whereClause: any = {
      userId: userId,
    };
    
    if (companyId) {
      whereClause.companyId = companyId;
    }

    const workspaces = await prisma.sales_workspaces.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        goalType: true,
        companyId: true, // Include companyId so frontend can group if needed
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('[Sally] Workspaces API: Found', workspaces.length, 'workspaces', companyId ? `for companyId: ${companyId}` : 'for user (all companies)');

    return NextResponse.json({
      success: true,
      data: workspaces,
    });
  } catch (error: any) {
    console.error('[Sally] Error fetching workspaces:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch workspaces',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/sally/workspaces
 * Create a new workspace
 */
export async function POST(request: NextRequest) {
  try {
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
    const body = await request.json();
    const { companyId, title, goalType, metadata } = body;

    if (!companyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'companyId is required',
        },
        { status: 400 }
      );
    }

    // Verify company ownership
    const company = await prisma.sally_companies.findFirst({
      where: {
        id: companyId,
        userId: userId,
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          success: false,
          error: 'Company not found or access denied',
        },
        { status: 404 }
      );
    }

    // Create workspace
    const workspace = await prisma.sales_workspaces.create({
      data: {
        id: uuidv4(),
        userId: userId,
        companyId: companyId,
        title: title || `${company.name} - Sales Effort`,
        goalType: goalType || null,
        metadata: metadata || null,
      },
      select: {
        id: true,
        title: true,
        goalType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    console.error('[Sally] Error creating workspace:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create workspace',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
