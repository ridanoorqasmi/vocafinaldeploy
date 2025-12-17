// app/api/v1/analytics/monitoring/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getMonitoringAlertingSystem } from '../../../../../lib/monitoring-alerting-system';

const prisma = new PrismaClient();
const monitoringSystem = getMonitoringAlertingSystem(prisma);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'health' | 'alerts' | 'quotas';

    switch (type) {
      case 'health':
        return await getSystemHealth(request);
      case 'alerts':
        return await getAlerts(request);
      case 'quotas':
        return await getQuotas(request);
      default:
        return NextResponse.json({ 
          error: 'Invalid type. Must be health, alerts, or quotas' 
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error getting monitoring data:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get monitoring data' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'create_alert':
        return await createAlert(data);
      case 'update_quota':
        return await updateQuota(data);
      case 'acknowledge_alert':
        return await acknowledgeAlert(data);
      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error processing monitoring action:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process monitoring action' 
    }, { status: 500 });
  }
}

async function getSystemHealth(request: NextRequest) {
  try {
    const healthStatus = await monitoringSystem.getSystemHealthStatus();

    return NextResponse.json({
      system_health: healthStatus,
      metadata: {
        generated_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error getting system health:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get system health' 
    }, { status: 500 });
  }
}

async function getAlerts(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');

    // In a real implementation, this would fetch alerts from database
    const alerts = [
      {
        alert_id: 'alert_123',
        business_id: businessId || 'business_123',
        severity: 'high',
        message: 'High response time detected',
        triggered_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        acknowledged: false,
        resolved: false
      },
      {
        alert_id: 'alert_124',
        business_id: businessId || 'business_123',
        severity: 'medium',
        message: 'Cache hit rate below threshold',
        triggered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        acknowledged: true,
        resolved: false
      }
    ];

    // Filter alerts based on parameters
    let filteredAlerts = alerts;
    if (businessId) {
      filteredAlerts = filteredAlerts.filter(alert => alert.business_id === businessId);
    }
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }
    if (status) {
      if (status === 'acknowledged') {
        filteredAlerts = filteredAlerts.filter(alert => alert.acknowledged);
      } else if (status === 'unacknowledged') {
        filteredAlerts = filteredAlerts.filter(alert => !alert.acknowledged);
      } else if (status === 'resolved') {
        filteredAlerts = filteredAlerts.filter(alert => alert.resolved);
      } else if (status === 'active') {
        filteredAlerts = filteredAlerts.filter(alert => !alert.resolved);
      }
    }

    return NextResponse.json({
      alerts: filteredAlerts,
      metadata: {
        total_count: filteredAlerts.length,
        generated_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error getting alerts:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get alerts' 
    }, { status: 500 });
  }
}

async function getQuotas(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ 
        error: 'businessId is required for quota monitoring' 
      }, { status: 400 });
    }

    // In a real implementation, this would fetch quotas from database
    const quotas = [
      {
        quota_type: 'monthly_queries',
        quota_limit: 10000,
        current_usage: 7500,
        usage_percentage: 75,
        status: 'warning',
        reset_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        quota_type: 'monthly_tokens',
        quota_limit: 1000000,
        current_usage: 650000,
        usage_percentage: 65,
        status: 'ok',
        reset_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        quota_type: 'monthly_cost',
        quota_limit: 100,
        current_usage: 85,
        usage_percentage: 85,
        status: 'warning',
        reset_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    return NextResponse.json({
      business_id: businessId,
      quotas,
      metadata: {
        generated_at: new Date().toISOString()
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error getting quotas:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get quotas' 
    }, { status: 500 });
  }
}

async function createAlert(data: any) {
  try {
    const { business_id, metric_type, condition, threshold, notification_channels, escalation_rules } = data;

    if (!business_id || !metric_type || !condition || !threshold) {
      return NextResponse.json({ 
        error: 'business_id, metric_type, condition, and threshold are required' 
      }, { status: 400 });
    }

    const alertDefinition = await monitoringSystem.createAlertDefinition({
      business_id,
      metric_type,
      condition,
      threshold,
      notification_channels: notification_channels || ['email'],
      escalation_rules: escalation_rules || {
        time_based: 30,
        frequency_based: 3,
        severity_based: 'high'
      },
      active_status: true
    });

    return NextResponse.json({
      alert: alertDefinition,
      message: 'Alert definition created successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating alert:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create alert' 
    }, { status: 500 });
  }
}

async function updateQuota(data: any) {
  try {
    const { business_id, quota_type, usage } = data;

    if (!business_id || !quota_type || usage === undefined) {
      return NextResponse.json({ 
        error: 'business_id, quota_type, and usage are required' 
      }, { status: 400 });
    }

    await monitoringSystem.updateUsageQuotas(business_id, quota_type, usage);

    return NextResponse.json({
      message: 'Quota updated successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating quota:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update quota' 
    }, { status: 500 });
  }
}

async function acknowledgeAlert(data: any) {
  try {
    const { alert_id, acknowledged_by } = data;

    if (!alert_id) {
      return NextResponse.json({ 
        error: 'alert_id is required' 
      }, { status: 400 });
    }

    // In a real implementation, this would update the alert in database
    console.log(`Alert ${alert_id} acknowledged by ${acknowledged_by || 'system'}`);

    return NextResponse.json({
      message: 'Alert acknowledged successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error acknowledging alert:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to acknowledge alert' 
    }, { status: 500 });
  }
}
