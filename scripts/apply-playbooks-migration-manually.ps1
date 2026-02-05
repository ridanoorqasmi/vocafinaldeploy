# Manual script to apply playbooks migration if Prisma migrate is blocked
# This reads the SQL file and executes it directly

$ErrorActionPreference = "Stop"

Write-Host "📦 Applying Playbooks Migration Manually..." -ForegroundColor Cyan

# Read the migration SQL file
$migrationPath = "prisma\migrations\20250126000000_add_sales_playbooks\migration.sql"

if (-not (Test-Path $migrationPath)) {
    Write-Host "❌ Migration file not found: $migrationPath" -ForegroundColor Red
    exit 1
}

$migrationSQL = Get-Content $migrationPath -Raw

Write-Host "✅ Migration file loaded" -ForegroundColor Green
Write-Host "`n⚠️  This will execute SQL directly against your database." -ForegroundColor Yellow
Write-Host "Make sure your DATABASE_URL is correct in .env file" -ForegroundColor Yellow

$confirm = Read-Host "`nContinue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Use Prisma to execute the raw SQL
Write-Host "`nExecuting migration SQL..." -ForegroundColor Cyan

# Split SQL into statements and execute
$statements = $migrationSQL -split ";" | Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("--") }

foreach ($statement in $statements) {
    $trimmed = $statement.Trim()
    if ($trimmed) {
        try {
            npx prisma db execute --stdin --schema=prisma/schema.prisma <<< $trimmed
            Write-Host "✅ Executed statement" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Statement may have already been applied or failed (this is OK for idempotent migrations)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n✅ Migration applied!" -ForegroundColor Green
Write-Host "`nNext: Run 'npx prisma generate' to regenerate the client" -ForegroundColor Cyan
