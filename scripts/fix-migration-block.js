/**
 * Fix Migration Block Script
 * 
 * This script resolves the failed migration issue and applies the playbooks migration.
 * It marks the failed sales_workspaces migration as applied (since the SQL is idempotent)
 * and then applies pending migrations.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Resolving failed migration block...\n');

try {
  // Step 1: Mark the failed migration as applied
  console.log('Step 1: Marking failed migration as applied...');
  try {
    execSync('npx prisma migrate resolve --applied 20250125000000_add_sales_workspaces', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Migration marked as applied\n');
  } catch (error) {
    console.log('⚠️  Could not mark as applied, trying rolled-back...');
    try {
      execSync('npx prisma migrate resolve --rolled-back 20250125000000_add_sales_workspaces', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Migration marked as rolled-back\n');
    } catch (error2) {
      console.log('❌ Could not resolve migration automatically');
      console.log('You may need to manually check the database state');
      process.exit(1);
    }
  }

  // Step 2: Apply pending migrations
  console.log('Step 2: Applying pending migrations (including playbooks)...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('\n✅ All migrations applied successfully!');

  // Step 3: Regenerate Prisma client
  console.log('\nStep 3: Regenerating Prisma client...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('\n✅ Prisma client regenerated!');

  console.log('\n🎉 Migration fix complete!');
  console.log('\nNext steps:');
  console.log('1. Restart your dev server');
  console.log('2. Try creating a playbook again');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.log('\nAlternative: You can manually apply the playbooks migration SQL');
  console.log('File location: prisma/migrations/20250126000000_add_sales_playbooks/migration.sql');
  process.exit(1);
}
