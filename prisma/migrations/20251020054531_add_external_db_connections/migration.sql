-- CreateEnum (only if it doesn't exist - may have been created by earlier migration)
DO $$ BEGIN
    CREATE TYPE "public"."DatabaseType" AS ENUM ('POSTGRESQL', 'MYSQL', 'SQLITE', 'MONGODB', 'FIREBASE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
CREATE TYPE "public"."ConnectionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNREACHABLE', 'ERROR');

-- AlterTable
ALTER TABLE "public"."followup_mappings" ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."external_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "public"."DatabaseType" NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "config" JSONB,
    "status" "public"."ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastTested" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mapping_validations" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "details" JSONB NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapping_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_connections_tenantId_idx" ON "public"."external_connections"("tenantId");

-- CreateIndex
CREATE INDEX "external_connections_type_idx" ON "public"."external_connections"("type");

-- CreateIndex
CREATE INDEX "external_connections_status_idx" ON "public"."external_connections"("status");

-- CreateIndex
CREATE INDEX "mapping_validations_mappingId_idx" ON "public"."mapping_validations"("mappingId");

-- CreateIndex
CREATE INDEX "mapping_validations_validatedAt_idx" ON "public"."mapping_validations"("validatedAt");

-- CreateIndex
CREATE INDEX "followup_mappings_connectionId_idx" ON "public"."followup_mappings"("connectionId");

-- AddForeignKey
ALTER TABLE "public"."followup_mappings" ADD CONSTRAINT "followup_mappings_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."external_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mapping_validations" ADD CONSTRAINT "mapping_validations_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "public"."followup_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
