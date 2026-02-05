/**
 * Step Intelligence Generation API
 * 
 * ⚠️ STRICT ISOLATION: Uses only playbook context, NO workspace dependencies
 * 
 * POST /api/agents/sally/playbooks/:playbookId/steps/:stepId/generate-intelligence
 * Generate intelligence for a specific playbook step (one-time generation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { getPrismaClient } from '@/lib/prisma';
import { generateStepIntelligence } from '@/lib/sally/step-intelligence-generator';

const prisma = getPrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { playbookId: string; stepId: string } }
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
    const stepId = params.stepId;

    // Verify playbook ownership
    const playbook = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      pipeline_stage: string;
      target_persona: string;
      core_message: string;
    }>>`
      SELECT id, tenant_id, pipeline_stage, target_persona, core_message
      FROM playbooks
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

    // Verify step belongs to playbook
    const step = await prisma.$queryRaw<Array<{
      id: string;
      playbook_id: string;
      step_title: string;
      objective: string;
      step_rationale: string | null;
    }>>`
      SELECT id, playbook_id, step_title, objective, step_rationale
      FROM playbook_steps
      WHERE id = ${stepId} AND playbook_id = ${playbookId}
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

    // Check if intelligence already exists
    if (step[0].step_rationale) {
      return NextResponse.json(
        {
          success: false,
          error: 'Intelligence already exists for this step',
        },
        { status: 400 }
      );
    }

    // Generate intelligence using only playbook context
    const intelligence = await generateStepIntelligence({
      pipelineStage: playbook[0].pipeline_stage,
      targetPersona: playbook[0].target_persona,
      stepTitle: step[0].step_title,
      stepObjective: step[0].objective,
      coreMessage: playbook[0].core_message,
    });

    // Persist intelligence to step definition
    await prisma.$executeRaw`
      UPDATE playbook_steps
      SET
        step_rationale = ${intelligence.step_rationale},
        success_signals = ${JSON.stringify(intelligence.success_signals)}::JSONB,
        failure_signals = ${JSON.stringify(intelligence.failure_signals)}::JSONB,
        coach_notes = ${intelligence.coach_notes}
      WHERE id = ${stepId}
    `;

    return NextResponse.json({
      success: true,
      data: {
        intelligence: {
          rationale: intelligence.step_rationale,
          successSignals: intelligence.success_signals,
          failureSignals: intelligence.failure_signals,
          coachNotes: intelligence.coach_notes,
        },
      },
    });
  } catch (error: any) {
    console.error('[Sally] Error generating step intelligence:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate step intelligence',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
