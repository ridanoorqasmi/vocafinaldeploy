/**
 * Playbook Step Completion API
 * 
 * ⚠️ STRICT ISOLATION: Playbook runs are fully independent from workspaces
 * 
 * POST /api/agents/sally/playbooks/runs/:runId/steps/:stepIndex/complete
 * Mark a step as completed or skipped and advance the run
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { getPrismaClient } from '@/lib/prisma';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { validateExecutionAllowed, isTerminalStatus } from '@/lib/sally/playbook-execution-mode';

const prisma = getPrismaClient();

const completeStepSchema = z.object({
  action: z.enum(['complete', 'skip']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string; stepIndex: string } }
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
    const stepIndex = parseInt(params.stepIndex, 10);

    if (isNaN(stepIndex)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid step index',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = completeStepSchema.parse(body);

    // Verify run ownership
    const run = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      playbook_id: string;
      status: string;
      current_step_index: number;
    }>>`
      SELECT id, tenant_id, playbook_id, status, current_step_index
      FROM playbook_runs
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

    // Guardrail: Only ACTIVE runs can have steps completed
    if (isTerminalStatus(run[0].status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot complete step: run is in terminal state (${run[0].status})`,
        },
        { status: 400 }
      );
    }

    // Guardrail: Prevent completing steps out of order
    if (stepIndex !== run[0].current_step_index) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot complete step ${stepIndex}: current step is ${run[0].current_step_index}. Steps must be completed in order.`,
        },
        { status: 400 }
      );
    }

    // Verify step exists
    const step = await prisma.$queryRaw<Array<{
      step_index: number;
    }>>`
      SELECT step_index FROM playbook_steps
      WHERE playbook_id = ${run[0].playbook_id} AND step_index = ${stepIndex}
    `;

    if (step.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Step not found',
        },
        { status: 404 }
      );
    }

    const now = new Date();
    const newStatus = validated.action === 'complete' ? 'COMPLETED' : 'SKIPPED';

    // Update step run status
    const stepRun = await prisma.$queryRaw<Array<{
      id: string;
    }>>`
      SELECT id FROM playbook_step_runs
      WHERE run_id = ${runId} AND step_index = ${stepIndex}
    `;

    if (stepRun.length > 0) {
      await prisma.$executeRaw`
        UPDATE playbook_step_runs
        SET
          status = ${newStatus},
          completed_at = ${now}
        WHERE id = ${stepRun[0].id}
      `;
    } else {
      // Create step run if it doesn't exist (for skipped steps)
      const stepRunId = uuidv4();
      await prisma.$executeRaw`
        INSERT INTO playbook_step_runs (
          id, run_id, step_index, status, completed_at
        ) VALUES (
          ${stepRunId},
          ${runId},
          ${stepIndex},
          ${newStatus},
          ${now}
        )
      `;
    }

    // Get total number of steps
    const totalSteps = await prisma.$queryRaw<Array<{
      count: bigint;
    }>>`
      SELECT COUNT(*)::INTEGER as count FROM playbook_steps
      WHERE playbook_id = ${run[0].playbook_id}
    `;

    const totalStepsCount = Number(totalSteps[0]?.count || 0);
    
    // Guardrail: Ensure current_step_index never exceeds total step count
    if (run[0].current_step_index >= totalStepsCount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid state: current step index exceeds total steps',
        },
        { status: 400 }
      );
    }

    const nextStepIndex = stepIndex + 1;
    let runStatus: 'ACTIVE' | 'COMPLETED' = 'ACTIVE';

    // Terminal state: Mark as COMPLETED when final step is completed
    if (nextStepIndex >= totalStepsCount) {
      runStatus = 'COMPLETED';
    }

    // Advance run to next step (or mark as completed)
    await prisma.$executeRaw`
      UPDATE playbook_runs
      SET
        current_step_index = ${nextStepIndex},
        status = ${runStatus},
        updated_at = ${now}
      WHERE id = ${runId}
    `;

    return NextResponse.json({
      success: true,
      data: {
        stepIndex,
        action: validated.action,
        nextStepIndex: runStatus === 'COMPLETED' ? null : nextStepIndex,
        runStatus,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('[Sally] Error completing playbook step:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete step',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
