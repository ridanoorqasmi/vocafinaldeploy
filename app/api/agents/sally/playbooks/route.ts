/**
 * SALES PLAYBOOKS — EXECUTION V1
 *
 * Scope:
 * - Manual, linear playbook execution
 * - Step-based content generation
 * - Read-only step intelligence
 *
 * Explicitly excluded:
 * - Automation
 * - Branching
 * - Analytics
 * - CRM integration
 *
 * This module is workspace-independent by design.
 * Future extensions must preserve this contract.
 *
 * Execution Mode: MANUAL_LINEAR_V1
 * 
 * Endpoints for managing playbooks:
 * - GET: List playbooks for a tenant
 * - POST: Create a new playbook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { getPrismaClient } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const prisma = getPrismaClient();

const playbookStageSchema = z.enum([
  'prospecting',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);

// Step fields are allowed to start empty and be refined over time
const playbookStepSchema = z.object({
  stepTitle: z.string().max(200),
  objective: z.string().max(1000),
  talkTrack: z.string().max(2000),
  customerSignals: z.string().max(1000),
});

const createPlaybookSchema = z.object({
  // Name is required, everything else can be empty text initially
  name: z.string().min(1).max(200),
  pipelineStage: playbookStageSchema,
  targetPersona: z.string().max(500),
  primaryUseCase: z.string().max(500),
  coreMessage: z.string().max(2000),
  risksGuardrails: z.string().max(2000),
  steps: z.array(playbookStepSchema).min(1),
});

/**
 * GET /api/agents/sally/playbooks
 * List all playbooks for the authenticated tenant
 */
export async function GET(request: NextRequest) {
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

    const playbooks = await prisma.$queryRaw<Array<{
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
      step_count: number;
    }>>`
      SELECT 
        p.*,
        COUNT(ps.id)::INTEGER as step_count
      FROM playbooks p
      LEFT JOIN playbook_steps ps ON p.id = ps.playbook_id
      WHERE p.tenant_id = ${context.tenantId}
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `;

    // Fetch steps for each playbook
    const playbooksWithSteps = await Promise.all(
      playbooks.map(async (playbook) => {
        const steps = await prisma.$queryRaw<Array<{
          id: string;
          playbook_id: string;
          step_index: number;
          step_title: string;
          objective: string;
          talk_track: string;
          customer_signals: string;
          step_rationale: string | null;
          success_signals: any | null;
          failure_signals: any | null;
          coach_notes: string | null;
          created_at: Date;
        }>>`
          SELECT *
          FROM playbook_steps
          WHERE playbook_id = ${playbook.id}
          ORDER BY step_index ASC
        `;

        return {
          id: playbook.id,
          name: playbook.name,
          stage: playbook.pipeline_stage,
          persona: playbook.target_persona,
          useCase: playbook.primary_use_case,
          keyMessage: playbook.core_message,
          riskNotes: playbook.risks_guardrails,
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
          lastUpdated: playbook.updated_at.toISOString(),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: playbooksWithSteps,
    });
  } catch (error: any) {
    console.error('[Sally] Error fetching playbooks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch playbooks',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/sally/playbooks
 * Create a new playbook
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validated = createPlaybookSchema.parse(body);

    const playbookId = uuidv4();
    const now = new Date();

    // Create playbook
    await prisma.$executeRaw`
      INSERT INTO playbooks (
        id, tenant_id, name, pipeline_stage, target_persona,
        primary_use_case, core_message, risks_guardrails,
        created_at, updated_at
      ) VALUES (
        ${playbookId},
        ${context.tenantId},
        ${validated.name},
        ${validated.pipelineStage},
        ${validated.targetPersona},
        ${validated.primaryUseCase},
        ${validated.coreMessage},
        ${validated.risksGuardrails},
        ${now},
        ${now}
      )
    `;

    // Create steps
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

    // Fetch created playbook with steps
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

    console.error('[Sally] Error creating playbook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create playbook',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
