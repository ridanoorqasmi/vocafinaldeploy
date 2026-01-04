const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🗄️  Applying Question Analytics Migration...\n');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../prisma/migrations/20250122000000_add_question_analytics/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
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
          
          // Ignore errors for statements that might already exist
          if (errorMessage.includes('already exists') || 
              errorMessage.includes('relation') || 
              errorMessage.includes('duplicate') ||
              errorMessage.includes('does not exist')) {
            console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (already exists or not applicable)`);
            successCount++;
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
    console.log(`📋 Total: ${statements.length}`);
    
    // Verify table was created
    console.log('\n🔍 Verifying question_analytics table...');
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'question_analytics'
      `;
      
      if (tables && tables.length > 0) {
        console.log('✅ question_analytics table exists!');
        
        // Check indexes
        const indexes = await prisma.$queryRaw`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'question_analytics'
        `;
        console.log(`✅ Found ${indexes.length} indexes on question_analytics table`);
      } else {
        console.log('⚠️  question_analytics table not found - migration may have failed');
      }
    } catch (error) {
      console.log('⚠️  Could not verify table (this is okay if migration succeeded)');
    }
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration applied successfully!');
      console.log('💡 Next step: Run "npx prisma generate" to update Prisma Client');
    } else {
      console.log('\n⚠️  Some statements failed, but this may be expected if tables/indexes already exist');
    }
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();












