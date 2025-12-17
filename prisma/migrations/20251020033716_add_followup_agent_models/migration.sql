-- CreateEnum
CREATE TYPE "public"."ReplyStatus" AS ENUM ('NoReply', 'Replied', 'Bounced');

-- CreateTable
CREATE TABLE "public"."followup_mappings" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followup_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."followup_rules" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scheduleCron" TEXT,
    "condition" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followup_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."followup_deliveries" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "entityPk" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followup_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."followup_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "replyStatus" "public"."ReplyStatus" NOT NULL DEFAULT 'NoReply',
    "lastEmailSent" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followup_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "followup_mappings_resource_idx" ON "public"."followup_mappings"("resource");

-- CreateIndex
CREATE INDEX "followup_rules_mappingId_idx" ON "public"."followup_rules"("mappingId");

-- CreateIndex
CREATE INDEX "followup_rules_active_idx" ON "public"."followup_rules"("active");

-- CreateIndex
CREATE UNIQUE INDEX "followup_deliveries_idempotencyKey_key" ON "public"."followup_deliveries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "followup_deliveries_ruleId_idx" ON "public"."followup_deliveries"("ruleId");

-- CreateIndex
CREATE INDEX "followup_deliveries_status_idx" ON "public"."followup_deliveries"("status");

-- CreateIndex
CREATE INDEX "followup_deliveries_sentAt_idx" ON "public"."followup_deliveries"("sentAt");

-- CreateIndex
CREATE INDEX "followup_leads_email_idx" ON "public"."followup_leads"("email");

-- CreateIndex
CREATE INDEX "followup_leads_replyStatus_idx" ON "public"."followup_leads"("replyStatus");

-- CreateIndex
CREATE INDEX "followup_leads_lastEmailSent_idx" ON "public"."followup_leads"("lastEmailSent");

-- AddForeignKey
ALTER TABLE "public"."followup_rules" ADD CONSTRAINT "followup_rules_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "public"."followup_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."followup_deliveries" ADD CONSTRAINT "followup_deliveries_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."followup_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
