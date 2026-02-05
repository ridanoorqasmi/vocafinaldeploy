# Quick Fix for Failed Migration

## Problem
The `20250125000000_add_sales_workspaces` migration failed and is blocking the new playbooks migration.

## Solution (Run these commands in PowerShell)

### Step 1: Mark the failed migration as resolved
```powershell
npx prisma migrate resolve --applied 20250125000000_add_sales_workspaces
```

If that doesn't work, try:
```powershell
npx prisma migrate resolve --rolled-back 20250125000000_add_sales_workspaces
```

### Step 2: Apply pending migrations (including playbooks)
```powershell
npx prisma migrate deploy
```

### Step 3: Regenerate Prisma client
```powershell
npx prisma generate
```

### Step 4: Restart your dev server
Stop your dev server (Ctrl+C) and restart it:
```powershell
npm run dev
```

## Alternative: Manual SQL Application

If the above doesn't work, you can manually apply the playbooks migration SQL:

1. Open your PostgreSQL client (pgAdmin, DBeaver, or psql)
2. Connect to database: `voca_order_taking`
3. Run the SQL from: `prisma/migrations/20250126000000_add_sales_playbooks/migration.sql`
4. Then mark migrations as applied:
   ```powershell
   npx prisma migrate resolve --applied 20250125000000_add_sales_workspaces
   npx prisma migrate resolve --applied 20250126000000_add_sales_playbooks
   npx prisma generate
   ```

## Why This Works

The `sales_workspaces` migration SQL is idempotent (uses `CREATE TABLE IF NOT EXISTS`), so it's safe to mark it as applied even if it partially failed. The playbooks migration will then apply normally.
