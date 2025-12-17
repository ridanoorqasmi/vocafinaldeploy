// ===== ADMIN API - EMBEDDING ADMIN ACTIONS =====

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createAdminUtilities } from '@/lib/admin-utilities';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, businessId, parameters } = body;
    
    const adminUtils = createAdminUtilities(prisma);
    
    let result;
    
    switch (action) {
      case 'retry_failed_jobs':
        result = await adminUtils.retryFailedJobs(businessId);
        break;
        
      case 'cleanup_old_data':
        const olderThanDays = parameters?.olderThanDays || 90;
        result = await adminUtils.cleanupOldData(olderThanDays);
        break;
        
      case 'regenerate_embeddings':
        if (!businessId) {
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_BUSINESS_ID',
              message: 'Business ID is required for regenerate_embeddings action'
            }
          }, { status: 400 });
        }
        result = await adminUtils.regenerateBusinessEmbeddings(businessId);
        break;
        
      case 'export_data':
        if (!businessId) {
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_BUSINESS_ID',
              message: 'Business ID is required for export_data action'
            }
          }, { status: 400 });
        }
        const { startDate, endDate, format } = parameters || {};
        if (!startDate || !endDate) {
          return NextResponse.json({
            success: false,
            error: {
              code: 'MISSING_DATE_RANGE',
              message: 'Start date and end date are required for export_data action'
            }
          }, { status: 400 });
        }
        result = await adminUtils.exportEmbeddingData(
          businessId,
          new Date(startDate),
          new Date(endDate),
          format || 'json'
        );
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: `Invalid action: ${action}`
          }
        }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Failed to execute admin action:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'ACTION_FAILED',
        message: 'Failed to execute admin action',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('actionId');
    
    const adminUtils = createAdminUtilities(prisma);
    
    if (actionId) {
      // Get specific action status
      const action = adminUtils.getAdminActionStatus(actionId);
      
      if (!action) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'ACTION_NOT_FOUND',
            message: `Action with ID ${actionId} not found`
          }
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        data: action
      });
    } else {
      // Get all actions
      const actions = adminUtils.getAllAdminActions();
      
      return NextResponse.json({
        success: true,
        data: actions
      });
    }
    
  } catch (error) {
    console.error('Failed to get admin actions:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_ACTIONS_FAILED',
        message: 'Failed to get admin actions',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

