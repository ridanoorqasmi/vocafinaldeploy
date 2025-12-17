/**
 * Phase 4B: Emergency Usage Pool API
 * POST /api/v1/usage/emergency-pool - Access Emergency Usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { UsageEnforcementService } from '@/lib/usage-enforcement-service';
import { authenticateToken } from '@/lib/next-auth-middleware';
import { z } from 'zod';

const EmergencyPoolSchema = z.object({
  requested_amount: z.number().min(1).max(1000),
  business_justification: z.string().min(10).max(500),
  acknowledge_charges: z.boolean()
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate request and get business context
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const businessId = authResult.user.businessId;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = EmergencyPoolSchema.parse(body);

    const { requested_amount, business_justification, acknowledge_charges } = validatedData;

    // Check if user acknowledged charges
    if (!acknowledge_charges) {
      return NextResponse.json(
        { 
          error: 'Charge acknowledgment required',
          details: 'You must acknowledge the emergency usage charges to proceed'
        },
        { status: 400 }
      );
    }

    const usageEnforcement = new UsageEnforcementService();

    // Determine pool type based on request context
    const poolType = determinePoolType(request);

    // Request emergency pool access
    const result = await usageEnforcement.accessEmergencyPool(
      businessId,
      poolType,
      requested_amount,
      business_justification
    );

    if (!result.approved) {
      return NextResponse.json(
        { 
          error: 'Emergency pool access denied',
          details: 'Your business is not eligible for emergency usage pools at this time'
        },
        { status: 403 }
      );
    }

    // Log emergency pool usage
    await logEmergencyPoolUsage(businessId, poolType, requested_amount, business_justification);

    return NextResponse.json({
      success: true,
      data: {
        approved: result.approved,
        emergency_quota_granted: result.granted_amount,
        cost_per_unit: result.cost_per_unit,
        total_emergency_cost: result.total_cost,
        expires_at: result.expires_at,
        billing_note: `Emergency usage pool: ${result.granted_amount} ${poolType} units at ${result.cost_per_unit} cents per unit. Total cost: ${result.total_cost} cents.`
      }
    });

  } catch (error) {
    console.error('Emergency pool request error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to process emergency pool request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions

function determinePoolType(request: NextRequest): string {
  // Determine pool type based on request context
  const referer = request.headers.get('referer');
  const userAgent = request.headers.get('user-agent');
  
  // Default to queries if no specific context
  if (referer?.includes('/chat') || referer?.includes('/query')) {
    return 'queries';
  }
  
  if (referer?.includes('/api')) {
    return 'api_calls';
  }
  
  return 'queries';
}

async function logEmergencyPoolUsage(
  businessId: string,
  poolType: string,
  requestedAmount: number,
  justification: string
): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  await prisma.usage_events.create({
    data: {
      business_id: businessId,
      event_type: 'emergency_pool_request',
      quantity: requestedAmount,
      metadata: {
        pool_type: poolType,
        justification: justification,
        timestamp: new Date().toISOString()
      }
    }
  });
}
