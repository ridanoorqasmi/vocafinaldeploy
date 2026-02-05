# Apply Sales Workspaces Migration
# This script applies the migration for sales_workspaces table

Write-Host "Applying Sales Workspaces Migration..." -ForegroundColor Cyan

# Step 1: Generate Prisma Client (to ensure types are up to date)
Write-Host "`nStep 1: Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

# Step 2: Apply the migration
Write-Host "`nStep 2: Applying migration..." -ForegroundColor Yellow
Write-Host "Note: If migration fails, you may need to run the SQL manually from:" -ForegroundColor Yellow
Write-Host "prisma/migrations/20250125000000_add_sales_workspaces/migration.sql" -ForegroundColor Yellow

# Try to apply migration
try {
    npx prisma migrate deploy
    Write-Host "`n✅ Migration applied successfully!" -ForegroundColor Green
} catch {
    Write-Host "`n⚠️  Migration deploy failed. You may need to run the SQL manually." -ForegroundColor Yellow
    Write-Host "Check the migration file: prisma/migrations/20250125000000_add_sales_workspaces/migration.sql" -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green
