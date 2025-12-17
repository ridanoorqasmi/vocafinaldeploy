-- CreateTable: SupportTicket (Phase 3)
CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_tenantId_idx" ON "public"."support_tickets"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_conversationId_idx" ON "public"."support_tickets"("conversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "public"."support_tickets"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_assignedTo_idx" ON "public"."support_tickets"("assignedTo");






