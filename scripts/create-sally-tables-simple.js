/**
 * Create Sally Tables - Simple Version using pg library
 * 
 * This script creates the sally_sales_content and sally_companies tables
 * by executing the migration SQL file directly using pg library.
 * 
 * Usage: node scripts/create-sally-tables-simple.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function createTables() {
  // Get database URL from env or construct from individual vars
  let connectionConfig;
  
  if (process.env.DATABASE_URL) {
    connectionConfig = process.env.DATABASE_URL;
  } else {
    connectionConfig = {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'voca_order_taking',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || '',
    };
  }
  
  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('🗄️  Connected to database\n');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20250125000001_create_sally_sales_content', 'migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration SQL...\n');
    
    // Execute the entire SQL file (pg allows multiple statements)
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Tables created:');
    console.log('   - sally_companies');
    console.log('   - sally_sales_content');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: npx prisma generate');
    console.log('   2. Restart your dev server');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    
    // Some errors are expected (like "already exists")
    if (error.message && (
      error.message.includes('already exists') ||
      error.code === '42P07' || // duplicate_table
      error.code === '42710'   // duplicate_object
    )) {
      console.log('\n⚠️  Some objects already exist - this is normal if running multiple times');
      console.log('✅ Migration completed (idempotent)');
    } else {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

createTables();
