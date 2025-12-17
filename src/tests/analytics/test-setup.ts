import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

export async function setupAnalyticsDatabase() {
  console.log('🗄️  Setting up analytics database schema...');
  
  try {
    // Read the analytics schema file
    const schemaPath = path.join(process.cwd(), 'database', 'phase4c-analytics-schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error('Analytics schema file not found. Please ensure database/phase4c-analytics-schema.sql exists.');
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (error) {
          // Ignore errors for statements that might already exist
          if (!error.message.includes('already exists') && 
              !error.message.includes('relation') && 
              !error.message.includes('duplicate')) {
            console.warn(`Warning: ${error.message}`);
          }
        }
      }
    }
    
    console.log('✅ Analytics database schema setup completed');
    
  } catch (error) {
    console.error('❌ Failed to setup analytics database:', error);
    throw error;
  }
}

export async function cleanupAnalyticsDatabase() {
  console.log('🧹 Cleaning up analytics database...');
  
  try {
    // Clean up test data in reverse order of dependencies
    const cleanupQueries = [
      'DELETE FROM business_alerts WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE \'%Test%\')',
      'DELETE FROM business_insights WHERE insight_data::text LIKE \'%Test%\'',
      'DELETE FROM customer_predictions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE \'%Test%\')',
      'DELETE FROM expansion_opportunities WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE \'%Test%\')',
      'DELETE FROM customer_ltv_metrics WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE \'%Test%\')',
      'DELETE FROM churn_analysis WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE \'%Test%\')',
      'DELETE FROM payment_history WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE \'%Test%\')',
      'DELETE FROM query_logs WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE \'%Test%\')',
      'DELETE FROM subscriptions WHERE business_id IN (SELECT id FROM businesses WHERE name LIKE \'%Test%\')',
      'DELETE FROM businesses WHERE name LIKE \'%Test%\''
    ];
    
    for (const query of cleanupQueries) {
      try {
        await prisma.$executeRawUnsafe(query);
      } catch (error) {
        // Ignore errors for tables that might not exist
        console.warn(`Warning during cleanup: ${error.message}`);
      }
    }
    
    console.log('✅ Analytics database cleanup completed');
    
  } catch (error) {
    console.error('❌ Failed to cleanup analytics database:', error);
    throw error;
  }
}

export async function verifyAnalyticsTables() {
  console.log('🔍 Verifying analytics tables...');
  
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
  
  const missingTables = [];
  
  for (const table of requiredTables) {
    try {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = ${table}
        ) as exists
      `;
      
      if (!result[0].exists) {
        missingTables.push(table);
      }
    } catch (error) {
      missingTables.push(table);
    }
  }
  
  if (missingTables.length > 0) {
    throw new Error(`Missing analytics tables: ${missingTables.join(', ')}`);
  }
  
  console.log('✅ All analytics tables verified');
}

export async function createTestPlanDefinitions() {
  console.log('📋 Creating test plan definitions...');
  
  try {
    await prisma.$executeRaw`
      INSERT INTO plan_definitions (id, name, description, price_cents, currency, billing_interval, trial_days, display_order)
      VALUES 
        ('free', 'Free Plan', 'Free tier', 0, 'usd', 'month', 14, 1),
        ('starter', 'Starter Plan', 'Starter tier', 2900, 'usd', 'month', 14, 2),
        ('pro', 'Professional Plan', 'Pro tier', 9900, 'usd', 'month', 14, 3),
        ('business', 'Business Plan', 'Business tier', 29900, 'usd', 'month', 14, 4)
      ON CONFLICT (id) DO NOTHING
    `;
    
    console.log('✅ Test plan definitions created');
    
  } catch (error) {
    console.error('❌ Failed to create test plan definitions:', error);
    throw error;
  }
}

export async function setupTestEnvironment() {
  console.log('🚀 Setting up test environment...');
  
  try {
    // 1. Setup analytics database schema
    await setupAnalyticsDatabase();
    
    // 2. Verify tables exist
    await verifyAnalyticsTables();
    
    // 3. Create test plan definitions
    await createTestPlanDefinitions();
    
    console.log('✅ Test environment setup completed');
    
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
}

export async function teardownTestEnvironment() {
  console.log('🧹 Tearing down test environment...');
  
  try {
    // Clean up test data
    await cleanupAnalyticsDatabase();
    
    console.log('✅ Test environment teardown completed');
    
  } catch (error) {
    console.error('❌ Failed to teardown test environment:', error);
    throw error;
  }
}

export { prisma };
