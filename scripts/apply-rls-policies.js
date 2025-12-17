const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function applyRLSPolicies() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔐 Applying RLS policies...');
    
    // Read the RLS policies file
    const rlsFilePath = path.join(__dirname, '..', 'database', 'rls-policies.sql');
    const sql = fs.readFileSync(rlsFilePath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
        } catch (error) {
          // Some statements might fail if they already exist, which is okay
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('already enabled')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message.split('\n')[0]}`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ RLS policies applied successfully');
    
  } catch (error) {
    console.error('❌ Error applying RLS policies:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyRLSPolicies()
  .then(() => {
    console.log('🎉 RLS setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 RLS setup failed:', error);
    process.exit(1);
  });
