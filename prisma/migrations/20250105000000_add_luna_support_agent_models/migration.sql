-- CreateTable: KbDocument
CREATE TABLE IF NOT EXISTS "public"."kb_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: KbChunk
CREATE TABLE IF NOT EXISTS "public"."kb_chunks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Conversation
CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Message
CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kb_documents_tenantId_idx" ON "public"."kb_documents"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kb_documents_createdAt_idx" ON "public"."kb_documents"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kb_chunks_tenantId_idx" ON "public"."kb_chunks"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kb_chunks_documentId_idx" ON "public"."kb_chunks"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kb_chunks_createdAt_idx" ON "public"."kb_chunks"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_tenantId_idx" ON "public"."conversations"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_createdAt_idx" ON "public"."conversations"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_conversationId_idx" ON "public"."messages"("conversationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_createdAt_idx" ON "public"."messages"("createdAt");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kb_chunks_documentId_fkey'
    ) THEN
        ALTER TABLE "public"."kb_chunks" 
        ADD CONSTRAINT "kb_chunks_documentId_fkey" 
        FOREIGN KEY ("documentId") REFERENCES "public"."kb_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'messages_conversationId_fkey'
    ) THEN
        ALTER TABLE "public"."messages" 
        ADD CONSTRAINT "messages_conversationId_fkey" 
        FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;





