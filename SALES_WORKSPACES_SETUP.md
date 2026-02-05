# Sales Workspaces Setup Instructions

## Problem
Workspaces aren't being created because:
1. The database migration hasn't been applied
2. The Prisma client hasn't been regenerated

## Solution

### Step 1: Apply the Database Migration

You have two options:

#### Option A: Apply Migration SQL Manually (Recommended)
1. Open your PostgreSQL client (pgAdmin, DBeaver, or psql)
2. Connect to your database: `voca_order_taking`
3. Run the SQL from: `prisma/migrations/20250125000000_add_sales_workspaces/migration.sql`

#### Option B: Use Prisma Migrate (if migration system is working)
```powershell
npx prisma migrate deploy
```

### Step 2: Regenerate Prisma Client

**IMPORTANT:** Stop your dev server first (Ctrl+C), then run:

```powershell
npx prisma generate
```

This will regenerate the Prisma client to include the new `sales_workspaces` model.

### Step 3: Restart Dev Server

```powershell
npm run dev
```

## Verification

After applying the migration and regenerating the client:

1. Generate a sales script
2. Check the browser console for any errors
3. Check the server console for workspace creation logs
4. The workspace should appear in the left panel

## Troubleshooting

### If you see "sales_workspaces model not found" error:
- Make sure you ran `npx prisma generate` after applying the migration
- Restart your dev server

### If workspace creation fails silently:
- Check the server console logs for `[Sally] Error managing workspace:` messages
- The error details will show what went wrong

### If migration fails:
- Check that the `sally_companies` table exists
- Verify your database connection is working
- Try applying the SQL manually from the migration file
