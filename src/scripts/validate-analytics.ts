#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { revenueAnalyticsEngine } from '../services/analytics/revenue-analytics-engine';
import { predictiveAnalyticsModels } from '../services/analytics/predictive-models';
import { insightsEngine } from '../services/analytics/insights-engine';
import { analyticsService } from '../services/analytics/analytics-service';

const prisma = new PrismaClient();

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

async function validateAnalyticsSystem(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  console.log('🔍 Validating Phase 4C Analytics System...\n');

  // 1. Database Schema Validation
  results.push(...await validateDatabaseSchema());

  // 2. Revenue Analytics Engine Validation
  results.push(...await validateRevenueAnalyticsEngine());

  // 3. Predictive Models Validation
  results.push(...await validatePredictiveModels());

  // 4. Insights Engine Validation
  results.push(...await validateInsightsEngine());

  // 5. Analytics Service Validation
  results.push(...await validateAnalyticsService());

  // 6. Performance Validation
  results.push(...await validatePerformance());

  return results;
}

async function validateDatabaseSchema(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Check if analytics tables exist
    const requiredTables = [
      'mrr_snapshots',
      'customer_ltv_metrics',
      'revenue_cohorts',
      'churn_analysis',
      'cac_metrics',
      'plan_analytics',
      'financial_reports',
      'revenue_forecasts',
      'customer_predictions',
      'expansion_opportunities',
      'customer_health_scores',
      'business_insights',
      'business_alerts'
    ];

    for (const table of requiredTables) {
      const exists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = ${table}
        ) as exists
      `;

      if (exists[0].exists) {
        results.push({
          component: 'Database Schema',
          status: 'pass',
          message: `Table ${table} exists`
        });
      } else {
        results.push({
          component: 'Database Schema',
          status: 'fail',
          message: `Table ${table} missing`
        });
      }
    }

    // Check indexes
    const indexes = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as index_count
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND (tablename LIKE '%analytics%' 
           OR tablename IN (
             'mrr_snapshots', 'customer_ltv_metrics', 'revenue_cohorts',
             'churn_analysis', 'cac_metrics', 'plan_analytics',
             'financial_reports', 'revenue_forecasts', 'customer_predictions',
             'expansion_opportunities', 'customer_health_scores',
             'business_insights', 'business_alerts'
           ))
    `;

    if (indexes[0].index_count > 0) {
      results.push({
        component: 'Database Schema',
        status: 'pass',
        message: `Found ${indexes[0].index_count} indexes for analytics tables`
      });
    } else {
      results.push({
        component: 'Database Schema',
        status: 'warning',
        message: 'No indexes found for analytics tables'
      });
    }

  } catch (error) {
    results.push({
      component: 'Database Schema',
      status: 'fail',
      message: `Database schema validation failed: ${error.message}`
    });
  }

  return results;
}

async function validateRevenueAnalyticsEngine(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Test MRR calculation
    const mrrData = await revenueAnalyticsEngine.calculateMRRForDate(new Date());
    
    if (typeof mrrData.total_mrr_cents === 'number' && mrrData.total_mrr_cents >= 0) {
      results.push({
        component: 'Revenue Analytics Engine',
        status: 'pass',
        message: 'MRR calculation working correctly'
      });
    } else {
      results.push({
        component: 'Revenue Analytics Engine',
        status: 'fail',
        message: 'MRR calculation returned invalid data'
      });
    }

    // Test cohort analysis
    const cohortData = await revenueAnalyticsEngine.performCohortAnalysis('revenue');
    
    if (Array.isArray(cohortData)) {
      results.push({
        component: 'Revenue Analytics Engine',
        status: 'pass',
        message: 'Cohort analysis working correctly'
      });
    } else {
      results.push({
        component: 'Revenue Analytics Engine',
        status: 'fail',
        message: 'Cohort analysis returned invalid data'
      });
    }

  } catch (error) {
    results.push({
      component: 'Revenue Analytics Engine',
      status: 'fail',
      message: `Revenue analytics engine validation failed: ${error.message}`
    });
  }

  return results;
}

async function validatePredictiveModels(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Test revenue forecasting
    const forecast = await predictiveAnalyticsModels.forecastRevenue(12);
    
    if (forecast.predicted_mrr_cents >= 0 && forecast.confidence_score >= 0 && forecast.confidence_score <= 1) {
      results.push({
        component: 'Predictive Models',
        status: 'pass',
        message: 'Revenue forecasting working correctly'
      });
    } else {
      results.push({
        component: 'Predictive Models',
        status: 'fail',
        message: 'Revenue forecasting returned invalid data'
      });
    }

    // Test insights generation
    const insights = await insightsEngine.generateBusinessInsights();
    
    if (Array.isArray(insights)) {
      results.push({
        component: 'Predictive Models',
        status: 'pass',
        message: `Generated ${insights.length} business insights`
      });
    } else {
      results.push({
        component: 'Predictive Models',
        status: 'fail',
        message: 'Insights generation returned invalid data'
      });
    }

  } catch (error) {
    results.push({
      component: 'Predictive Models',
      status: 'fail',
      message: `Predictive models validation failed: ${error.message}`
    });
  }

  return results;
}

