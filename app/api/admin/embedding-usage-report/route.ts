// ===== ADMIN API - EMBEDDING USAGE REPORTS =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createAdminUtilities } from '@/lib/admin-utilities';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const period = searchParams.get('period') as 'hour' | 'day' | 'week' | 'month' || 'day';
    
    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_BUSINESS_ID',
          message: 'Business ID is required'
        }
      }, { status: 400 });
    }
    
    const adminUtils = createAdminUtilities(prisma);
    
    // Generate usage report
    const usageReport = await adminUtils.generateBusinessUsageReport(businessId, period);
    
    return NextResponse.json({
      success: true,
      data: usageReport
    });
    
  } catch (error) {
    console.error('Failed to generate usage report:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: 'Failed to generate usage report',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

