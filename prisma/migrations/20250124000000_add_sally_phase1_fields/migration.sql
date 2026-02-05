-- Phase 1: Add Sally Sales Agent Phase 1 Fields
-- This migration is purely additive and safe - only adds nullable columns
-- No existing data or tables are modified or deleted
-- Safe to run even if table doesn't exist yet (will be applied when table is created)

-- Only add columns if table exists (safe conditional check)
DO $$
BEGIN
    -- Check if table exists before adding columns
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sally_sales_content'
    ) THEN
        -- Add mode column (nullable String)
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sally_sales_content' 
            AND column_name = 'mode'
        ) THEN
            ALTER TABLE "sally_sales_content" ADD COLUMN "mode" TEXT;
        END IF;

        -- Add selectedAssets column (nullable JSON)
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sally_sales_content' 
            AND column_name = 'selectedAssets'
        ) THEN
            ALTER TABLE "sally_sales_content" ADD COLUMN "selectedAssets" JSONB;
        END IF;

        -- Add advancedInputs column (nullable JSON)
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sally_sales_content' 
            AND column_name = 'advancedInputs'
        ) THEN
            ALTER TABLE "sally_sales_content" ADD COLUMN "advancedInputs" JSONB;
        END IF;
    END IF;
END $$;

-- Migration complete - all columns are nullable, so existing data is unaffected
-- This migration is idempotent and safe to run multiple times
