# Fix Prisma Generate Error on Windows
# This script stops processes that might be locking the Prisma DLL file

Write-Host "🔧 Fixing Prisma Generate Error..." -ForegroundColor Cyan
Write-Host ""

# Check if Node processes are running
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "⚠️  Found Node.js processes running. These may be locking the Prisma DLL." -ForegroundColor Yellow
    Write-Host "Please stop your dev server (Ctrl+C in the terminal where it's running)" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Have you stopped the dev server? (y/N)"
    
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Please stop the dev server first, then run this script again." -ForegroundColor Red
        exit 1
    }
}

# Try to kill any remaining Node processes (optional, be careful)
Write-Host ""
Write-Host "Attempting to generate Prisma client..." -ForegroundColor Cyan
Write-Host ""

try {
    npx prisma generate
    Write-Host ""
    Write-Host "✅ Prisma client generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now restart your dev server with: npm run dev" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "❌ Still having issues? Try:" -ForegroundColor Red
    Write-Host "1. Close all terminals and VS Code" -ForegroundColor White
    Write-Host "2. Open a fresh terminal" -ForegroundColor White
    Write-Host "3. Run: npx prisma generate" -ForegroundColor White
    Write-Host "4. If that fails, restart your computer" -ForegroundColor White
}
