/**
 * Company-Scoped Sales Content Architecture
 * API endpoints for individual company operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

// Helper to safely resolve params (works for both Next.js 14 and 15)
async function resolveParams<T extends Record<string, string>>(
  params: Promise<T> | T
): Promise<T> {
  if (params && typeof params === 'object' && 'then' in params && typeof (params as any).then === 'function') {
    return await (params as Promise<T>);
  }
  return params as T;
}

/**
 * GET /api/agents/sally/companies/[companyId]
 * Get a specific company (with access control)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> | { companyId: string } }
) {
  try {
    // Safely resolve params (works for both Next.js 14 and 15)
    const resolvedParams = await resolveParams(params);
    
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
    const { companyId } = resolvedParams;

    // Fetch company and verify ownership
    const company = await prisma.sally_companies.findFirst({
      where: {
        id: companyId,
        userId: userId, // Strict tenant isolation
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
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

    return NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error: any) {
    console.error('[Sally] Error fetching company:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch company',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
