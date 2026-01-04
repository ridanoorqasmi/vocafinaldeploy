-- CreateTable: BusinessChatConfig
-- Phase 4: Business-level chat isolation and authentication
CREATE TABLE IF NOT EXISTS "business_chat_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_chat_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChatSession
CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "business_chat_configs_tenantId_key" ON "business_chat_configs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_chat_configs_tenantId_idx" ON "business_chat_configs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_chat_configs_isActive_idx" ON "business_chat_configs"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_sessions_tenantId_idx" ON "chat_sessions"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_sessions_conversationId_idx" ON "chat_sessions"("conversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_sessions_isActive_idx" ON "chat_sessions"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_sessions_expiresAt_idx" ON "chat_sessions"("expiresAt");














