# Script to resolve failed Prisma migration and apply playbooks migration
# This marks the failed sales_workspaces migration as applied (if tables exist) or rolled back

Write-Host "🔧 Resolving failed migration..." -ForegroundColor Yellow

# Step 1: Mark the failed migration as resolved
Write-Host "`nStep 1: Marking failed migration as applied..." -ForegroundColor Cyan
npx prisma migrate resolve --applied 20250125000000_add_sales_workspaces

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Could not mark as applied. Trying to mark as rolled back..." -ForegroundColor Yellow
    npx prisma migrate resolve --rolled-back 20250125000000_add_sales_workspaces
}

# Step 2: Apply all pending migrations (including playbooks)
Write-Host "`nStep 2: Applying pending migrations..." -ForegroundColor Cyan
npx prisma migrate deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Migrations applied successfully!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Regenerate Prisma client: npx prisma generate" -ForegroundColor White
    Write-Host "2. Restart your dev server" -ForegroundColor White
} else {
    Write-Host "`n❌ Migration failed. You may need to:" -ForegroundColor Red
    Write-Host "1. Check if the sales_workspaces tables exist" -ForegroundColor White
    Write-Host "2. Manually apply the migration SQL if needed" -ForegroundColor White
    Write-Host "3. Then run: npx prisma migrate resolve --applied 20250125000000_add_sales_workspaces" -ForegroundColor White
}
