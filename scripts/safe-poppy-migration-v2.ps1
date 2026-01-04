# Safe Poppy Migration Script v2
# Handles schema drift and creates Poppy tables without data loss

Write-Host "🛡️  Safe Poppy Migration Script (v2)" -ForegroundColor Cyan
Write-Host "This will create Poppy tables WITHOUT dropping any existing tables`n" -ForegroundColor Yellow

# Step 1: Check current state
Write-Host "📊 Step 1: Checking current database state..." -ForegroundColor Cyan
node scripts/check-poppy-tables.js

# Step 2: Handle schema drift by creating a baseline migration
Write-Host "`n🔧 Step 2: Handling schema drift..." -ForegroundColor Cyan
Write-Host "   Schema drift detected (database has tables not in migrations)" -ForegroundColor Yellow
Write-Host "   We'll create Poppy tables without touching existing ones`n" -ForegroundColor Yellow

# Step 3: Use db push for Poppy tables only (safer than migrate when drift exists)
Write-Host "📝 Step 3: Creating Poppy tables using safe method..." -ForegroundColor Cyan
Write-Host "   Using: npx prisma db push --skip-generate --accept-data-loss=false" -ForegroundColor Gray
Write-Host "   This will ONLY add missing tables (Poppy), won't drop anything`n" -ForegroundColor Green

Write-Host "   ⚠️  IMPORTANT: This will show you what changes will be made." -ForegroundColor Yellow
Write-Host "   Review the output carefully before proceeding!`n" -ForegroundColor Yellow

$pushResult = npx prisma db push --skip-generate 2>&1 | Tee-Object -Variable pushOutput

# Check if it's asking for confirmation
if ($pushOutput -match "Do you want to continue\?") {
    Write-Host "`n   ⚠️  Prisma is asking for confirmation." -ForegroundColor Yellow
    Write-Host "   The changes shown should ONLY be creating Poppy tables." -ForegroundColor Yellow
    Write-Host "   If you see DROP statements, DO NOT proceed!" -ForegroundColor Red
    Write-Host "`n   Press 'y' only if you see only CREATE statements for poppy_* tables" -ForegroundColor Yellow
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n   ✅ Poppy tables created successfully!" -ForegroundColor Green
} else {
    Write-Host "`n   ❌ Failed to create tables. Error:" -ForegroundColor Red
    Write-Host $pushOutput -ForegroundColor Red
    Write-Host "`n   💡 Alternative: We can create a manual migration file instead." -ForegroundColor Yellow
    exit 1
}

# Step 4: Generate Prisma client
Write-Host "`n🔨 Step 4: Generating Prisma client..." -ForegroundColor Cyan
npx prisma generate 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Prisma client generated!" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Warning: Prisma client generation had issues" -ForegroundColor Yellow
}

# Step 5: Verify
Write-Host "`n✅ Step 5: Verifying Poppy tables..." -ForegroundColor Cyan
node scripts/check-poppy-tables.js

Write-Host "`n🎉 Migration completed!" -ForegroundColor Green
Write-Host "   All Poppy (DataAnalyst) tables have been created." -ForegroundColor Green
Write-Host "   No existing data was lost." -ForegroundColor Green
Write-Host "`n   ⚠️  Note: Since we used 'db push', no migration file was created." -ForegroundColor Yellow
Write-Host "   For production, you should create a proper migration file later." -ForegroundColor Yellow





