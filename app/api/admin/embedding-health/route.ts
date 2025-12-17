// ===== ADMIN API - EMBEDDING SERVICE HEALTH =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createAdminUtilities } from '@/lib/admin-utilities';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const adminUtils = createAdminUtilities(prisma);
    
    // Get system health status
    const healthStatus = await adminUtils.getSystemHealthStatus();
    
    return NextResponse.json({
      success: true,
      data: healthStatus
    });
    
  } catch (error) {
    console.error('Failed to get embedding service health:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Failed to get system health status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

