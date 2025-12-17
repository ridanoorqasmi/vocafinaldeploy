# Script to safely regenerate Prisma client
# This script handles the Windows file locking issue

Write-Host "🔧 Fixing Prisma Client Generation..." -ForegroundColor Cyan

# Check if dev server might be running
Write-Host "`n⚠️  Please stop your Next.js dev server (if running) before continuing..." -ForegroundColor Yellow
Write-Host "   Press Ctrl+C in the terminal where 'npm run dev' is running`n" -ForegroundColor Yellow

# Wait a moment
Start-Sleep -Seconds 2

# Try to remove the locked file
$prismaPath = "node_modules\.prisma"
if (Test-Path $prismaPath) {
    Write-Host "🗑️  Removing existing .prisma folder..." -ForegroundColor Yellow
    Remove-Item $prismaPath -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Generate Prisma client
Write-Host "`n🔨 Generating Prisma client..." -ForegroundColor Cyan
try {
    npx prisma generate
    Write-Host "`n✅ Prisma client generated successfully!" -ForegroundColor Green
    Write-Host "`nYou can now restart your dev server with: npm run dev" -ForegroundColor Green
} catch {
    Write-Host "`n❌ Error generating Prisma client:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`n💡 Solution: Make sure your dev server is stopped, then try again." -ForegroundColor Yellow
}

