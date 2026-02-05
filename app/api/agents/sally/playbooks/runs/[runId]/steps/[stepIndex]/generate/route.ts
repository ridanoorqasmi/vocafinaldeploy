/**
 * Playbook Step Generation API
 * 
 * ⚠️ STRICT ISOLATION: Uses only playbook context, NO workspace dependencies
 * 
 * POST /api/agents/sally/playbooks/runs/:runId/steps/:stepIndex/generate
 * Generate content for a specific playbook step
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { getPrismaClient } from '@/lib/prisma';
import { generatePlaybookStepContent } from '@/lib/sally/playbook-step-generator';
import { v4 as uuidv4 } from 'uuid';
import { isTerminalStatus } from '@/lib/sally/playbook-execution-mode';

const prisma = getPrismaClient();

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

    // Verify run ownership
    const run = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      playbook_id: string;
      status: string;
      current_step_index: number;
    }>>`
      SELECT id, tenant_id, playbook_id, status, current_step_index FROM playbook_runs
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

    // Guardrail: Only ACTIVE runs can generate steps
    if (isTerminalStatus(run[0].status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot generate step: run is in terminal state (${run[0].status})`,
        },
        { status: 400 }
      );
    }

    // Guardrail: Prevent generating steps beyond current_step_index
    if (stepIndex > run[0].current_step_index) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot generate step ${stepIndex}: current step is ${run[0].current_step_index}. Steps must be generated in order.`,
        },
        { status: 400 }
      );
    }

    // Fetch playbook and step
    const playbook = await prisma.$queryRaw<Array<{
      id: string;
      core_message: string;
      target_persona: string;
    }>>`
      SELECT id, core_message, target_persona FROM playbooks
      WHERE id = ${run[0].playbook_id}
    `;

    if (playbook.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Playbook not found',
        },
        { status: 404 }
      );
    }

    const step = await prisma.$queryRaw<Array<{
      id: string;
      step_index: number;
      objective: string;
      talk_track: string;
    }>>`
      SELECT * FROM playbook_steps
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

    // Generate content using only playbook context
    const generated = await generatePlaybookStepContent({
      coreMessage: playbook[0].core_message,
      stepObjective: step[0].objective,
      targetPersona: playbook[0].target_persona,
      talkTrack: step[0].talk_track,
    });

    // Check if step run already exists
    const existingStepRun = await prisma.$queryRaw<Array<{
      id: string;
    }>>`
      SELECT id FROM playbook_step_runs
      WHERE run_id = ${runId} AND step_index = ${stepIndex}
    `;

    const now = new Date();

    if (existingStepRun.length > 0) {
      // Update existing step run
      await prisma.$executeRaw`
        UPDATE playbook_step_runs
        SET
          generated_output = ${JSON.stringify(generated)}::JSONB,
          status = 'GENERATED',
          completed_at = NULL
        WHERE id = ${existingStepRun[0].id}
      `;
    } else {
      // Create new step run
      const stepRunId = uuidv4();
      await prisma.$executeRaw`
        INSERT INTO playbook_step_runs (
          id, run_id, step_index, generated_output, status
        ) VALUES (
          ${stepRunId},
          ${runId},
          ${stepIndex},
          ${JSON.stringify(generated)}::JSONB,
          'GENERATED'
        )
      `;
    }

    return NextResponse.json({
      success: true,
      data: {
        stepIndex,
        generatedOutput: generated,
        status: 'GENERATED',
      },
    });
  } catch (error: any) {
    console.error('[Sally] Error generating playbook step content:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate step content',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
