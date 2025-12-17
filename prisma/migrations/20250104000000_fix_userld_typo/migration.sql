-- Fix userld typo in followup_mappings and followup_rules tables
-- This migration ensures the column is named 'userId' (not 'userld')

-- Check and fix followup_mappings table
DO $$ 
BEGIN
    -- If 'userld' column exists and 'userId' doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'followup_mappings' 
        AND column_name = 'userld'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'followup_mappings' 
        AND column_name = 'userId'
    ) THEN
        ALTER TABLE "public"."followup_mappings" RENAME COLUMN "userld" TO "userId";
        RAISE NOTICE 'Renamed userld to userId in followup_mappings';
    END IF;
    
    -- If both exist, migrate data and drop userld
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'followup_mappings' 
        AND column_name = 'userld'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'followup_mappings' 
        AND column_name = 'userId'
    ) THEN
        UPDATE "public"."followup_mappings" 
        SET "userId" = "userld" 
        WHERE "userId" IS NULL AND "userld" IS NOT NULL;
        
        ALTER TABLE "public"."followup_mappings" DROP COLUMN "userld";
        RAISE NOTICE 'Migrated data from userld to userId and dropped userld from followup_mappings';
    END IF;
END $$;

-- Check and fix followup_rules table
DO $$ 
BEGIN
    -- If 'userld' column exists and 'userId' doesn't, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'followup_rules' 
        AND column_name = 'userld'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'followup_rules' 
        AND column_name = 'userId'
    ) THEN
        ALTER TABLE "public"."followup_rules" RENAME COLUMN "userld" TO "userId";
        RAISE NOTICE 'Renamed userld to userId in followup_rules';
    END IF;
    
    -- If both exist, migrate data and drop userld
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'followup_rules' 
        AND column_name = 'userld'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'followup_rules' 
        AND column_name = 'userId'
    ) THEN
        UPDATE "public"."followup_rules" 
        SET "userId" = "userld" 
        WHERE "userId" IS NULL AND "userld" IS NOT NULL;
        
        ALTER TABLE "public"."followup_rules" DROP COLUMN "userld";
        RAISE NOTICE 'Migrated data from userld to userId and dropped userld from followup_rules';
    END IF;
END $$;



