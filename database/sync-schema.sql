-- Migration: Add sync fields to external_connections and create mapped_records table
-- Date: 2025-01-XX

-- Add sync-related columns to external_connections table
ALTER TABLE "external_connections"
ADD COLUMN IF NOT EXISTS "syncFrequencyMinutes" INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS "isAutoSyncEnabled" BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextSyncAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "isSyncing" BOOLEAN DEFAULT FALSE;

-- Create indexes for sync fields
CREATE INDEX IF NOT EXISTS "external_connections_isAutoSyncEnabled_idx" ON "external_connections"("isAutoSyncEnabled");
CREATE INDEX IF NOT EXISTS "external_connections_nextSyncAt_idx" ON "external_connections"("nextSyncAt");

-- Create mapped_records table for storing synced data
CREATE TABLE IF NOT EXISTS "mapped_records" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "mappingId" TEXT,
    "externalId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapped_records_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on connectionId + externalId
CREATE UNIQUE INDEX IF NOT EXISTS "mapped_records_connectionId_externalId_key" ON "mapped_records"("connectionId", "externalId");

-- Create indexes for mapped_records
CREATE INDEX IF NOT EXISTS "mapped_records_connectionId_idx" ON "mapped_records"("connectionId");
CREATE INDEX IF NOT EXISTS "mapped_records_mappingId_idx" ON "mapped_records"("mappingId");
CREATE INDEX IF NOT EXISTS "mapped_records_isActive_idx" ON "mapped_records"("isActive");
CREATE INDEX IF NOT EXISTS "mapped_records_syncedAt_idx" ON "mapped_records"("syncedAt");

-- Add foreign key constraint
ALTER TABLE "mapped_records" ADD CONSTRAINT "mapped_records_connectionId_fkey" 
FOREIGN KEY ("connectionId") REFERENCES "external_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;


