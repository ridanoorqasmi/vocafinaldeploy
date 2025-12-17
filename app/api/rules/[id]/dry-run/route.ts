import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { runRule } from '@/lib/runRule';
import { getUserIdFromRequest } from '@/lib/followup-auth-middleware';

const prisma = new PrismaClient();

/**
 * GET /api/rules/[id]/dry-run - Evaluate rule conditions, return matching rows (no sends)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ruleId = params.id;

    if (!ruleId) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'id',
          code: 'MISSING_RULE_ID',
          message: 'Rule ID is required'
        }]
      }, { status: 400 });
    }

    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'general',
          code: 'AUTH_REQUIRED',
          message: 'Authentication required'
        }]
      }, { status: 401 })
    }

    // Verify rule exists and belongs to user
    const rule = await prisma.rule.findFirst({
      where: { 
        id: ruleId,
        userId // Ensure rule belongs to authenticated user
      },
      include: {
        mapping: {
          include: {
            connection: true
          }
        }
      }
    });

    if (!rule) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'id',
          code: 'RULE_NOT_FOUND',
          message: 'Rule not found'
        }]
      }, { status: 404 });
    }

    // Execute dry run
    const result = await runRule(ruleId, true);

    return NextResponse.json({
      ok: true,
      rule: {
        id: rule.id,
        name: rule.name,
        mapping: {
          id: rule.mapping.id,
          resource: rule.mapping.resource,
          connection: rule.mapping.connection ? {
            id: rule.mapping.connection.id,
            name: rule.mapping.connection.name,
            type: rule.mapping.connection.type
          } : null
        }
      },
      dryRun: result
    });

  } catch (error) {
    console.error('Rule dry-run API error:', error);
    return NextResponse.json({
      ok: false,
      issues: [{
        field: 'general',
        code: 'SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error'
      }]
    }, { status: 500 });
  }
}

/**
 * POST /api/rules/[id]/run - Execute follow-up, log deliveries
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ruleId = params.id;

    if (!ruleId) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'id',
          code: 'MISSING_RULE_ID',
          message: 'Rule ID is required'
        }]
      }, { status: 400 });
    }

    // Verify rule exists and is active
    const rule = await prisma.rule.findUnique({
      where: { id: ruleId },
      include: {
        mapping: {
          include: {
            connection: true
          }
        }
      }
    });

    if (!rule) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'id',
          code: 'RULE_NOT_FOUND',
          message: 'Rule not found'
        }]
      }, { status: 404 });
    }

    if (!rule.active) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'active',
          code: 'RULE_INACTIVE',
          message: 'Cannot run inactive rule'
        }]
      }, { status: 400 });
    }

    // Execute rule
    const result = await runRule(ruleId, false);

    return NextResponse.json({
      ok: true,
      rule: {
        id: rule.id,
        name: rule.name,
        mapping: {
          id: rule.mapping.id,
          resource: rule.mapping.resource,
          connection: rule.mapping.connection ? {
            id: rule.mapping.connection.id,
            name: rule.mapping.connection.name,
            type: rule.mapping.connection.type
          } : null
        }
      },
      execution: result
    });

  } catch (error) {
    console.error('Rule run API error:', error);
    return NextResponse.json({
      ok: false,
      issues: [{
        field: 'general',
        code: 'SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error'
      }]
    }, { status: 500 });
  }
}
