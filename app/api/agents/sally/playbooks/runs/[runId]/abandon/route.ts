/**
 * Playbook Run Abandon API
 * 
 * ⚠️ STRICT ISOLATION: Playbook runs are fully independent from workspaces
 * 
 * POST /api/agents/sally/playbooks/runs/:runId/abandon
 * Mark a playbook run as ABANDONED (explicit user action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { getPrismaClient } from '@/lib/prisma';
import { isTerminalStatus } from '@/lib/sally/playbook-execution-mode';

const prisma = getPrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const context = await getSallyTenantContext(request);
    
    if (!validateSallyTenantContext(context)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const runId = params.runId;

    // Verify run ownership
    const run = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      status: string;
    }>>`
      SELECT id, tenant_id, status FROM playbook_runs
      WHERE id = ${runId} AND tenant_id = ${context.tenantId}
    `;

    if (run.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Run not found or access denied',
        },
        { status: 404 }
      );
    }

    // Guardrail: Cannot abandon a run that's already terminal
    if (isTerminalStatus(run[0].status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot abandon run: already in terminal state (${run[0].status})`,
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Mark run as ABANDONED
    await prisma.$executeRaw`
      UPDATE playbook_runs
      SET
        status = 'ABANDONED',
        updated_at = ${now}
      WHERE id = ${runId}
    `;

    return NextResponse.json({
      success: true,
      data: {
        runId,
        status: 'ABANDONED',
        abandonedAt: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Sally] Error abandoning playbook run:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to abandon playbook run',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
