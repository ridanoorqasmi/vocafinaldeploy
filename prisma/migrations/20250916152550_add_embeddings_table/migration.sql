-- CreateEnum
CREATE TYPE "EmbeddingType" AS ENUM ('MENU', 'POLICY', 'FAQ', 'BUSINESS');

-- CreateTable
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contentType" "EmbeddingType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_businessId_contentType_contentId_key" ON "embeddings"("businessId", "contentType", "contentId");

-- CreateIndex
CREATE INDEX "embeddings_businessId_idx" ON "embeddings"("businessId");

-- CreateIndex
CREATE INDEX "embeddings_businessId_contentType_idx" ON "embeddings"("businessId", "contentType");

-- CreateIndex
CREATE INDEX "embeddings_contentType_idx" ON "embeddings"("contentType");

-- CreateIndex
CREATE INDEX "embeddings_createdAt_idx" ON "embeddings"("createdAt");

-- CreateIndex
CREATE INDEX "embeddings_deletedAt_idx" ON "embeddings"("deletedAt");

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;