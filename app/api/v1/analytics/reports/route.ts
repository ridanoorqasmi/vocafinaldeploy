// app/api/v1/analytics/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getReportingEngine } from '../../../../../lib/reporting-engine';
import { ReportConfig } from '../../../../../lib/analytics-types';

const prisma = new PrismaClient();
const reportingEngine = getReportingEngine(prisma);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id, report_config, delivery_options } = body;

    if (!business_id || !report_config) {
      return NextResponse.json({ 
        error: 'business_id and report_config are required' 
      }, { status: 400 });
    }

    // Validate report configuration
    if (!report_config.report_type || !report_config.date_range || !report_config.export_format) {
      return NextResponse.json({ 
        error: 'Invalid report configuration. Missing required fields.' 
      }, { status: 400 });
    }

    // Generate the report
    const report = await reportingEngine.generateReport(business_id, report_config as ReportConfig);

    // Handle delivery options if provided
    let schedule = null;
    if (delivery_options?.schedule_frequency) {
      schedule = await reportingEngine.createScheduledReport({
        business_id,
        report_config: report_config as ReportConfig,
        schedule: {
          frequency: delivery_options.schedule_frequency,
          day_of_week: delivery_options.day_of_week,
          day_of_month: delivery_options.day_of_month,
          time: delivery_options.time || '09:00',
          timezone: delivery_options.timezone || 'UTC'
        },
        delivery: {
          email_recipients: delivery_options.email_recipients || [],
          webhook_url: delivery_options.webhook_url,
          storage_location: delivery_options.storage_location
        },
        active: true
      });
    }

    return NextResponse.json({
      report: {
        report_id: report.id,
        status: report.status,
        download_url: report.download_url,
        expires_at: report.expires_at.toISOString(),
        file_size_mb: report.file_size_mb
      },
      schedule: schedule ? {
        schedule_id: schedule.id,
        next_generation: schedule.next_generation?.toISOString(),
        active: schedule.active
      } : null
    }, { status: 202 }); // 202 Accepted for asynchronous processing

  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate report' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const reportId = searchParams.get('reportId');
    const category = searchParams.get('category');

    if (reportId) {
      // Get specific report status
      // In a real implementation, this would fetch from database
      return NextResponse.json({
        report: {
          report_id: reportId,
          status: 'completed',
          download_url: `/api/v1/reports/download/${reportId}`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          file_size_mb: 2.5,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        }
      }, { status: 200 });
    } else if (businessId) {
      // Get reports for a business
      // In a real implementation, this would fetch from database
      return NextResponse.json({
        reports: [
          {
            report_id: 'report_123',
            report_type: 'conversation_summary',
            status: 'completed',
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            file_size_mb: 1.8
          },
          {
            report_id: 'report_124',
            report_type: 'performance_analysis',
            status: 'generating',
            created_at: new Date().toISOString(),
            file_size_mb: null
          }
        ]
      }, { status: 200 });
    } else {
      // Get report templates
      const templates = await reportingEngine.getReportTemplates(category || undefined);
      
      return NextResponse.json({
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          config: template.config
        }))
      }, { status: 200 });
    }

  } catch (error: any) {
    console.error('Error getting reports:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get reports' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { report_id } = body;

    if (!report_id) {
      return NextResponse.json({ 
        error: 'report_id is required' 
      }, { status: 400 });
    }

    // In a real implementation, this would delete the report from database and storage
    console.log(`Deleting report: ${report_id}`);

    return NextResponse.json({ 
      message: 'Report deleted successfully' 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to delete report' 
    }, { status: 500 });
  }
}
