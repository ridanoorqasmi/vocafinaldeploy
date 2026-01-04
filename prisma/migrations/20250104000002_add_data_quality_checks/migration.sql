-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."poppy_data_quality_checks" (
    "id" TEXT NOT NULL,
    "datasetVersionId" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "checksRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeCoverage" JSONB,
    "nullIssues" JSONB NOT NULL,
    "outlierSummary" JSONB,
    "warnings" JSONB NOT NULL,

    CONSTRAINT "poppy_data_quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "poppy_data_quality_checks_datasetVersionId_key" ON "public"."poppy_data_quality_checks"("datasetVersionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "poppy_data_quality_checks_datasetVersionId_idx" ON "public"."poppy_data_quality_checks"("datasetVersionId");

-- AddForeignKey
ALTER TABLE "public"."poppy_data_quality_checks" ADD CONSTRAINT "poppy_data_quality_checks_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "public"."poppy_dataset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;





