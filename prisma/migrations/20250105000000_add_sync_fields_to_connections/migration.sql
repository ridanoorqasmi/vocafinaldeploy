-- AlterTable: Add sync-related columns to external_connections table (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'external_connections') THEN
        ALTER TABLE "public"."external_connections" 
        ADD COLUMN IF NOT EXISTS "syncFrequencyMinutes" INTEGER DEFAULT 60,
        ADD COLUMN IF NOT EXISTS "isAutoSyncEnabled" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "nextSyncAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "isSyncing" BOOLEAN DEFAULT false;
    END IF;
END $$;

-- CreateIndex (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'external_connections') THEN
        CREATE INDEX IF NOT EXISTS "external_connections_isAutoSyncEnabled_idx" ON "public"."external_connections"("isAutoSyncEnabled");
        CREATE INDEX IF NOT EXISTS "external_connections_nextSyncAt_idx" ON "public"."external_connections"("nextSyncAt");
    END IF;
END $$;


