/**
 * Single Workspace API
 * 
 * GET: Load a workspace with full context
 * PATCH: Update workspace (e.g., title)
 * DELETE: Delete a workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';
import { getPrismaClient } from '@/lib/prisma';

const prisma = getPrismaClient();

// Helper to safely resolve params (works for both Next.js 14 and 15)
async function resolveParams<T extends Record<string, string>>(
  params: Promise<T> | T
): Promise<T> {
  if (params && typeof params === 'object' && 'then' in params && typeof (params as any).then === 'function') {
    return await (params as Promise<T>);
  }
  return params as T;
}

/**
 * GET /api/agents/sally/workspaces/[workspaceId]
 * Load a workspace with full context (inputs, outputs, metadata)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> | { workspaceId: string } }
) {
  try {
    // Safely resolve params (works for both Next.js 14 and 15)
    const resolvedParams = await resolveParams(params);
    
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
    const workspaceId = resolvedParams.workspaceId;

    // Fetch workspace first
    const workspace = await prisma.sales_workspaces.findFirst({
      where: {
        id: workspaceId,
        userId: userId, // Strict tenant isolation
      },
    });

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workspace not found or access denied',
        },
        { status: 404 }
      );
    }

    // Try to find content linked to this workspace
    let latestContent = null;
    try {
      console.log('[Sally] Searching for content:', {
        workspaceId,
        userId,
        companyId: workspace.companyId,
      });
      
      latestContent = await prisma.sally_sales_content.findFirst({
        where: {
          workspaceId: workspaceId,
          userId: userId,
          companyId: workspace.companyId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
      
      console.log('[Sally] Content search result (by workspaceId):', {
        found: !!latestContent,
        contentId: latestContent?.id,
        contentWorkspaceId: latestContent?.workspaceId,
      });

      // Fallback: If no content found by workspaceId, try to find content for this company
      // This handles cases where content was created before workspaceId was set
      if (!latestContent) {
        console.log('[Sally] No content found with workspaceId, trying fallback by companyId:', workspace.companyId);
        try {
          // Strategy 1: Try to find content with null workspaceId (unlinked content)
          latestContent = await prisma.sally_sales_content.findFirst({
            where: {
              userId: userId,
              companyId: workspace.companyId,
              workspaceId: null, // Content not yet linked to any workspace
            },
            orderBy: {
              updatedAt: 'desc',
            },
          });

          // Strategy 2: If still no content, try to find ANY content for this company
          // (might be linked to a different workspace, but we'll still show it)
          if (!latestContent) {
            console.log('[Sally] No unlinked content found, trying to find any content for company');
            
            // First, let's check what content exists for this company
            const allContentForCompany = await prisma.sally_sales_content.findMany({
              where: {
                userId: userId,
                companyId: workspace.companyId,
              },
              select: {
                id: true,
                workspaceId: true,
                updatedAt: true,
              },
              orderBy: {
                updatedAt: 'desc',
              },
            });
            
            console.log('[Sally] All content for company:', {
              count: allContentForCompany.length,
              content: allContentForCompany.map(c => ({
                id: c.id,
                workspaceId: c.workspaceId,
                updatedAt: c.updatedAt,
              })),
            });
            
            latestContent = await prisma.sally_sales_content.findFirst({
              where: {
                userId: userId,
                companyId: workspace.companyId,
              },
              orderBy: {
                updatedAt: 'desc',
              },
            });
            
            if (latestContent) {
              console.log('[Sally] Found content linked to different workspace, will link to current workspace');
            } else {
              console.log('[Sally] ⚠️  No content found at all for this company');
            }
          }

          // If we found content (unlinked or from different workspace), link it to this workspace
          if (latestContent) {
            const shouldLink = !latestContent.workspaceId || latestContent.workspaceId !== workspaceId;
            
            if (shouldLink) {
              console.log('[Sally] Linking content to workspace:', {
                contentId: latestContent.id,
                currentWorkspaceId: latestContent.workspaceId,
                targetWorkspaceId: workspaceId,
              });
              
              try {
                await prisma.sally_sales_content.update({
                  where: { id: latestContent.id },
                  data: { workspaceId: workspaceId },
                });
                console.log('[Sally] ✅ Content linked to workspace');
              } catch (linkError: any) {
                console.error('[Sally] Failed to link content to workspace:', linkError);
                // Continue anyway - we'll return the content even if linking failed
              }
            }
          }
        } catch (fallbackError: any) {
          console.error('[Sally] Error in fallback content query:', fallbackError);
          // Continue - we'll return workspace without content
        }
      }
    } catch (contentError: any) {
      // Handle case where table doesn't exist yet
      if (contentError.code === 'P2021' || contentError.message?.includes('does not exist')) {
        console.log('[Sally] ⚠️  sally_sales_content table does not exist yet');
        console.log('[Sally] 💡 Run the migration: node scripts/create-sally-tables.js');
        // Continue without content - workspace will still be returned
        latestContent = null;
      } else {
        // Re-throw other errors
        throw contentError;
      }
    }

    console.log('[Sally] Loading workspace:', {
      workspaceId,
      userId,
      companyId: workspace.companyId,
      workspaceTitle: workspace.title,
      hasContent: !!latestContent,
      contentId: latestContent?.id,
      contentWorkspaceId: latestContent?.workspaceId,
      hasOutputJson: !!latestContent?.outputJson,
      outputJsonKeys: latestContent?.outputJson ? Object.keys(latestContent.outputJson as any) : [],
    });

    // Build response with full context
    const response: any = {
      id: workspace.id,
      title: workspace.title,
      goalType: workspace.goalType,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      metadata: workspace.metadata,
    };

    if (latestContent) {
      response.content = {
        id: latestContent.id,
        inputJson: latestContent.inputJson,
        outputJson: latestContent.outputJson,
        strategy: latestContent.strategy,
        strategyReason: latestContent.strategyReason,
        mode: latestContent.mode,
        selectedAssets: latestContent.selectedAssets,
        advancedInputs: latestContent.advancedInputs,
        createdAt: latestContent.createdAt,
        updatedAt: latestContent.updatedAt,
      };
      console.log('[Sally] ✅ Content included in workspace response');
    } else {
      console.log('[Sally] ⚠️  No content found for workspace:', workspaceId);
      console.log('[Sally] This might mean:');
      console.log('[Sally]   1. Content was not linked to this workspace when generated');
      console.log('[Sally]   2. Content exists but workspaceId was not set');
      console.log('[Sally]   3. Content was deleted or unlinked');
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('[Sally] Error loading workspace:', error);
    console.error('[Sally] Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load workspace',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agents/sally/workspaces/[workspaceId]
 * Update workspace (e.g., title)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> | { workspaceId: string } }
) {
  try {
    // Safely resolve params (works for both Next.js 14 and 15)
    const resolvedParams = await resolveParams(params);
    
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
    const workspaceId = resolvedParams.workspaceId;
    const body = await request.json();
    const { title, goalType, metadata } = body;

    // Verify workspace ownership
    const existingWorkspace = await prisma.sales_workspaces.findFirst({
      where: {
        id: workspaceId,
        userId: userId,
      },
    });

    if (!existingWorkspace) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workspace not found or access denied',
        },
        { status: 404 }
      );
    }

    // Update workspace
    const workspace = await prisma.sales_workspaces.update({
      where: {
        id: workspaceId,
      },
      data: {
        ...(title !== undefined && { title }),
        ...(goalType !== undefined && { goalType }),
        ...(metadata !== undefined && { metadata }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        goalType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    console.error('[Sally] Error updating workspace:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update workspace',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/sally/workspaces/[workspaceId]
 * Delete a workspace (content remains, just unlinked)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> | { workspaceId: string } }
) {
  try {
    // Safely resolve params (works for both Next.js 14 and 15)
    const resolvedParams = await resolveParams(params);
    
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
    const workspaceId = resolvedParams.workspaceId;

    // Verify workspace ownership
    const workspace = await prisma.sales_workspaces.findFirst({
      where: {
        id: workspaceId,
        userId: userId,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workspace not found or access denied',
        },
        { status: 404 }
      );
    }

    // Unlink content from workspace (set workspaceId to null)
    await prisma.sally_sales_content.updateMany({
      where: {
        workspaceId: workspaceId,
      },
      data: {
        workspaceId: null,
      },
    });

    // Delete workspace
    await prisma.sales_workspaces.delete({
      where: {
        id: workspaceId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Workspace deleted successfully',
    });
  } catch (error: any) {
    console.error('[Sally] Error deleting workspace:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete workspace',
        message: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
