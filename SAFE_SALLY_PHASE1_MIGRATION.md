# Safe Sally Phase 1 Migration Guide

## ✅ Migration Safety Guarantee

This migration is **100% safe** and **additive-only**:
- ✅ Only adds 3 nullable columns to `sally_sales_content` table
- ✅ **NO existing data is modified or deleted**
- ✅ **NO existing tables are dropped or altered**
- ✅ **NO constraints are added that could affect existing data**
- ✅ All columns are nullable, so existing rows are unaffected

## 📋 What This Migration Does

Adds three new nullable columns to the `sally_sales_content` table:
1. `mode` (TEXT, nullable) - Stores 'quick' or 'advanced' mode
2. `selectedAssets` (JSONB, nullable) - Stores asset selection preferences
3. `advancedInputs` (JSONB, nullable) - Stores advanced field values

## 🚀 How to Apply (Choose One Method)

### Method 1: Using the Safe Migration Script (Recommended)

```powershell
# Stop your dev server first (Ctrl+C)
node scripts/apply-sally-phase1-migration.js
npx prisma generate
```

This script:
- ✅ Applies the migration safely
- ✅ Handles errors gracefully (idempotent)
- ✅ Doesn't use shadow database
- ✅ Won't affect existing data
- ✅ **Safely skips if table doesn't exist yet** (will apply when table is created)

**Note:** If the table `sally_sales_content` doesn't exist yet, the script will safely skip the migration. This is normal - the table will be created when you apply the initial Sally migrations, and then you can run this migration again.

### Method 2: Manual SQL Execution

1. **Open your PostgreSQL client** (pgAdmin, DBeaver, or psql)
2. **Connect to your database**: `voca_order_taking`
3. **Run the SQL** from: `prisma/migrations/20250124000000_add_sally_phase1_fields/migration.sql`

The SQL is:
```sql
ALTER TABLE "sally_sales_content" ADD COLUMN IF NOT EXISTS "mode" TEXT;
ALTER TABLE "sally_sales_content" ADD COLUMN IF NOT EXISTS "selectedAssets" JSONB;
ALTER TABLE "sally_sales_content" ADD COLUMN IF NOT EXISTS "advancedInputs" JSONB;
```

4. **Generate Prisma client**:
```powershell
npx prisma generate
```

### Method 3: Mark Migration as Applied (If Columns Already Exist)

If the columns already exist in your database (perhaps from a previous attempt), you can mark the migration as applied:

```powershell
npx prisma migrate resolve --applied 20250124000000_add_sally_phase1_fields
npx prisma generate
```

## 🔍 Verify Migration Success

After applying, verify the columns exist:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sally_sales_content' 
AND column_name IN ('mode', 'selectedAssets', 'advancedInputs');
```

Expected output:
```
column_name      | data_type | is_nullable
-----------------|-----------|-------------
mode             | text      | YES
selectedAssets   | jsonb     | YES
advancedInputs   | jsonb     | YES
```

## ⚠️ Troubleshooting

### "Table does not exist"
- **This is SAFE and expected** if you haven't run the initial Sally migrations yet
- The script will automatically skip the migration if the table doesn't exist
- Once the table is created (via initial Sally migrations), run this migration again
- Check previous migrations: `npx prisma migrate status`

### "Column already exists"
- This is safe to ignore - the migration is idempotent
- The SQL uses `IF NOT EXISTS`, so it won't fail
- Columns already existing means the migration was already applied

### "Permission denied"
- Make sure your database user has ALTER TABLE permissions
- Check your DATABASE_URL connection string

## 🛡️ Data Safety

- **Existing rows**: All existing rows will have `NULL` values for new columns (safe)
- **Existing queries**: All existing queries continue to work (columns are nullable)
- **No data loss**: This migration cannot cause data loss
- **Rollback**: If needed, you can drop the columns (but not necessary)

## ✅ After Migration

1. ✅ Run `npx prisma generate` to update Prisma client
2. ✅ Restart your dev server
3. ✅ Test the new Phase 1 features

## 📝 Migration File Location

- SQL: `prisma/migrations/20250124000000_add_sally_phase1_fields/migration.sql`
- Script: `scripts/apply-sally-phase1-migration.js`
