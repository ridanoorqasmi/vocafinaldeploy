-- CreateTable: QuestionAnalytics
-- Admin Insights: Question analytics for knowledge gap detection
CREATE TABLE IF NOT EXISTS "public"."question_analytics" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "normalizedQuestion" TEXT NOT NULL,
    "detectedIntent" TEXT,
    "confidenceLevel" TEXT NOT NULL,
    "coverageStatus" TEXT NOT NULL,
    "supportIntent" TEXT,
    "sentiment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "question_analytics_tenantId_idx" ON "public"."question_analytics"("tenantId");
CREATE INDEX IF NOT EXISTS "question_analytics_conversationId_idx" ON "public"."question_analytics"("conversationId");
CREATE INDEX IF NOT EXISTS "question_analytics_normalizedQuestion_idx" ON "public"."question_analytics"("normalizedQuestion");
CREATE INDEX IF NOT EXISTS "question_analytics_confidenceLevel_idx" ON "public"."question_analytics"("confidenceLevel");
CREATE INDEX IF NOT EXISTS "question_analytics_coverageStatus_idx" ON "public"."question_analytics"("coverageStatus");
CREATE INDEX IF NOT EXISTS "question_analytics_supportIntent_idx" ON "public"."question_analytics"("supportIntent");
CREATE INDEX IF NOT EXISTS "question_analytics_createdAt_idx" ON "public"."question_analytics"("createdAt");



