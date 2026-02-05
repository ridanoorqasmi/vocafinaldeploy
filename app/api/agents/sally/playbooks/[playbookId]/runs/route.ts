/**
 * Playbook Run API
 * 
 * ⚠️ STRICT ISOLATION: Playbook runs are fully independent from workspaces
 * 
 * POST /api/agents/sally/playbooks/:playbookId/runs
 * Start a new playbook run
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { getPrismaClient } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

const prisma = getPrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { playbookId: string } }
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

    const playbookId = params.playbookId;

    // Verify playbook ownership
    const playbook = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
    }>>`
      SELECT id, tenant_id FROM playbooks
      WHERE id = ${playbookId} AND tenant_id = ${context.tenantId}
    `;

    if (playbook.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Playbook not found or access denied',
        },
        { status: 404 }
      );
    }

    // Check for existing active run
    const activeRun = await prisma.$queryRaw<Array<{
      id: string;
      status: string;
    }>>`
      SELECT id, status FROM playbook_runs
      WHERE playbook_id = ${playbookId}
        AND tenant_id = ${context.tenantId}
        AND status = 'ACTIVE'
      ORDER BY started_at DESC
      LIMIT 1
    `;

    let runId: string;
    const now = new Date();

    if (activeRun.length > 0) {
      // Return existing active run
      runId = activeRun[0].id;
    } else {
      // Create new run
      runId = uuidv4();
      
      await prisma.$executeRaw`
        INSERT INTO playbook_runs (
          id, tenant_id, playbook_id, status,
          current_step_index, started_at, updated_at
        ) VALUES (
          ${runId},
          ${context.tenantId},
          ${playbookId},
          'ACTIVE',
          0,
          ${now},
          ${now}
        )
      `;
    }

    // Fetch run with playbook details
    const run = await prisma.$queryRaw<Array<{
      id: string;
      playbook_id: string;
      status: string;
      current_step_index: number;
      started_at: Date;
      updated_at: Date;
    }>>`
      SELECT * FROM playbook_runs WHERE id = ${runId}
    `;

    return NextResponse.json({
      success: true,
      data: {
        id: run[0].id,
        playbookId: run[0].playbook_id,
        status: run[0].status,
        currentStepIndex: run[0].current_step_index,
        startedAt: run[0].started_at.toISOString(),
        updatedAt: run[0].updated_at.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Sally] Error creating playbook run:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create playbook run',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
