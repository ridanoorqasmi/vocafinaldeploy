-- Add missing userId column to followup_mappings and followup_rules tables
-- This migration adds the userId column that was expected but missing from the database

-- Add userId to followup_mappings (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followup_mappings') THEN
        ALTER TABLE "public"."followup_mappings" 
        ADD COLUMN IF NOT EXISTS "userId" TEXT;
    END IF;
END $$;

-- Add userId to followup_rules (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followup_rules') THEN
        ALTER TABLE "public"."followup_rules" 
        ADD COLUMN IF NOT EXISTS "userId" TEXT;
    END IF;
END $$;

-- Add foreign key constraint for followup_mappings (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followup_mappings') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'followup_mappings_userId_fkey'
        ) THEN
            ALTER TABLE "public"."followup_mappings" 
            ADD CONSTRAINT "followup_mappings_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- Add foreign key constraint for followup_rules (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followup_rules') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'followup_rules_userId_fkey'
        ) THEN
            ALTER TABLE "public"."followup_rules" 
            ADD CONSTRAINT "followup_rules_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- Create index on userId for followup_mappings (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followup_mappings') THEN
        CREATE INDEX IF NOT EXISTS "followup_mappings_userId_idx" ON "public"."followup_mappings"("userId");
    END IF;
END $$;

-- Create index on userId for followup_rules (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followup_rules') THEN
        CREATE INDEX IF NOT EXISTS "followup_rules_userId_idx" ON "public"."followup_rules"("userId");
    END IF;
END $$;

-- Drop old unique constraint if it exists (without userId) - only if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followup_mappings') THEN
        ALTER TABLE "public"."followup_mappings" DROP CONSTRAINT IF EXISTS "followup_mappings_connectionId_resource_key";
    END IF;
END $$;

-- Create new unique constraint with userId (allows NULL for existing data)
-- This uses a partial unique index to allow multiple NULLs - only if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followup_mappings') THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "followup_mappings_userId_connectionId_resource_key" 
        ON "public"."followup_mappings" ("userId", "connectionId", "resource")
        WHERE "userId" IS NOT NULL;
    END IF;
END $$;



