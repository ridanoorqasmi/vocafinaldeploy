/**
 * Sales Playbook Detail API
 * 
 * ⚠️ STRICT ISOLATION: Playbooks are fully independent from workspaces
 * 
 * Endpoints for individual playbook operations:
 * - GET: Get a specific playbook
 * - PUT: Update a playbook
 * - DELETE: Delete a playbook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { getPrismaClient } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { isTerminalStatus } from '@/lib/sally/playbook-execution-mode';

const prisma = getPrismaClient();

const playbookStageSchema = z.enum([
  'prospecting',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);

// Step fields are allowed to be empty and refined over time
const playbookStepSchema = z.object({
  stepTitle: z.string().max(200),
  objective: z.string().max(1000),
  talkTrack: z.string().max(2000),
  customerSignals: z.string().max(1000),
});

const updatePlaybookSchema = z.object({
  // Name is still required when provided; other fields may be empty strings
  name: z.string().min(1).max(200).optional(),
  pipelineStage: playbookStageSchema.optional(),
  targetPersona: z.string().max(500).optional(),
  primaryUseCase: z.string().max(500).optional(),
  coreMessage: z.string().max(2000).optional(),
  risksGuardrails: z.string().max(2000).optional(),
  steps: z.array(playbookStepSchema).optional(),
});

/**
 * GET /api/agents/sally/playbooks/:playbookId
 * Get a specific playbook
 */
export async function GET(
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

    // Verify ownership and fetch playbook
    const playbook = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      name: string;
      pipeline_stage: string;
      target_persona: string;
      primary_use_case: string;
      core_message: string;
      risks_guardrails: string;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT * FROM playbooks
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

    // Fetch steps
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
      WHERE playbook_id = ${playbookId}
      ORDER BY step_index ASC
    `;

    return NextResponse.json({
      success: true,
      data: {
        id: playbook[0].id,
        name: playbook[0].name,
        stage: playbook[0].pipeline_stage,
        persona: playbook[0].target_persona,
        useCase: playbook[0].primary_use_case,
        keyMessage: playbook[0].core_message,
        riskNotes: playbook[0].risks_guardrails,
        steps: steps.map(step => ({
          id: step.id,
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
        })),
        lastUpdated: playbook[0].updated_at.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Sally] Error fetching playbook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch playbook',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agents/sally/playbooks/:playbookId
 * Update a playbook
 */
export async function PUT(
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
    const body = await request.json();
    const validated = updatePlaybookSchema.parse(body);

    // Verify ownership
    const existing = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
    }>>`
      SELECT id, tenant_id FROM playbooks
      WHERE id = ${playbookId} AND tenant_id = ${context.tenantId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Playbook not found or access denied',
        },
        { status: 404 }
      );
    }

    const now = new Date();

    // Guardrail: Prevent editing playbook step definitions while a run is ACTIVE
    if (validated.steps) {
      const activeRuns = await prisma.$queryRaw<Array<{
        id: string;
        status: string;
      }>>`
        SELECT id, status FROM playbook_runs
        WHERE playbook_id = ${playbookId}
          AND tenant_id = ${context.tenantId}
          AND status = 'ACTIVE'
        LIMIT 1
      `;

      if (activeRuns.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot edit playbook steps while an active run exists. Please complete or abandon the active run first.',
          },
          { status: 400 }
        );
      }
    }

    // Update playbook fields if provided
    if (validated.name || validated.pipelineStage || validated.targetPersona ||
        validated.primaryUseCase || validated.coreMessage || validated.risksGuardrails) {
      await prisma.$executeRaw`
        UPDATE playbooks
        SET
          name = COALESCE(${validated.name ?? null}, name),
          pipeline_stage = COALESCE(${validated.pipelineStage ?? null}, pipeline_stage),
          target_persona = COALESCE(${validated.targetPersona ?? null}, target_persona),
          primary_use_case = COALESCE(${validated.primaryUseCase ?? null}, primary_use_case),
          core_message = COALESCE(${validated.coreMessage ?? null}, core_message),
          risks_guardrails = COALESCE(${validated.risksGuardrails ?? null}, risks_guardrails),
          updated_at = ${now}
        WHERE id = ${playbookId}
      `;
    }

    // Update steps if provided
    if (validated.steps) {
      // Delete existing steps
      await prisma.$executeRaw`
        DELETE FROM playbook_steps WHERE playbook_id = ${playbookId}
      `;

      // Insert new steps
      for (let i = 0; i < validated.steps.length; i++) {
        const step = validated.steps[i];
        const stepId = uuidv4();
        
        await prisma.$executeRaw`
          INSERT INTO playbook_steps (
            id, playbook_id, step_index, step_title,
            objective, talk_track, customer_signals, created_at
          ) VALUES (
            ${stepId},
            ${playbookId},
            ${i},
            ${step.stepTitle},
            ${step.objective},
            ${step.talkTrack},
            ${step.customerSignals},
            ${now}
          )
        `;
      }
    }

    // Fetch updated playbook
    const playbook = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      pipeline_stage: string;
      target_persona: string;
      primary_use_case: string;
      core_message: string;
      risks_guardrails: string;
      updated_at: Date;
    }>>`
      SELECT * FROM playbooks WHERE id = ${playbookId}
    `;

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
      WHERE playbook_id = ${playbookId}
      ORDER BY step_index ASC
    `;

    return NextResponse.json({
      success: true,
      data: {
        id: playbook[0].id,
        name: playbook[0].name,
        stage: playbook[0].pipeline_stage,
        persona: playbook[0].target_persona,
        useCase: playbook[0].primary_use_case,
        keyMessage: playbook[0].core_message,
        riskNotes: playbook[0].risks_guardrails,
        steps: steps.map(step => ({
          id: step.id,
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
        })),
        lastUpdated: playbook[0].updated_at.toISOString(),
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

    console.error('[Sally] Error updating playbook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update playbook',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/sally/playbooks/:playbookId
 * Delete a playbook
 */
export async function DELETE(
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

    // Verify ownership and delete (CASCADE will handle steps and runs)
    const result = await prisma.$executeRaw`
      DELETE FROM playbooks
      WHERE id = ${playbookId} AND tenant_id = ${context.tenantId}
    `;

    if (result === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Playbook not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Playbook deleted successfully',
    });
  } catch (error: any) {
    console.error('[Sally] Error deleting playbook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete playbook',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
