import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserIdFromRequest } from '@/lib/followup-auth-middleware';

const prisma = new PrismaClient();

/**
 * GET /api/deliveries - List all deliveries (paginate, filter by rule/status)
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const ruleId = searchParams.get('ruleId');
    const status = searchParams.get('status');
    const skip = (page - 1) * limit;

    // Build where clause - ensure user can only see their own deliveries
    const where: any = {
      rule: {
        userId // Filter by user's rules
      }
    };
    if (ruleId) {
      // Also verify rule belongs to user
      const rule = await prisma.rule.findFirst({
        where: { id: ruleId, userId }
      })
      if (!rule) {
        return NextResponse.json({
          ok: false,
          issues: [{
            field: 'ruleId',
            code: 'RULE_NOT_FOUND',
            message: 'Rule not found or access denied'
          }]
        }, { status: 404 })
      }
      where.ruleId = ruleId;
    }
    if (status) {
      where.status = status;
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      skip,
      take: limit,
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            mapping: {
              select: {
                id: true,
                resource: true,
                connection: {
                  select: {
                    id: true,
                    name: true,
                    type: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const total = await prisma.delivery.count({ where });

    return NextResponse.json({
      ok: true,
      deliveries: deliveries.map(delivery => ({
        id: delivery.id,
        ruleId: delivery.ruleId,
        entityPk: delivery.entityPk,
        contact: delivery.contact,
        channel: delivery.channel,
        status: delivery.status,
        idempotencyKey: delivery.idempotencyKey,
        dedupeKey: delivery.dedupeKey, // Sprint 3: New dedupe key
        sentAt: delivery.sentAt,
        error: delivery.error,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
        rule: {
          id: delivery.rule.id,
          name: delivery.rule.name,
          mapping: {
            id: delivery.rule.mapping.id,
            resource: delivery.rule.mapping.resource,
            connection: delivery.rule.mapping.connection ? {
              id: delivery.rule.mapping.connection.id,
              name: delivery.rule.mapping.connection.name,
              type: delivery.rule.mapping.connection.type
            } : null
          }
        }
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        ruleId: ruleId || null,
        status: status || null
      }
    });

  } catch (error) {
    console.error('Deliveries API error:', error);
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
