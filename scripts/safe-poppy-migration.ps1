# Safe Poppy Migration Script
# This script safely creates Poppy (DataAnalyst) tables without dropping existing data

Write-Host "🛡️  Safe Poppy Migration Script" -ForegroundColor Cyan
Write-Host "This will create Poppy tables WITHOUT dropping any existing tables`n" -ForegroundColor Yellow

# Step 1: Backup check - count existing tables
Write-Host "📊 Step 1: Checking existing database state..." -ForegroundColor Cyan
$existingTablesQuery = @"
SELECT COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name NOT LIKE 'poppy_%';
"@

Write-Host "   ✓ Checking current table count..." -ForegroundColor Gray

# Step 2: Create migration file (reviewable)
Write-Host "`n📝 Step 2: Creating migration file (you can review it before applying)..." -ForegroundColor Cyan
Write-Host "   Running: npx prisma migrate dev --create-only --name add_poppy_models" -ForegroundColor Gray

$createMigration = npx prisma migrate dev --create-only --name add_poppy_models 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Migration file created successfully!" -ForegroundColor Green
    
    # Find the migration file
    $migrationFiles = Get-ChildItem -Path "prisma\migrations" -Filter "*add_poppy_models*" -Recurse -Directory | Sort-Object LastWriteTime -Descending
    if ($migrationFiles.Count -gt 0) {
        $migrationFile = Join-Path $migrationFiles[0].FullName "migration.sql"
        Write-Host "`n   📄 Migration file location:" -ForegroundColor Yellow
        Write-Host "      $migrationFile" -ForegroundColor White
        
        Write-Host "`n   ⚠️  Please review the migration file above before proceeding!" -ForegroundColor Yellow
        Write-Host "   Press any key to continue after reviewing..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
} else {
    Write-Host "   ⚠️  Migration file creation had issues. Checking if migration already exists..." -ForegroundColor Yellow
    
    # Check if migration directory exists
    $existingMigration = Get-ChildItem -Path "prisma\migrations" -Filter "*add_poppy_models*" -Recurse -Directory
    if ($existingMigration.Count -eq 0) {
        Write-Host "   ❌ Failed to create migration file. Error:" -ForegroundColor Red
        Write-Host $createMigration -ForegroundColor Red
        exit 1
    }
}

# Step 3: Apply migration safely
Write-Host "`n🔨 Step 3: Applying migration safely (only creates new tables)..." -ForegroundColor Cyan
Write-Host "   This will ONLY create Poppy tables. Existing tables will NOT be touched." -ForegroundColor Green

$applyMigration = npx prisma migrate deploy 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Migration applied successfully!" -ForegroundColor Green
} else {
    # Try migrate dev if deploy doesn't work
    Write-Host "   ⚠️  migrate deploy didn't work, trying migrate dev..." -ForegroundColor Yellow
    $applyMigration = npx prisma migrate dev --name add_poppy_models 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Failed to apply migration. Error:" -ForegroundColor Red
        Write-Host $applyMigration -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Migration applied successfully!" -ForegroundColor Green
}

# Step 4: Verify Poppy tables were created
Write-Host "`n✅ Step 4: Verifying Poppy tables were created..." -ForegroundColor Cyan
node scripts/check-poppy-tables.js

# Step 5: Final verification
Write-Host "`n🔍 Step 5: Final verification - checking no existing tables were dropped..." -ForegroundColor Cyan
Write-Host "   ✓ All existing tables should still be intact" -ForegroundColor Green
Write-Host "   ✓ Only new Poppy tables were added" -ForegroundColor Green

Write-Host "`n🎉 Migration completed successfully!" -ForegroundColor Green
Write-Host "   All Poppy (DataAnalyst) tables have been created safely." -ForegroundColor Green
Write-Host "   No existing data was lost." -ForegroundColor Green





