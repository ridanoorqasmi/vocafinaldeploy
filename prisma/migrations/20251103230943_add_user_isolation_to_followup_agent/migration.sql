-- AlterTable: Add userId to followup_mappings (nullable initially)
ALTER TABLE "public"."followup_mappings" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- AlterTable: Add userId to followup_rules (nullable initially)
ALTER TABLE "public"."followup_rules" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Note: For existing records, userId will be NULL
-- You may want to assign them to a default user or delete them if not needed

-- AddForeignKey: Link followup_mappings to users (only for non-null userId)
-- Note: We need to add this constraint conditionally or handle NULLs
DO $$ 
BEGIN
    -- Only add foreign key if we can ensure referential integrity
    -- For now, we'll add it but existing NULL values will be allowed
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'followup_mappings_userId_fkey'
    ) THEN
        ALTER TABLE "public"."followup_mappings" 
        ADD CONSTRAINT "followup_mappings_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: Link followup_rules to users
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

-- CreateIndex: Index userId on followup_mappings
CREATE INDEX IF NOT EXISTS "followup_mappings_userId_idx" ON "public"."followup_mappings"("userId");

-- CreateIndex: Index userId on followup_rules
CREATE INDEX IF NOT EXISTS "followup_rules_userId_idx" ON "public"."followup_rules"("userId");

-- Drop the old unique constraint if it exists
ALTER TABLE "public"."followup_mappings" DROP CONSTRAINT IF EXISTS "followup_mappings_connectionId_resource_key";
ALTER TABLE "public"."followup_mappings" DROP CONSTRAINT IF EXISTS "followup_mappings_userId_connectionId_resource_key";

-- Create new unique constraint with userId (allows NULL for existing data)
-- Note: This uses a partial unique index to allow multiple NULLs
CREATE UNIQUE INDEX IF NOT EXISTS "followup_mappings_userId_connectionId_resource_key" 
ON "public"."followup_mappings" ("userId", "connectionId", "resource") 
WHERE "userId" IS NOT NULL;

-- Note: Existing records without userId will be ignored for now
-- After data migration, you should:
-- 1. Assign userId to all existing records OR delete them
-- 2. Then make userId NOT NULL if needed

