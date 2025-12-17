-- Add missing userId column to followup_mappings and followup_rules tables
-- Run this SQL directly in your database client

-- Step 1: Add userId column to followup_mappings
ALTER TABLE "public"."followup_mappings" 
ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Step 2: Add userId column to followup_rules
ALTER TABLE "public"."followup_rules" 
ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Step 3: Add foreign key constraint for followup_mappings
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'followup_mappings_userId_fkey'
    ) THEN
        ALTER TABLE "public"."followup_mappings" 
        ADD CONSTRAINT "followup_mappings_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 4: Add foreign key constraint for followup_rules
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'followup_rules_userId_fkey'
    ) THEN
        ALTER TABLE "public"."followup_rules" 
        ADD CONSTRAINT "followup_rules_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 5: Create index on userId for followup_mappings
CREATE INDEX IF NOT EXISTS "followup_mappings_userId_idx" ON "public"."followup_mappings"("userId");

-- Step 6: Create index on userId for followup_rules
CREATE INDEX IF NOT EXISTS "followup_rules_userId_idx" ON "public"."followup_rules"("userId");

-- Step 7: Drop old unique constraint if it exists (without userId)
ALTER TABLE "public"."followup_mappings" DROP CONSTRAINT IF EXISTS "followup_mappings_connectionId_resource_key";

-- Step 8: Create new unique constraint with userId (allows NULL for existing data)
CREATE UNIQUE INDEX IF NOT EXISTS "followup_mappings_userId_connectionId_resource_key" 
ON "public"."followup_mappings" ("userId", "connectionId", "resource") 
WHERE "userId" IS NOT NULL;

-- Verification: Check if columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'followup_mappings' 
AND column_name = 'userId';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'followup_rules' 
AND column_name = 'userId';



