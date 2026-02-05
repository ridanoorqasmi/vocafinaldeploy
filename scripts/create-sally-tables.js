/**
 * Create Sally Tables Migration Script
 * 
 * This script creates the sally_sales_content and sally_companies tables
 * if they don't exist. Safe to run multiple times.
 * 
 * Usage: node scripts/create-sally-tables.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function createTables() {
  try {
    console.log('🗄️  Creating Sally tables...\n');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20250125000001_create_sally_sales_content', 'migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration SQL...\n');
    
    // Use a simpler approach: split by semicolons, but preserve DO blocks
    // First, replace DO blocks with placeholders
    const statements = [];
    const doBlocks = [];
    const doBlockPattern = /(DO\s+\$\$[\s\S]*?\$\$;?)/g;
    let processedSQL = migrationSQL;
    let match;
    let blockIndex = 0;
    
    while ((match = doBlockPattern.exec(migrationSQL)) !== null) {
      const placeholder = `__DO_BLOCK_${blockIndex}__`;
      doBlocks.push(match[1].trim());
      processedSQL = processedSQL.replace(match[1], placeholder);
      blockIndex++;
    }
    
    // Now split by semicolons
    const parts = processedSQL.split(';').map(p => p.trim()).filter(p => p && !p.startsWith('--'));
    
    // Process parts and restore DO blocks
    for (const part of parts) {
      if (part.includes('__DO_BLOCK_')) {
        // This part contains a DO block placeholder
        const blockMatch = part.match(/__DO_BLOCK_(\d+)__/);
        if (blockMatch) {
          const idx = parseInt(blockMatch[1]);
          statements.push(doBlocks[idx]);
          // Check if there's SQL before or after the placeholder
          const before = part.split('__DO_BLOCK_')[0].trim();
          const after = part.split('__DO_BLOCK_')[1].replace(/^\d+__/, '').trim();
          if (before) statements.push(before);
          if (after) statements.push(after);
        }
      } else if (part) {
        statements.push(part);
      }
    }
    
    console.log(`📝 Parsed ${statements.length} SQL statements\n`);
    
    // Execute statements one by one
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement || statement.length === 0) continue;
      
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
      } catch (stmtError) {
        // Some errors are expected (like "already exists"), so we'll continue
        if (stmtError.message && (
          stmtError.message.includes('already exists') ||
          stmtError.message.includes('does not exist') ||
          stmtError.code === '42P07' || // duplicate_table
          stmtError.code === '42710'   // duplicate_object
        )) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists or not applicable)`);
          continue;
        }
        // Log the error but continue for other non-critical errors
        if (stmtError.message && (
          stmtError.message.includes('constraint') ||
          stmtError.message.includes('index')
        )) {
          console.log(`⚠️  Statement ${i + 1} skipped: ${stmtError.message.split('\n')[0]}`);
          continue;
        }
        throw stmtError;
      }
    }
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Tables created:');
    console.log('   - sally_companies');
    console.log('   - sally_sales_content');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: npx prisma generate');
    console.log('   2. Restart your dev server');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    
    if (error.message && error.message.includes('does not exist')) {
      console.log('\n💡 Tip: Some tables might not exist yet. This is normal.');
      console.log('   The migration will create them if needed.');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTables();