async function validateInsightsEngine(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Test insights generation
    const insights = await insightsEngine.generateBusinessInsights();
    
    if (Array.isArray(insights)) {
      const validInsights = insights.filter(insight => 
        insight.insight_type && 
        insight.insight_category && 
        insight.title && 
        insight.description &&
        insight.impact_score >= 0 &&
        insight.impact_score <= 100
      );

      if (validInsights.length === insights.length) {
        results.push({
          component: 'Insights Engine',
          status: 'pass',
          message: `Generated ${insights.length} valid business insights`
        });
      } else {
        results.push({
          component: 'Insights Engine',
          status: 'warning',
          message: `Generated ${insights.length} insights, ${validInsights.length} valid`
        });
      }
    } else {
      results.push({
        component: 'Insights Engine',
        status: 'fail',
        message: 'Insights generation returned invalid data'
      });
    }

    // Test alerts generation
    const alerts = await insightsEngine.generateBusinessAlerts();
    
    if (Array.isArray(alerts)) {
      const validAlerts = alerts.filter(alert => 
        alert.alert_type && 
        alert.alert_category && 
        alert.severity && 
        alert.title && 
        alert.message
      );

      if (validAlerts.length === alerts.length) {
        results.push({
          component: 'Insights Engine',
          status: 'pass',
          message: `Generated ${alerts.length} valid business alerts`
        });
      } else {
        results.push({
          component: 'Insights Engine',
          status: 'warning',
          message: `Generated ${alerts.length} alerts, ${validAlerts.length} valid`
        });
      }
    } else {
      results.push({
        component: 'Insights Engine',
        status: 'fail',
        message: 'Alerts generation returned invalid data'
      });
    }

  } catch (error) {
    results.push({
      component: 'Insights Engine',
      status: 'fail',
      message: `Insights engine validation failed: ${error.message}`
    });
  }

  return results;
}

async function validateAnalyticsService(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Test dashboard data
    const dashboardData = await analyticsService.getDashboardData();
    
    if (dashboardData && 
        dashboardData.revenue_overview && 
        dashboardData.customer_health && 
        dashboardData.financial_reports &&
        Array.isArray(dashboardData.insights) &&
        Array.isArray(dashboardData.alerts)) {
      results.push({
        component: 'Analytics Service',
        status: 'pass',
        message: 'Dashboard data generation working correctly'
      });
    } else {
      results.push({
        component: 'Analytics Service',
        status: 'fail',
        message: 'Dashboard data generation returned invalid data'
      });
    }

    // Test performance metrics
    const performance = await analyticsService.getAnalyticsPerformance();
    
    if (performance && 
        performance.processing_times && 
        performance.data_freshness && 
        performance.accuracy_metrics &&
        performance.system_health) {
      results.push({
        component: 'Analytics Service',
        status: 'pass',
        message: 'Performance metrics generation working correctly'
      });
    } else {
      results.push({
        component: 'Analytics Service',
        status: 'fail',
        message: 'Performance metrics generation returned invalid data'
      });
    }

  } catch (error) {
    results.push({
      component: 'Analytics Service',
      status: 'fail',
      message: `Analytics service validation failed: ${error.message}`
    });
  }

  return results;
}

async function validatePerformance(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Test MRR calculation performance
    const startTime = Date.now();
    await revenueAnalyticsEngine.calculateMRRForDate(new Date());
    const mrrTime = Date.now() - startTime;

    if (mrrTime < 5000) {
      results.push({
        component: 'Performance',
        status: 'pass',
        message: `MRR calculation completed in ${mrrTime}ms (target: <5000ms)`
      });
    } else {
      results.push({
        component: 'Performance',
        status: 'warning',
        message: `MRR calculation took ${mrrTime}ms (target: <5000ms)`
      });
    }

    // Test insights generation performance
    const insightsStartTime = Date.now();
    await insightsEngine.generateBusinessInsights();
    const insightsTime = Date.now() - insightsStartTime;

    if (insightsTime < 30000) {
      results.push({
        component: 'Performance',
        status: 'pass',
        message: `Insights generation completed in ${insightsTime}ms (target: <30000ms)`
      });
    } else {
      results.push({
        component: 'Performance',
        status: 'warning',
        message: `Insights generation took ${insightsTime}ms (target: <30000ms)`
      });
    }

  } catch (error) {
    results.push({
      component: 'Performance',
      status: 'fail',
      message: `Performance validation failed: ${error.message}`
    });
  }

  return results;
}

async function main() {
  try {
    const results = await validateAnalyticsSystem();

    console.log('\n📊 Validation Results:');
    console.log('='.repeat(50));

    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const failed = results.filter(r => r.status === 'fail').length;

    results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${result.component}: ${result.message}`);
    });

    console.log('\n📈 Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed === 0) {
      console.log('\n🎉 All validations passed! Phase 4C Analytics System is ready.');
      process.exit(0);
    } else {
      console.log('\n❌ Some validations failed. Please fix the issues before deployment.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
