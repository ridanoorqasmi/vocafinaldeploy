import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { runRule } from '@/lib/runRule';
import { getUserIdFromRequest } from '@/lib/followup-auth-middleware';

const prisma = new PrismaClient();

// Validation interfaces
interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

interface RuleData {
  mappingId: string;
  name: string;
  active?: boolean;
  scheduleCron?: string;
  condition: any;
  action: any;
}

// Valid channels
const VALID_CHANNELS = ['email', 'sms', 'whatsapp', 'dashboard'] as const;

/**
 * POST /api/rules - Create or update a rule
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { mappingId, name, active = true, scheduleCron, condition, action } = body as RuleData;

    // Validate request structure
    if (!mappingId || !name || !condition || !action) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'general',
          code: 'MISSING_FIELDS',
          message: 'Mapping ID, name, condition, and action are required'
        }]
      }, { status: 400 });
    }

    // Validate mapping exists and belongs to user
    const mapping = await prisma.mapping.findFirst({
      where: { 
        id: mappingId,
        userId // Ensure mapping belongs to the authenticated user
      }
    });

    if (!mapping) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'mappingId',
          code: 'MAPPING_NOT_FOUND',
          message: 'Referenced mapping does not exist or you do not have access to it'
        }]
      }, { status: 400 });
    }

    // Validate condition JSON
    const conditionValidation = validateCondition(condition);
    if (!conditionValidation.valid) {
      return NextResponse.json({
        ok: false,
        issues: conditionValidation.issues
      }, { status: 400 });
    }

    // Validate action JSON
    const actionValidation = validateAction(action);
    if (!actionValidation.valid) {
      return NextResponse.json({
        ok: false,
        issues: actionValidation.issues
      }, { status: 400 });
    }

    // Create or update rule
    const rule = await prisma.rule.upsert({
      where: { id: body.id || 'dummy' }, // This will create a new rule if id doesn't exist
      update: {
        userId, // Ensure userId is set on update too
        mappingId,
        name,
        active,
        scheduleCron: scheduleCron || "0 */3 * * *",
        condition,
        action,
        updatedAt: new Date()
      },
      create: {
        userId, // Associate rule with authenticated user
        mappingId,
        name,
        active,
        scheduleCron: scheduleCron || "0 */3 * * *",
        condition,
        action
      }
    });

    return NextResponse.json({
      ok: true,
      ruleId: rule.id,
      summary: {
        name: rule.name,
        mappingId: rule.mappingId,
        active: rule.active,
        scheduleCron: rule.scheduleCron
      }
    });

  } catch (error) {
    console.error('Rules API error:', error);
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
 * GET /api/rules - List all rules
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const rules = await prisma.rule.findMany({
      where: {
        userId: userId // Only get rules for the authenticated user (filters out NULL userIds)
      },
      skip,
      take: limit,
      include: {
        mapping: {
          include: {
            connection: true
          }
        },
        _count: {
          select: {
            deliveries: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const total = await prisma.rule.count({
      where: {
        userId: userId // Count only user's rules
      }
    });

    return NextResponse.json({
      ok: true,
      rules: rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        active: rule.active,
        scheduleCron: rule.scheduleCron,
        condition: rule.condition, // Include condition data for display
        mapping: {
          id: rule.mapping.id,
          resource: rule.mapping.resource,
          connection: rule.mapping.connection ? {
            id: rule.mapping.connection.id,
            name: rule.mapping.connection.name,
            type: rule.mapping.connection.type
          } : null
        },
        deliveryCount: rule._count.deliveries,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Rules GET API error:', error);
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
 * Validate rule condition
 */
function validateCondition(condition: any): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!condition || typeof condition !== 'object') {
    issues.push({
      field: 'condition',
      code: 'INVALID_CONDITION',
      message: 'Condition must be a valid JSON object'
    });
    return { valid: false, issues };
  }

  // Check for required operators
  if (!condition.all && !condition.any && !condition.equals && !condition.olderThanDays) {
    issues.push({
      field: 'condition',
      code: 'MISSING_OPERATOR',
      message: 'Condition must contain at least one operator (all, any, equals, olderThanDays)'
    });
  }

  // Validate equals operator
  if (condition.equals) {
    if (!condition.equals.field || condition.equals.value === undefined) {
      issues.push({
        field: 'condition.equals',
        code: 'INVALID_EQUALS',
        message: 'Equals operator requires field and value'
      });
    }
  }

  // Validate olderThanDays operator
  if (condition.olderThanDays) {
    if (!condition.olderThanDays.field || typeof condition.olderThanDays.days !== 'number') {
      issues.push({
        field: 'condition.olderThanDays',
        code: 'INVALID_OLDER_THAN_DAYS',
        message: 'olderThanDays operator requires field and numeric days value'
      });
    }
  }

  // Recursively validate nested conditions
  if (condition.all && Array.isArray(condition.all)) {
    condition.all.forEach((subCondition: any, index: number) => {
      const subValidation = validateCondition(subCondition);
      if (!subValidation.valid) {
        issues.push(...subValidation.issues.map(issue => ({
          ...issue,
          field: `condition.all[${index}].${issue.field}`
        })));
      }
    });
  }

  if (condition.any && Array.isArray(condition.any)) {
    condition.any.forEach((subCondition: any, index: number) => {
      const subValidation = validateCondition(subCondition);
      if (!subValidation.valid) {
        issues.push(...subValidation.issues.map(issue => ({
          ...issue,
          field: `condition.any[${index}].${issue.field}`
        })));
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Validate rule action
 */
function validateAction(action: any): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!action || typeof action !== 'object') {
    issues.push({
      field: 'action',
      code: 'INVALID_ACTION',
      message: 'Action must be a valid JSON object'
    });
    return { valid: false, issues };
  }

  if (!action.channel || !VALID_CHANNELS.includes(action.channel)) {
    issues.push({
      field: 'action.channel',
      code: 'INVALID_CHANNEL',
      message: `Channel must be one of: ${VALID_CHANNELS.join(', ')}`
    });
  }

  if (action.channel === 'email') {
    if (!action.subject && !action.templateId) {
      issues.push({
        field: 'action.subject',
        code: 'MISSING_EMAIL_SUBJECT',
        message: 'Email action requires either subject or templateId'
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
