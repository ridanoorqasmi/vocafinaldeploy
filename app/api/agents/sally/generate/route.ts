/**
 * SALLY — SALES AGENT (V1)
 *
 * Responsibilities:
 * - Generate sales content inside workspaces
 * - Coach and refine sales messaging
 * - Guide manual sales execution via Playbooks
 *
 * Explicitly excluded:
 * - Lead analysis
 * - CRM behavior
 * - Automation
 * - Data enrichment
 *
 * Sally is a human-in-the-loop sales assistant,
 * not an autonomous sales agent.
 *
 * Execution Mode: CONTENT_AND_GUIDED_EXECUTION_V1
 * 
 * POST /api/agents/sally/generate
 * 
 * Endpoint responsibilities:
 * 1. Authenticate request
 * 2. Resolve tenant context
 * 3. Validate input via Zod
 * 4. Select sales strategy
 * 5. Invoke Sally's service layer with strategy
 * 6. Persist run data including strategy
 * 7. Return structured JSON output with strategy
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSallyTenantContext, validateSallyTenantContext } from '@/lib/sally/context';
import { generateSalesContent } from '@/lib/sally/generator';
import { generateAdvancedSalesContent } from '@/lib/sally/advanced-generator';
import { normalizeInput } from '@/lib/sally/input-normalizer';
import { applyLanguageRefinement } from '@/lib/sally/language-refinement';
import { selectStrategy } from '@/lib/sally/strategy-selector';
import { generateSalesCoaching } from '@/lib/sally/sales-coach';
import { getPrismaClient } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth-middleware';
import { v4 as uuidv4 } from 'uuid';
import { SALLY_EXECUTION_MODE, validateSallyScope } from '@/lib/sally/execution-mode';

const prisma = getPrismaClient();

// Phase 1: Input validation schema (additive - old fields remain required)
const generateRequestSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'), // Company-scoped architecture
  companyName: z.string().min(1, 'Company name is required').max(200),
  productDesc: z.string().min(1, 'Product description is required').max(1000),
  targetAudience: z.string().min(1, 'Target audience is required').max(500),
  goal: z.string().min(1, 'Goal is required').max(100),
  tone: z.string().min(1, 'Tone is required').max(100),
  market: z.string().min(1, 'Market is required').max(100),
  // New required field (optional for backward compatibility, but validated separately)
  oneLineValue: z.string().max(200).optional(),
  // Mode and asset selection
  mode: z.enum(['quick', 'advanced']).optional().default('quick'),
  selectedAssets: z.object({
    coldCall: z.boolean().optional().default(true),
    coldEmail: z.boolean().optional().default(true),
    pitch: z.boolean().optional().default(true),
  }).optional().default({ coldCall: true, coldEmail: true, pitch: true }),
  // Quick Generate light enrichment fields (all optional)
  personaRole: z.string().max(100).optional(),
  personaRoleCustom: z.string().max(100).optional(),
  topPain: z.string().max(500).optional(),
  salesMotion: z.string().max(100).optional(),
  // Advanced fields (all optional)
  primaryKPI: z.string().max(100).optional(),
  primaryKPICustom: z.string().max(100).optional(),
  primaryCTA: z.string().max(100).optional(),
  fallbackCTA: z.string().max(100).optional(),
  buyingTrigger: z.string().max(100).optional(),
  buyingTriggerNote: z.string().max(300).optional(),
  competitorAlternative: z.string().max(200).optional(),
  differentiatorAngle: z.string().max(100).optional(),
  proofTypes: z.array(z.string()).max(5).optional(),
  proofSnippet: z.string().max(500).optional(),
  topObjections: z.array(z.string()).max(2).optional(),
  topObjectionsCustom: z.string().max(200).optional(),
  // Industry Language Pack (optional, Advanced Sales Mode only)
  industry_id: z.enum(['generic_b2b', 'saas', 'fintech', 'agency', 'local_business', 'enterprise']).optional(),
  // Sales Workspaces: Optional workspace ID (if provided, update existing workspace)
  workspaceId: z.string().optional(),
});

/**
 * POST /api/agents/sally/generate
 * Generate sales content based on input parameters
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate request (Company-scoped architecture requires authentication)
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

    // Resolve tenant context for backward compatibility
    let tenantContext = await getSallyTenantContext(request);
    if (!validateSallyTenantContext(tenantContext)) {
      tenantContext = {
        tenantId: authResult.businessId || 'default-tenant',
        authType: 'session',
      };
    }

    // 2. Parse and validate input
    const body = await request.json();
    
    // Guardrail: Validate that request doesn't attempt excluded features
    if (body.feature && typeof body.feature === 'string') {
      try {
        validateSallyScope(body.feature);
      } catch (error: any) {
        return NextResponse.json(
          {
            success: false,
            error: error.message || 'Invalid feature request',
          },
          { status: 400 }
        );
      }
    }

    const validation = generateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const input = validation.data;

    // Phase 1: Validate oneLineValue if provided (required for new UI, optional for backward compatibility)
    if (input.oneLineValue !== undefined && !input.oneLineValue.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'One-line value is required',
        },
        { status: 400 }
      );
    }

    // 2.5. Verify company ownership (strict tenant isolation)
    const company = await prisma.sally_companies.findFirst({
      where: {
        id: input.companyId,
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

    // Phase 2: Determine generation mode (default to quick for backward compatibility)
    const mode = input.mode || 'quick';
    
    // Phase 2: Determine assets to generate
    const selectedAssets = input.selectedAssets || { coldCall: true, coldEmail: true, pitch: true };

    // Phase 2: Select strategy before generation
    const strategySelection = await selectStrategy({
      audience: input.targetAudience,
      market: input.market,
      goal: input.goal,
    });

    // Phase 2: Route to appropriate generator based on mode
    let output: any;
    let generationMeta: any = {
      mode,
      assets_generated: [] as string[],
      inputs_used: [] as string[],
      assumptions_used: [] as string[],
    };

    if (mode === 'advanced') {
      // Phase 2: Normalize inputs for advanced mode
      const normalizedResult = normalizeInput(input, strategySelection.strategy);
      
      // Phase 2: Generate advanced content
      const advancedOutput = await generateAdvancedSalesContent(
        normalizedResult.normalized,
        selectedAssets
      );

      // Phase 2: Convert advanced output to response format (maintain backward compatibility)
      output = {};
      if (selectedAssets.coldCall && advancedOutput.coldCallScript) {
        output.coldCallScript = advancedOutput.coldCallScript;
        generationMeta.assets_generated.push('coldCall');
      }
      if (selectedAssets.coldEmail && advancedOutput.coldEmail) {
        output.coldEmail = advancedOutput.coldEmail;
        generationMeta.assets_generated.push('coldEmail');
      }
      if (selectedAssets.pitch && advancedOutput.salesPitch) {
        output.salesPitch = advancedOutput.salesPitch;
        generationMeta.assets_generated.push('pitch');
      }

      // Phase 2: Add metadata
      generationMeta.inputs_used = normalizedResult.inputs_used;
      generationMeta.assumptions_used = normalizedResult.assumptions_used;

      // Phase 3: Apply language refinement pipeline (after generation, before persistence)
      const refinementEnabled = process.env.SALLY_LANGUAGE_REFINEMENT !== 'false'; // Default enabled
      if (refinementEnabled) {
        // Add industry_id to normalized input for refinement pipeline
        const normalizedWithIndustry = {
          ...normalizedResult.normalized,
          industry_id: input.industry_id || null,
        };
        
        const { refined, metadata: refinementMeta } = applyLanguageRefinement(
          output,
          normalizedWithIndustry,
          mode,
          selectedAssets
        );
        output = refined;
        // Merge refinement metadata (including industry pack metadata)
        generationMeta.language_pass_applied = refinementMeta.language_pass_applied;
        if (refinementMeta.delivery_style_used) {
          generationMeta.delivery_style_used = refinementMeta.delivery_style_used;
        }
        if (refinementMeta.pain_source) {
          generationMeta.pain_source = refinementMeta.pain_source;
        }
        if (refinementMeta.assumptions_added) {
          generationMeta.assumptions_used = [
            ...(generationMeta.assumptions_used || []),
            ...refinementMeta.assumptions_added,
          ];
        }
        // Add industry pack metadata
        if (refinementMeta.industry_id_used) {
          generationMeta.industry_id_used = refinementMeta.industry_id_used;
        }
        if (refinementMeta.industry_pack_applied) {
          generationMeta.industry_pack_applied = refinementMeta.industry_pack_applied;
        }
        if (refinementMeta.industry_source) {
          generationMeta.industry_source = refinementMeta.industry_source;
        }
      }
    } else {
      // Phase 2: Quick mode - use existing generator (unchanged behavior)
      const quickOutput = await generateSalesContent({
        companyName: input.companyName,
        productDesc: input.productDesc,
        targetAudience: input.targetAudience,
        goal: input.goal,
        tone: input.tone,
        market: input.market,
        strategy: strategySelection.strategy,
      });

      // Filter output based on selected assets
      output = {};
      if (selectedAssets.coldCall !== false) {
        output.coldCallScript = quickOutput.coldCallScript;
        generationMeta.assets_generated.push('coldCall');
      }
      if (selectedAssets.coldEmail !== false) {
        output.coldEmail = quickOutput.coldEmail;
        generationMeta.assets_generated.push('coldEmail');
      }
      if (selectedAssets.pitch !== false) {
        output.salesPitch = quickOutput.salesPitch;
        generationMeta.assets_generated.push('pitch');
      }

      // Quick mode metadata (minimal)
      generationMeta.inputs_used = [
        'company_name',
        'product_or_service',
        'target_audience',
        'goal',
        'tone',
        'market',
      ];

      // Phase 3: Apply language refinement pipeline for quick mode (lighter pass)
      const refinementEnabled = process.env.SALLY_LANGUAGE_REFINEMENT !== 'false'; // Default enabled
      if (refinementEnabled) {
        // Build normalized input for quick mode (minimal)
        const quickNormalizedInput = {
          company_name: input.companyName,
          product_or_service: input.productDesc,
          one_line_value: input.oneLineValue || '',
          goal: input.goal,
          market: input.market,
          tone: input.tone,
          target_audience: input.targetAudience,
          persona_role: input.personaRole,
          persona_role_custom: input.personaRoleCustom,
          top_pain: input.topPain,
          sales_motion: input.salesMotion,
          strategy: strategySelection.strategy,
          industry_id: input.industry_id || null, // Add industry_id for quick mode too
        };

        const { refined, metadata: refinementMeta } = applyLanguageRefinement(
          output,
          quickNormalizedInput,
          mode,
          selectedAssets
        );
        output = refined;
        // Merge refinement metadata (including industry pack metadata)
        generationMeta.language_pass_applied = refinementMeta.language_pass_applied;
        if (refinementMeta.delivery_style_used) {
          generationMeta.delivery_style_used = refinementMeta.delivery_style_used;
        }
        if (refinementMeta.pain_source) {
          generationMeta.pain_source = refinementMeta.pain_source;
        }
        if (refinementMeta.assumptions_added) {
          generationMeta.assumptions_used = [
            ...(generationMeta.assumptions_used || []),
            ...refinementMeta.assumptions_added,
          ];
        }
        // Add industry pack metadata
        if (refinementMeta.industry_id_used) {
          generationMeta.industry_id_used = refinementMeta.industry_id_used;
        }
        if (refinementMeta.industry_pack_applied) {
          generationMeta.industry_pack_applied = refinementMeta.industry_pack_applied;
        }
        if (refinementMeta.industry_source) {
          generationMeta.industry_source = refinementMeta.industry_source;
        }
      }
    }

    // 3.4. Sales Workspaces: Create or update workspace
    let workspaceId: string | null = null;
    let workspaceTitle: string | null = null;
    
    try {
      console.log('[Sally] Starting workspace creation/update process', {
        hasWorkspaceId: !!input.workspaceId,
        userId,
        companyId: input.companyId,
      });

      // If workspaceId is provided, use it; otherwise create/find one
      if (input.workspaceId) {
        // Verify workspace ownership
        const existingWorkspace = await prisma.sales_workspaces.findFirst({
          where: {
            id: input.workspaceId,
            userId: userId,
            companyId: input.companyId,
          },
        });

        if (existingWorkspace) {
          workspaceId = existingWorkspace.id;
          workspaceTitle = existingWorkspace.title;
          // Update workspace timestamp
          await prisma.sales_workspaces.update({
            where: { id: workspaceId },
            data: { updatedAt: new Date() },
          });
        }
      } else {
        // Check if there's an existing workspace for this company (most recent)
        const existingWorkspace = await prisma.sales_workspaces.findFirst({
          where: {
            userId: userId,
            companyId: input.companyId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        });

        if (existingWorkspace) {
          // Reuse existing workspace
          workspaceId = existingWorkspace.id;
          workspaceTitle = existingWorkspace.title;
          await prisma.sales_workspaces.update({
            where: { id: workspaceId },
            data: { updatedAt: new Date() },
          });
        } else {
          // Create new workspace
          const goalType = input.goal || 'sales_effort';
          const title = `${input.companyName} - ${goalType.replace('_', ' ')}`;
          
          console.log('[Sally] Creating new workspace', {
            title,
            goalType,
            userId,
            companyId: input.companyId,
          });
          
          const newWorkspace = await prisma.sales_workspaces.create({
            data: {
              id: uuidv4(),
              userId: userId,
              companyId: input.companyId,
              title: title,
              goalType: goalType,
              metadata: {
                mode: mode,
                goal: input.goal,
              },
            },
          });
          
          console.log('[Sally] Workspace created successfully', {
            workspaceId: newWorkspace.id,
            title: newWorkspace.title,
          });
          
          workspaceId = newWorkspace.id;
          workspaceTitle = newWorkspace.title;
        }
      }

      // Update generation metadata with workspace info
      if (workspaceId) {
        generationMeta.workspace_id = workspaceId;
        generationMeta.workspace_title = workspaceTitle;
        console.log('[Sally] ✅ Workspace linked to generation', {
          workspaceId,
          workspaceTitle,
          companyId: input.companyId,
          userId,
        });
      } else {
        console.log('[Sally] ⚠️  No workspace ID available to link');
        console.log('[Sally] This means content will be saved without workspaceId');
      }
    } catch (workspaceError: any) {
      // Log but don't fail the request if workspace creation fails
      console.error('[Sally] ❌ ERROR managing workspace:', workspaceError);
      console.error('[Sally] Workspace error details:', {
        message: workspaceError?.message,
        code: workspaceError?.code,
        meta: workspaceError?.meta,
        stack: workspaceError?.stack?.split('\n').slice(0, 10).join('\n'),
      });
      
      // Check if it's a Prisma client issue
      if (workspaceError?.message?.includes('sales_workspaces') || 
          workspaceError?.code === 'P2001' ||
          workspaceError?.message?.includes('Unknown model')) {
        console.error('[Sally] ⚠️  CRITICAL: Prisma client may not be regenerated!');
        console.error('[Sally] ⚠️  Run: npx prisma generate (after stopping dev server)');
      }
      
      // Don't set workspaceId if creation failed
      workspaceId = null;
      workspaceTitle = null;
      
      console.error('[Sally] ⚠️  Content will be saved WITHOUT workspaceId due to workspace creation failure');
    }

    // 3.5. Sales Coach Mode (read-only guidance layer, Advanced Mode only)
    let salesCoachOutput = null;
    const salesCoachEnabled = mode === 'advanced';
    
    if (salesCoachEnabled) {
      try {
        // Build normalized input for coaching context
        const coachingInput: any = {
          company_name: input.companyName,
          product_or_service: input.productDesc,
          one_line_value: input.oneLineValue || '',
          goal: input.goal,
          market: input.market,
          tone: input.tone,
          target_audience: input.targetAudience,
          persona_role: input.personaRole,
          persona_role_custom: input.personaRoleCustom,
          top_pain: input.topPain,
          sales_motion: input.salesMotion,
          industry_id: input.industry_id || null,
        };

        // Add advanced fields if available
        if (mode === 'advanced') {
          coachingInput.primary_kpi = input.primaryKPI;
          coachingInput.primary_kpi_custom = input.primaryKPICustom;
          coachingInput.primary_cta = input.primaryCTA;
          coachingInput.fallback_cta = input.fallbackCTA;
          coachingInput.buying_trigger = input.buyingTrigger;
          coachingInput.buying_trigger_note = input.buyingTriggerNote;
          coachingInput.competitor_or_alternative = input.competitorAlternative;
          coachingInput.differentiator_angle = input.differentiatorAngle;
          coachingInput.proof_types = input.proofTypes;
          coachingInput.proof_snippet = input.proofSnippet;
          coachingInput.objections = input.topObjections;
          coachingInput.objections_custom = input.topObjectionsCustom;
        }

        salesCoachOutput = generateSalesCoaching({
          generatedContent: output,
          input: coachingInput,
          generationMeta: {
            pain_source: generationMeta.pain_source,
            delivery_style_used: generationMeta.delivery_style_used,
            mode: mode,
          },
          selectedAssets: selectedAssets,
        });

        // Update generation metadata
        generationMeta.sales_coach_mode = 'enabled';
        const coachingAssets: string[] = [];
        if (salesCoachOutput.coldCall) coachingAssets.push('cold_call');
        if (salesCoachOutput.coldEmail) coachingAssets.push('cold_email');
        if (salesCoachOutput.pitch) coachingAssets.push('pitch');
        generationMeta.coaching_assets_generated = coachingAssets;
      } catch (coachError) {
        // Log but don't fail the request if coaching fails
        console.error('[Sally] Error generating sales coaching:', coachError);
        generationMeta.sales_coach_mode = 'disabled';
      }
    } else {
      generationMeta.sales_coach_mode = 'disabled';
    }

    // 4. Persist run data including strategy
    // Save to both tables: sales_agent_runs (backward compatibility) and sally_sales_content (company-scoped)
    
    // Prepare advanced inputs object (only include if advanced mode)
    const advancedInputs = mode === 'advanced' ? {
      primaryKPI: input.primaryKPI,
      primaryKPICustom: input.primaryKPICustom,
      primaryCTA: input.primaryCTA,
      fallbackCTA: input.fallbackCTA,
      buyingTrigger: input.buyingTrigger,
      buyingTriggerNote: input.buyingTriggerNote,
      competitorAlternative: input.competitorAlternative,
      differentiatorAngle: input.differentiatorAngle,
      proofTypes: input.proofTypes,
      proofSnippet: input.proofSnippet,
      topObjections: input.topObjections,
      topObjectionsCustom: input.topObjectionsCustom,
      // Phase 2: Store generation metadata
      generation_meta: generationMeta,
    } : null;

    // Save to sales_agent_runs for backward compatibility (don't fail if this fails)
    try {
      await prisma.sales_agent_runs.create({
        data: {
          id: uuidv4(),
          tenantId: tenantContext.tenantId,
          userId: userId,
          companyId: input.companyId,
          inputJson: input,
          outputJson: output,
          strategy: strategySelection.strategy,
          strategyReason: strategySelection.reason,
        },
      });
      console.log('[Sally] ✅ Saved to sales_agent_runs (backward compatibility)');
    } catch (runsError: any) {
      console.error('[Sally] ⚠️  Failed to save to sales_agent_runs (non-critical):', runsError.message);
      // Continue - this is backward compatibility only
    }

    // Save to sally_sales_content for company-scoped architecture
    // NOTE: Due to unique constraint on userId_companyId, there's only one content record per company
    // When generating, we always update it to link to the current workspace
    try {
      console.log('[Sally] Saving content to database:', {
        userId,
        companyId: input.companyId,
        workspaceId,
        hasOutput: !!output,
        mode,
      });
      
      const savedContent = await prisma.sally_sales_content.upsert({
        where: {
          userId_companyId: {
            userId: userId,
            companyId: input.companyId,
          },
        },
        create: {
          id: uuidv4(),
          userId: userId,
          companyId: input.companyId,
          inputJson: input,
          outputJson: output,
          strategy: strategySelection.strategy,
          strategyReason: strategySelection.reason,
          mode: mode,
          selectedAssets: selectedAssets,
          advancedInputs: advancedInputs,
          workspaceId: workspaceId, // Always link to workspace if available
        },
        update: {
          inputJson: input,
          outputJson: output,
          strategy: strategySelection.strategy,
          strategyReason: strategySelection.reason,
          mode: mode,
          selectedAssets: selectedAssets,
          advancedInputs: advancedInputs,
          workspaceId: workspaceId, // Always update workspaceId to current workspace
          updatedAt: new Date(),
        },
      });
      
      console.log('[Sally] ✅ Content saved successfully:', {
        contentId: savedContent.id,
        workspaceId: savedContent.workspaceId,
        companyId: savedContent.companyId,
        userId: savedContent.userId,
        wasCreated: !savedContent.updatedAt || savedContent.createdAt.getTime() === savedContent.updatedAt.getTime(),
      });
    } catch (dbError: any) {
      // Log but don't fail the request if persistence fails
      console.error('[Sally] ❌ Error persisting content to sally_sales_content:', dbError);
      console.error('[Sally] Error details:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta,
        stack: dbError.stack?.split('\n').slice(0, 5).join('\n'),
      });
      
      // If it's a table not found error, log it clearly
      if (dbError.code === 'P2021' || dbError.message?.includes('does not exist')) {
        console.error('[Sally] ⚠️  CRITICAL: sally_sales_content table does not exist!');
        console.error('[Sally] 💡 Run: node scripts/create-sally-tables-simple.js');
      }
      
      // If it's a unique constraint violation, that's unexpected but we'll continue
      if (dbError.code === 'P2002') {
        console.error('[Sally] ⚠️  Unique constraint violation - this should not happen with upsert');
      }
    }

    // 5. Return structured JSON output with strategy and metadata (additive)
    const response: any = {
      success: true,
      data: output, // Existing response shape (backward compatible)
      strategy: { // Phase 2: Return strategy in response
        name: strategySelection.strategy,
        reason: strategySelection.reason,
      },
      generation_meta: generationMeta, // Phase 2: Add metadata (additive, non-breaking)
    };

    // Add sales coaching if available (additive, non-breaking)
    if (salesCoachOutput) {
      response.coaching = salesCoachOutput;
    }

    // Add workspace info if available (additive, non-breaking)
    if (workspaceId) {
      response.workspace = {
        id: workspaceId,
        title: workspaceTitle,
      };
      console.log('[Sally] ✅ Workspace included in API response:', response.workspace);
    } else {
      console.log('[Sally] ⚠️  No workspaceId available to include in response');
    }

    console.log('[Sally] ========== GENERATE REQUEST COMPLETED ==========');
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Sally] Error generating content:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate sales content',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

