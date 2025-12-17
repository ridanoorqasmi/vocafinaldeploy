/*
  Warnings:

  - A unique constraint covering the columns `[dedupeKey]` on the table `followup_deliveries` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[connectionId,resource]` on the table `followup_mappings` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."followup_deliveries" ADD COLUMN     "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "followup_deliveries_dedupeKey_key" ON "public"."followup_deliveries"("dedupeKey");

-- CreateIndex
CREATE INDEX "followup_deliveries_dedupeKey_idx" ON "public"."followup_deliveries"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "followup_mappings_connectionId_resource_key" ON "public"."followup_mappings"("connectionId", "resource");
