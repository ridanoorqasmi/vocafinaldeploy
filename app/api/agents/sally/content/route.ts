/**
 * Company-Scoped Sales Content Architecture
 * API endpoints for managing sales content per company
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getPrismaClient } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

const prisma = getPrismaClient();

/**
 * GET /api/agents/sally/content?companyId=xxx
 * Get sales content for a specific company
 */
export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

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
        userId: userId, // Strict tenant isolation
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

    // Fetch content for this company
    const content = await prisma.sally_sales_content.findUnique({
      where: {
        userId_companyId: {
          userId: userId,
          companyId: companyId,
        },
      },
      select: {
        id: true,
        inputJson: true,
        outputJson: true,
        strategy: true,
        strategyReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: content,
    });
  } catch (error: any) {
    console.error('[Sally] Error fetching content:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch content',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/sally/content
 * Save sales content for a company
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
    const body = await request.json();
    const { companyId, inputJson, outputJson, strategy, strategyReason } = body;

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
        userId: userId, // Strict tenant isolation
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

    // Upsert content (create or update)
    const content = await prisma.sally_sales_content.upsert({
      where: {
        userId_companyId: {
          userId: userId,
          companyId: companyId,
        },
      },
      create: {
        id: uuidv4(),
        userId: userId,
        companyId: companyId,
        inputJson: inputJson,
        outputJson: outputJson,
        strategy: strategy || null,
        strategyReason: strategyReason || null,
      },
      update: {
        inputJson: inputJson,
        outputJson: outputJson,
        strategy: strategy || null,
        strategyReason: strategyReason || null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        inputJson: true,
        outputJson: true,
        strategy: true,
        strategyReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: content,
    });
  } catch (error: any) {
    console.error('[Sally] Error saving content:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save content',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
