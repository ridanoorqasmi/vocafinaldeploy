# Fix Sales Workspaces - Regenerate Prisma Client
# This script helps regenerate the Prisma client after adding the sales_workspaces model

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Sales Workspaces - Prisma Client Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  IMPORTANT: Stop your dev server first (Ctrl+C)" -ForegroundColor Yellow
Write-Host ""
$continue = Read-Host "Have you stopped the dev server? (y/n)"

if ($continue -ne "y" -and $continue -ne "Y") {
    Write-Host "Please stop the dev server first, then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 1: Regenerating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Prisma client regenerated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Step 2: Verifying sales_workspaces model..." -ForegroundColor Yellow
    
    # Check if the model exists in the generated client
    $clientPath = "node_modules\.prisma\client\index.d.ts"
    if (Test-Path $clientPath) {
        $content = Get-Content $clientPath -Raw
        if ($content -match "sales_workspaces") {
            Write-Host "✅ sales_workspaces model found in Prisma client!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  sales_workspaces model NOT found in Prisma client!" -ForegroundColor Yellow
            Write-Host "   This might indicate a schema issue." -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "✅ Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Restart your dev server: npm run dev" -ForegroundColor White
    Write-Host "2. Generate a sales script" -ForegroundColor White
    Write-Host "3. Check if workspace appears in the left panel" -ForegroundColor White
    Write-Host "4. Check server console for workspace creation logs" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Failed to regenerate Prisma client!" -ForegroundColor Red
    Write-Host "   Make sure:" -ForegroundColor Yellow
    Write-Host "   - Dev server is stopped" -ForegroundColor Yellow
    Write-Host "   - Database connection is working" -ForegroundColor Yellow
    Write-Host "   - Prisma schema is valid" -ForegroundColor Yellow
}
