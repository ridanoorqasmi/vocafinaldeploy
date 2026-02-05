/**
 * Playbook Run Detail API
 * 
 * ⚠️ STRICT ISOLATION: Playbook runs are fully independent from workspaces
 * 
 * GET /api/agents/sally/playbooks/runs/:runId
 * Get run details with step progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

export async function GET(
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

    // Verify ownership and fetch run
    const run = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      playbook_id: string;
      status: string;
      current_step_index: number;
      started_at: Date;
      updated_at: Date;
    }>>`
      SELECT * FROM playbook_runs
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

    // Fetch playbook details
    const playbook = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      pipeline_stage: string;
      target_persona: string;
      primary_use_case: string;
      core_message: string;
      risks_guardrails: string;
    }>>`
      SELECT * FROM playbooks WHERE id = ${run[0].playbook_id}
    `;

    // Fetch playbook steps with intelligence
    const steps = await prisma.$queryRaw<Array<{
      id: string;
      step_index: number;
      step_title: string;
      objective: string;
      talk_track: string;
      customer_signals: string;
      step_rationale: string | null;
      success_signals: any | null;
      failure_signals: any | null;
      coach_notes: string | null;
    }>>`
      SELECT * FROM playbook_steps
      WHERE playbook_id = ${run[0].playbook_id}
      ORDER BY step_index ASC
    `;

    // Fetch step runs
    const stepRuns = await prisma.$queryRaw<Array<{
      id: string;
      step_index: number;
      generated_output: any;
      status: string;
      completed_at: Date | null;
    }>>`
      SELECT * FROM playbook_step_runs
      WHERE run_id = ${runId}
      ORDER BY step_index ASC
    `;

    // Combine steps with their run status and intelligence
    const stepsWithStatus = steps.map(step => {
      const stepRun = stepRuns.find(sr => sr.step_index === step.step_index);
      return {
        id: step.id,
        stepIndex: step.step_index,
        title: step.step_title,
        objective: step.objective,
        talkTrack: step.talk_track,
        customerSignals: step.customer_signals,
        intelligence: step.step_rationale ? {
          rationale: step.step_rationale,
          successSignals: Array.isArray(step.success_signals) ? step.success_signals : (step.success_signals ? [step.success_signals] : []),
          failureSignals: Array.isArray(step.failure_signals) ? step.failure_signals : (step.failure_signals ? [step.failure_signals] : []),
          coachNotes: step.coach_notes,
        } : null,
        runStatus: stepRun?.status || 'PENDING',
        generatedOutput: stepRun?.generated_output || null,
        completedAt: stepRun?.completed_at?.toISOString() || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        id: run[0].id,
        playbook: {
          id: playbook[0].id,
          name: playbook[0].name,
          stage: playbook[0].pipeline_stage,
          persona: playbook[0].target_persona,
          useCase: playbook[0].primary_use_case,
          keyMessage: playbook[0].core_message,
          riskNotes: playbook[0].risks_guardrails,
        },
        status: run[0].status,
        currentStepIndex: run[0].current_step_index,
        startedAt: run[0].started_at.toISOString(),
        updatedAt: run[0].updated_at.toISOString(),
        steps: stepsWithStatus,
      },
    });
  } catch (error: any) {
    console.error('[Sally] Error fetching playbook run:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch playbook run',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
