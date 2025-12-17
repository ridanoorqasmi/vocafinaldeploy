import { NextRequest, NextResponse } from 'next/server';
import { getFollowupScheduler } from '@/lib/followup-scheduler';
import { getUserIdFromRequest } from '@/lib/followup-auth-middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/followup/cron-run - Manual trigger endpoint
 * Sprint 3: Runs all active rules once and returns JSON summary
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user ID - users can only trigger their own rules
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({
        ok: false,
        message: 'Authentication required'
      }, { status: 401 })
    }

    // Execute only active rules for this user
    const activeRules = await prisma.rule.findMany({
      where: {
        userId,
        active: true
      },
      include: {
        mapping: {
          include: {
            connection: true
          }
        }
      }
    })

    if (activeRules.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No active rules found',
        summary: {
          ran: 0,
          ruleIds: [],
          results: []
        }
      })
    }

    // Import runRule here to avoid circular dependency
    const { runRule } = await import('@/lib/runRule')

    const results: Array<{ ruleId: string; matched: number; sent: number; failed: number }> = []
    const ruleIds: string[] = []

    // Execute each rule for this user
    for (const rule of activeRules) {
      try {
        const result = await runRule(rule.id, false)
        
        if ('matched' in result) {
          results.push({
            ruleId: rule.id,
            matched: result.matched,
            sent: result.sent,
            failed: result.failed
          })
        }
        
        ruleIds.push(rule.id)
        
        // Small delay between rules
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error executing rule ${rule.name}:`, error)
        results.push({
          ruleId: rule.id,
          matched: 0,
          sent: 0,
          failed: 1
        })
        ruleIds.push(rule.id)
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully executed ${ruleIds.length} active rules`,
      summary: {
        ran: ruleIds.length,
        ruleIds,
        results
      }
    });

  } catch (error) {
    console.error('Manual trigger API error:', error);
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * GET /api/followup/cron-run - Get scheduler status
 * Sprint 3: Returns scheduler status information
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication optional for status check, but recommended
    const userId = await getUserIdFromRequest(request)
    
    // Get user's rule count if authenticated
    let userRuleCount = 0
    if (userId) {
      userRuleCount = await prisma.rule.count({
        where: { userId, active: true }
      })
    }

    const scheduler = getFollowupScheduler();
    const status = scheduler.getStatus();

    return NextResponse.json({
      ok: true,
      status: {
        ...status,
        userActiveRules: userId ? userRuleCount : null
      }
    });

  } catch (error) {
    console.error('Scheduler status API error:', error);
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

