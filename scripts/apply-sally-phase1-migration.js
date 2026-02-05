/**
 * Safe Migration Script for Sally Phase 1 Fields
 * 
 * This script safely applies the Phase 1 migration without using shadow database.
 * It only adds nullable columns, so it's completely safe for existing data.
 * 
 * Usage: node scripts/apply-sally-phase1-migration.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🗄️  Applying Sally Phase 1 Migration...\n');
    console.log('✅ This migration is SAFE - only adds nullable columns\n');
    
    // First, check if the table exists
    try {
      const tableCheck = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sally_sales_content'
        );
      `;
      const tableExists = tableCheck[0]?.exists;
      
      if (!tableExists) {
        console.log('⚠️  Table "sally_sales_content" does not exist yet.');
        console.log('📝 This is safe - the table will be created when you run the initial Sally migrations.');
        console.log('💡 You can skip this migration for now, or create the table first.\n');
        console.log('✅ Migration skipped (table does not exist - this is safe)');
        return;
      }
      
      console.log('✅ Table "sally_sales_content" exists - proceeding with migration\n');
    } catch (checkError) {
      console.log('⚠️  Could not check table existence, proceeding anyway...\n');
    }
    
    // Extract ALTER TABLE statements directly (safe approach)
    const statements = [
      `ALTER TABLE "sally_sales_content" ADD COLUMN IF NOT EXISTS "mode" TEXT;`,
      `ALTER TABLE "sally_sales_content" ADD COLUMN IF NOT EXISTS "selectedAssets" JSONB;`,
      `ALTER TABLE "sally_sales_content" ADD COLUMN IF NOT EXISTS "advancedInputs" JSONB;`
    ];
    
    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          successCount++;
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Ignore errors for columns that might already exist (idempotent)
          if (errorMessage.includes('already exists') || 
              errorMessage.includes('duplicate column') ||
              (errorMessage.includes('column') && errorMessage.includes('of relation') && errorMessage.includes('already exists'))) {
            console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (column already exists - safe to ignore)`);
            successCount++;
          } else if (errorMessage.includes('does not exist') && errorMessage.includes('relation')) {
            console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (table does not exist - safe to ignore)`);
            console.log(`💡 The table will be created when you apply the initial Sally migrations.`);
            successCount++; // Count as success since it's safe
          } else {
            console.log(`❌ Statement ${i + 1}/${statements.length} failed: ${errorMessage}`);
            errorCount++;
          }
        }
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('📝 Next step: Run `npx prisma generate` to update Prisma client');
    } else {
      console.log('\n⚠️  Some statements failed. Please review the errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
applyMigration();
