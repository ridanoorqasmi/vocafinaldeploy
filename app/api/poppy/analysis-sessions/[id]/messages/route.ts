/**
 * Phase 3: Analysis Session Messages API Route
 * Data Analyst Agent (Poppy) - Real Implementation
 * 
 * Phase 3: Processes analytics queries and generates artifacts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createMessageRequestSchema,
  createMessageResponseSchema,
  errorResponseSchema,
} from '@/lib/poppy/api/contracts';
import { validateRequestBody } from '@/lib/input-validation';
import { requireAuth, requireTenantOwnership, requirePermission } from '@/lib/auth/middleware';
import { createAuditLog, trackTokenUsage } from '@/lib/auth/store-db';
import { validateLLMCall, calculateCost } from '@/lib/auth/usage-limits';
import { z } from 'zod';
// Import will be done dynamically to ensure fresh store state

/**
 * POST /api/poppy/analysis-sessions/:id/messages
 * Create a new message in an analysis session
 * 
 * Phase 2: Messages are stored verbatim. No AI replies generated.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle Next.js 14 async params
    const resolvedParams = params instanceof Promise ? await params : params;
    
    // Validate session ID
    const sessionIdValidation = z.string().uuid().safeParse(resolvedParams.id);
    if (!sessionIdValidation.success) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: `Invalid session ID format: ${resolvedParams.id}`,
            code: 'VALIDATION_ERROR',
          },
        }),
        { status: 400 }
      );
    }

    const sessionId = sessionIdValidation.data;

    // Phase 6: Require authentication and permission
    const auth = await requirePermission(request, 'run_analysis');

    const body = await request.json();
    const validation = validateRequestBody(body, createMessageRequestSchema);

    if (!validation.success) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Invalid request',
            code: 'VALIDATION_ERROR',
            details: validation.errors,
          },
        }),
        { status: 400 }
      );
    }

    // Verify session exists (database-backed, no retries needed)
    const sessionStoreModule = await import('@/lib/poppy/services/session-store-db');
    const session = await sessionStoreModule.getSession(sessionId);
    
    if (!session) {
      console.error(`[Create Message] Session not found: ${sessionId}`);
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: 'Session not found',
            code: 'NOT_FOUND',
          },
        }),
        { status: 404 }
      );
    }

    // Phase 6: Verify session belongs to tenant
    requireTenantOwnership(auth.tenantId, session.tenantId, 'session');

    // Create user message - stored verbatim, no transformation
    const message = await sessionStoreModule.createMessage(
      sessionId,
      auth.tenantId,
      'user',
      validation.data!.content
    );

    // Phase 6: Audit log
    await createAuditLog(auth.userId, auth.tenantId, 'message_created', 'session', sessionId, {
      messageId: message.id,
      role: 'user',
    });

    console.log(`[Create Message] Message created: ${message.id} in session: ${sessionId}`);

    // Phase 3: Process analytics query if session has dataset
    const artifacts: any[] = [];
    let explanation: any = undefined;
    let assistantMessage: any = undefined;
    
    if (session.datasetId) {
      try {
        // Import analytics services
        const { classifyIntent } = await import('@/lib/poppy/services/analytics/intent-classifier');
        const { resolveAll } = await import('@/lib/poppy/services/analytics/metric-resolver');
        const { executeAnalysis } = await import('@/lib/poppy/services/analytics/execution-engine');
        const { validateSemanticOperations } = await import('@/lib/poppy/services/analytics/semantic-operation-guard');
        const artifactStoreModule = await import('@/lib/poppy/services/artifact-store-db');
        const datasetStoreModule = await import('@/lib/poppy/services/dataset-store-db');
        const fileStorageModule = await import('@/lib/poppy/services/file-storage');

        // Get dataset and latest version from database
        const dataset = await datasetStoreModule.getDataset(session.datasetId);
        if (dataset) {
          const latestVersion = await datasetStoreModule.getLatestVersion(session.datasetId);
          if (latestVersion) {
            // Get profile for metric resolution
            const profile = await datasetStoreModule.getLatestProfile(session.datasetId);
            if (profile) {
              console.log(`[Create Message] Profile found: ${profile.rowCount} rows, ${profile.columnCount} columns`);
              console.log(`[Create Message] Column names:`, profile.columns.map(c => c.name));
              
              // Classify intent
              const intentClassification = classifyIntent(validation.data!.content);
              console.log(`[Create Message] Intent classified: ${intentClassification.intent} (confidence: ${intentClassification.confidence})`);
              
              if (intentClassification.intent !== 'unsupported_query') {
                // Resolve metrics and dimensions
                const resolution = resolveAll(
                  validation.data!.content,
                  profile,
                  intentClassification.intent
                );
                console.log(`[Create Message] Resolution result:`, 'code' in resolution ? `ERROR: ${resolution.code} - ${resolution.message}` : `SUCCESS - metric: ${resolution.metric.columnName}`);

                if (!('code' in resolution)) {
                  // Phase 7: Semantic Operation Guard - validate operations before execution
                  const semanticGuardResult = validateSemanticOperations(
                    resolution,
                    intentClassification.intent,
                    latestVersion.id
                  );
                  
                  if (semanticGuardResult) {
                    console.log(`[Create Message] Semantic guard blocked operation: ${semanticGuardResult.attemptedOperation} on ${semanticGuardResult.column} (${semanticGuardResult.semanticType})`);
                    console.log(`[Create Message] Reason: ${semanticGuardResult.reason}`);
                    
                    // Generate analyst-like explanation using LLM (but guard decision is final)
                    try {
                      const { generateExplanation } = await import('@/lib/poppy/services/explanation/llm-explainer');
                      
                      // Phase 6: Check usage limits before LLM call (estimate ~1000 tokens)
                      const limitCheck = validateLLMCall(auth.userId, auth.tenantId, 1000);
                      if (!limitCheck.allowed) {
                        throw new Error(`Usage limit exceeded: ${limitCheck.error}`);
                      }

                      // Create a structured explanation request for the LLM
                      const explanationPrompt = `The user asked: "${validation.data!.content}"\n\n` +
                        `However, the operation "${semanticGuardResult.attemptedOperation}" on column "${semanticGuardResult.column}" (type: ${semanticGuardResult.semanticType}) is not semantically valid.\n\n` +
                        `Reason: ${semanticGuardResult.reason}\n\n` +
                        `Suggested alternatives: ${semanticGuardResult.suggestedAlternatives?.join(', ') || 'none'}\n\n` +
                        `Please provide a polite, analyst-like explanation that helps the user understand why this operation doesn't make sense and suggests what they can do instead. Be conversational and helpful, not technical or error-like.`;

                      // Use a simple LLM call to generate explanation
                      const { default: OpenAI } = await import('openai');
                      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                      
                      const explanationResponse = await openai.chat.completions.create({
                        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
                        messages: [
                          {
                            role: 'system',
                            content: 'You are a helpful data analyst assistant. Explain why certain operations are not valid in a friendly, professional manner. Suggest alternatives clearly.',
                          },
                          {
                            role: 'user',
                            content: explanationPrompt,
                          },
                        ],
                        temperature: 0.7,
                        max_tokens: 200,
                      });

                      const explanationText = explanationResponse.choices[0]?.message?.content || 
                        `${semanticGuardResult.reason} ${semanticGuardResult.suggestedAlternatives?.length ? `You can instead: ${semanticGuardResult.suggestedAlternatives.join(', ')}.` : ''}`;

                      // Phase 6: Track token usage
                      const usage = explanationResponse.usage;
                      if (usage) {
                        const cost = calculateCost(usage.promptTokens || 0, usage.completionTokens || 0);
                        await trackTokenUsage({
                          userId: auth.userId,
                          tenantId: auth.tenantId,
                          sessionId,
                          promptTokens: usage.promptTokens || 0,
                          completionTokens: usage.completionTokens || 0,
                          totalTokens: (usage.promptTokens || 0) + (usage.completionTokens || 0),
                          estimatedCost: cost,
                        });
                      }

                      // Create assistant message with explanation
                      assistantMessage = await sessionStoreModule.createMessage(
                        sessionId,
                        auth.tenantId,
                        'assistant',
                        explanationText
                      );
                      console.log(`[Create Message] Assistant message created (semantic guard): ${assistantMessage.id}`);
                    } catch (explanationError) {
                      console.error(`[Create Message] Error generating semantic guard explanation:`, explanationError);
                      // Fallback to structured message
                      const fallbackMessage = `${semanticGuardResult.reason} ${semanticGuardResult.suggestedAlternatives?.length ? `You can instead: ${semanticGuardResult.suggestedAlternatives.join(', ')}.` : ''}`;
                      assistantMessage = await sessionStoreModule.createMessage(
                        sessionId,
                        auth.tenantId,
                        'assistant',
                        fallbackMessage
                      );
                    }
                    
                    // Do NOT proceed to execution - guard has blocked it
                    // Continue to response creation below
                  } else {
                    // Semantic guard passed - proceed with execution
                    // Execute analysis
                    const filePath = latestVersion.filePath;
                    console.log(`[Create Message] Executing analysis on file: ${filePath}`);
                    const analysisResult = executeAnalysis(
                      filePath,
                      intentClassification.intent,
                      resolution
                    );
                    console.log(`[Create Message] Analysis result:`, 'code' in analysisResult ? `ERROR: ${analysisResult.code} - ${analysisResult.message}` : `SUCCESS - type: ${analysisResult.type}`);

                    if (!('code' in analysisResult)) {
                    // Create artifact in database
                    const artifact = await artifactStoreModule.createArtifact(
                      sessionId,
                      auth.tenantId,
                      analysisResult,
                      undefined // Auto-generate title
                    );

                    artifacts.push(artifact);
                    console.log(`[Create Message] Artifact created: ${artifact.id} for session: ${sessionId}`);

                    // Phase 5: Generate chart spec if artifact is eligible
                    try {
                      const { generateChartSpec } = await import('@/lib/poppy/services/charts/chart-selection');
                      const { generateChartMetadata } = await import('@/lib/poppy/services/charts/chart-title-generator');
                      
                      const chartSpec = generateChartSpec(artifact);
                      if (chartSpec) {
                        // Phase 6: Check usage limits before LLM call (estimate ~500 tokens)
                        const limitCheck = validateLLMCall(auth.userId, auth.tenantId, 500);
                        if (!limitCheck.allowed) {
                          console.warn(`[Create Message] Usage limit exceeded for chart metadata: ${limitCheck.error}`);
                          // Continue without LLM-generated metadata, use default
                        } else {
                          // Generate enhanced title/description using LLM (optional)
                          const chartMetadata = await generateChartMetadata(artifact, chartSpec);
                          
                          // Phase 6: Track token usage (estimate if not returned)
                          if (chartMetadata.usage) {
                            const cost = calculateCost(chartMetadata.usage.promptTokens || 0, chartMetadata.usage.completionTokens || 0);
                            await trackTokenUsage({
                              userId: auth.userId,
                              tenantId: auth.tenantId,
                              sessionId,
                              artifactId: artifact.id,
                              promptTokens: chartMetadata.usage.promptTokens || 0,
                              completionTokens: chartMetadata.usage.completionTokens || 0,
                              totalTokens: (chartMetadata.usage.promptTokens || 0) + (chartMetadata.usage.completionTokens || 0),
                              estimatedCost: cost,
                            });
                          }
                          
                          // Update chart spec with LLM-generated metadata
                          chartSpec.title = chartMetadata.title;
                          chartSpec.description = chartMetadata.description;
                        }
                        
                        // Store chart spec in artifact metadata in database
                        const updatedMetadata = {
                          ...artifact.metadata,
                          chartSpec: chartSpec,
                        };
                        await artifactStoreModule.updateArtifact(artifact.id, {
                          metadata: updatedMetadata,
                        });
                        
                        // Update local artifact reference for response
                        artifact.metadata = updatedMetadata;
                        
                        console.log(`[Create Message] Chart spec generated and saved for artifact: ${artifact.id}, type: ${chartSpec.type}`);
                      }
                    } catch (chartError) {
                      console.error(`[Create Message] Error generating chart spec:`, chartError);
                      // Continue without chart - artifact is still valid
                    }

                    // Phase 4.5: Generate intelligent explanation for the artifact
                    try {
                      const { generateExplanation, selectExplanationMode } = await import('@/lib/poppy/services/explanation/llm-explainer');
                      
                      // Get prior artifacts for context (last 3, excluding current)
                      // Note: Current artifact is already in store, so we filter it out
                      const allSessionArtifacts = await artifactStoreModule.getArtifactsBySession(sessionId);
                      const priorArtifacts = allSessionArtifacts
                        .filter(a => a.id !== artifact.id)
                        .slice(-3);
                      
                      // Select explanation mode (rule-based, deterministic)
                      // isFirstQuestion = true if this is the only artifact (or first one)
                      const isFirstQuestion = allSessionArtifacts.filter(a => a.id !== artifact.id).length === 0;
                      const mode = selectExplanationMode(artifact, priorArtifacts, isFirstQuestion);
                      console.log(`[Create Message] Selected explanation mode: ${mode} (isFirstQuestion: ${isFirstQuestion}, priorArtifacts: ${priorArtifacts.length})`);
                      
                      // Phase 6: Check usage limits before LLM call (estimate ~2000 tokens)
                      const limitCheck = validateLLMCall(auth.userId, auth.tenantId, 2000);
                      if (!limitCheck.allowed) {
                        throw new Error(`Usage limit exceeded: ${limitCheck.error}`);
                      }

                      // Generate explanation with context
                      const explanationResult = await generateExplanation(
                        validation.data!.content,
                        artifact,
                        profile,
                        mode,
                        priorArtifacts
                      );

                      // Phase 6: Track token usage
                      if (explanationResult.usage) {
                        const cost = calculateCost(explanationResult.usage.promptTokens || 0, explanationResult.usage.completionTokens || 0);
                        await trackTokenUsage({
                          userId: auth.userId,
                          tenantId: auth.tenantId,
                          sessionId,
                          artifactId: artifact.id,
                          promptTokens: explanationResult.usage.promptTokens || 0,
                          completionTokens: explanationResult.usage.completionTokens || 0,
                          totalTokens: (explanationResult.usage.promptTokens || 0) + (explanationResult.usage.completionTokens || 0),
                          estimatedCost: cost,
                        });

                        // Phase 6: Audit log for LLM usage
                        await createAuditLog(auth.userId, auth.tenantId, 'llm_invocation', 'artifact', artifact.id, {
                          promptTokens: explanationResult.usage.promptTokens || 0,
                          completionTokens: explanationResult.usage.completionTokens || 0,
                          totalTokens: (explanationResult.usage.promptTokens || 0) + (explanationResult.usage.completionTokens || 0),
                          estimatedCost: cost,
                        });
                      }

                      // Store explanation in database
                      const explanationStoreModule = await import('@/lib/poppy/services/explanation/explanation-store-db');
                      await explanationStoreModule.storeExplanation(sessionId, artifact.id, explanationResult);
                      
                      explanation = explanationResult;
                      console.log(`[Create Message] Explanation generated for artifact: ${artifact.id}`);

                      // Create assistant message with explanation
                      const explanationText = explanationResult.summary;
                      assistantMessage = await sessionStoreModule.createMessage(
                        sessionId,
                        auth.tenantId,
                        'assistant',
                        explanationText
                      );
                      console.log(`[Create Message] Assistant message created: ${assistantMessage.id}`);
                    } catch (explanationError) {
                      console.error(`[Create Message] Error generating explanation:`, explanationError);
                      // Create assistant message with artifact info even if explanation fails
                      assistantMessage = await sessionStoreModule.createMessage(
                        sessionId,
                        auth.tenantId,
                        'assistant',
                        `I've analyzed your data and created a ${artifact.type || 'visualization'}. You can view it in the artifacts panel on the right.`
                      );
                      console.log(`[Create Message] Assistant message created (fallback after explanation error): ${assistantMessage.id}`);
                    }
                    } else {
                      console.warn(`[Create Message] Analysis execution failed: ${analysisResult.message}`);
                      // Create fallback assistant message
                      assistantMessage = await sessionStoreModule.createMessage(
                        sessionId,
                        auth.tenantId,
                        'assistant',
                        `I encountered an issue analyzing your query: "${validation.data!.content}". Could you please rephrase your question or provide more details?`
                      );
                    }
                  }
                } else {
                  console.warn(`[Create Message] Metric resolution failed: ${resolution.message}`);
                  // Create fallback assistant message
                  assistantMessage = await sessionStoreModule.createMessage(
                    sessionId,
                    auth.tenantId,
                    'assistant',
                    `I'm having trouble understanding your question: "${validation.data!.content}". Could you try rephrasing it? For example, you could ask about averages, totals, counts, or comparisons.`
                  );
                }
              } else {
                console.log(`[Create Message] Query not supported: ${validation.data!.content}`);
                // Create assistant message for unsupported queries
                assistantMessage = await sessionStoreModule.createMessage(
                  sessionId,
                  auth.tenantId,
                  'assistant',
                  `I can help you analyze your data! Try asking questions like:\n- "What is the average of [column name]?"\n- "Show me the total of [column name]"\n- "How many records are there?"\n- "Compare [column1] and [column2]"\n\nYour question: "${validation.data!.content}" - could you rephrase it using one of these patterns?`
                );
              }
            } else {
              console.warn(`[Create Message] No profile found for dataset: ${session.datasetId}`);
              // Create assistant message when no profile exists
              assistantMessage = await sessionStoreModule.createMessage(
                sessionId,
                auth.tenantId,
                'assistant',
                `I need data to analyze! Please upload a CSV or XLSX file first. Once you upload data, I'll be able to answer questions about it.`
              );
            }
          } else {
            console.warn(`[Create Message] No version found for dataset: ${session.datasetId}`);
            // Create assistant message when no version exists
            assistantMessage = await sessionStoreModule.createMessage(
              sessionId,
              auth.tenantId,
              'assistant',
              `I need data to analyze! Please upload a CSV or XLSX file first. Once you upload data, I'll be able to answer questions about it.`
            );
          }
        } else {
          console.warn(`[Create Message] Dataset not found: ${session.datasetId}`);
          // Create assistant message when dataset not found
          assistantMessage = await sessionStoreModule.createMessage(
            sessionId,
            auth.tenantId,
            'assistant',
            `I'm having trouble accessing the dataset. Please try selecting a different dataset or contact support if the issue persists.`
          );
        }
      } catch (error) {
        console.error(`[Create Message] Error processing analytics:`, error);
        console.error(`[Create Message] Error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          sessionId,
          datasetId: session.datasetId,
          userQuestion: validation.data!.content,
        });
        // Only create fallback message if no artifact was created
        // If artifact was created but explanation failed, that's handled above
        if (!assistantMessage && artifacts.length === 0) {
          try {
            assistantMessage = await sessionStoreModule.createMessage(
              sessionId,
              auth.tenantId,
              'assistant',
              `I encountered an error processing your question: "${validation.data!.content}". The error was: ${error instanceof Error ? error.message : 'Unknown error'}. Please try rephrasing your question or check that your dataset has been uploaded correctly.`
            );
          } catch (fallbackError) {
            console.error(`[Create Message] Failed to create fallback message:`, fallbackError);
          }
        }
      }
    } else {
      // Session has no dataset - create helpful assistant message
      assistantMessage = await sessionStoreModule.createMessage(
        sessionId,
        auth.tenantId,
        'assistant',
        `Hello! I'm Poppy, your Data Analyst Agent. To get started, please select a dataset from the sidebar and upload some data (CSV or XLSX format). Once you have data, I can help you analyze it by answering questions about averages, totals, comparisons, and more!`
      );
    }

    const response = createMessageResponseSchema.parse({
      message,
      artifacts: artifacts.length > 0 ? artifacts : undefined,
      explanation,
      assistantMessage,
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // Phase 6: Handle auth errors
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN' || error.message.startsWith('FORBIDDEN'))) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: error.message === 'UNAUTHORIZED' ? 'Authentication required' : error.message,
            code: error.message.startsWith('FORBIDDEN') ? 'FORBIDDEN' : error.message,
          },
        }),
        { status: error.message === 'UNAUTHORIZED' ? 401 : 403 }
      );
    }

    // Phase 6: Handle usage limit errors
    if (error instanceof Error && error.message.includes('Usage limit exceeded')) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: {
            message: error.message,
            code: 'USAGE_LIMIT_EXCEEDED',
          },
        }),
        { status: 429 }
      );
    }

    return NextResponse.json(
      errorResponseSchema.parse({
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      }),
      { status: 500 }
    );
  }
}

