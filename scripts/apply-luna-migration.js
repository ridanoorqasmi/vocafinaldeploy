const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Applying Luna migration...');
    
    // Execute each CREATE statement individually
    const statements = [
      `CREATE TABLE IF NOT EXISTS "public"."kb_documents" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "filename" TEXT NOT NULL,
        "mimeType" TEXT NOT NULL,
        "size" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id")
      )`,
      
      `CREATE TABLE IF NOT EXISTS "public"."kb_chunks" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "documentId" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "embedding" DOUBLE PRECISION[] NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
      )`,
      
      `CREATE TABLE IF NOT EXISTS "public"."conversations" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
      )`,
      
      `CREATE TABLE IF NOT EXISTS "public"."messages" (
        "id" TEXT NOT NULL,
        "conversationId" TEXT NOT NULL,
        "sender" TEXT NOT NULL,
        "text" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
      )`,
      
      `CREATE INDEX IF NOT EXISTS "kb_documents_tenantId_idx" ON "public"."kb_documents"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "kb_documents_createdAt_idx" ON "public"."kb_documents"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "kb_chunks_tenantId_idx" ON "public"."kb_chunks"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "kb_chunks_documentId_idx" ON "public"."kb_chunks"("documentId")`,
      `CREATE INDEX IF NOT EXISTS "kb_chunks_createdAt_idx" ON "public"."kb_chunks"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "conversations_tenantId_idx" ON "public"."conversations"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "conversations_createdAt_idx" ON "public"."conversations"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "messages_conversationId_idx" ON "public"."messages"("conversationId")`,
      `CREATE INDEX IF NOT EXISTS "messages_createdAt_idx" ON "public"."messages"("createdAt")`,
    ];
    
    // Execute each statement
    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (error) {
        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
          console.warn('Warning executing statement:', error.message);
        }
      }
    }
    
    // Add foreign keys using DO blocks
    const fkStatements = [
      `DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'kb_chunks_documentId_fkey'
          ) THEN
              ALTER TABLE "public"."kb_chunks" 
              ADD CONSTRAINT "kb_chunks_documentId_fkey" 
              FOREIGN KEY ("documentId") REFERENCES "public"."kb_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
      END $$;`,
      
      `DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'messages_conversationId_fkey'
          ) THEN
              ALTER TABLE "public"."messages" 
              ADD CONSTRAINT "messages_conversationId_fkey" 
              FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
      END $$;`
    ];
    
    for (const statement of fkStatements) {
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (error) {
        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
          console.warn('Warning executing FK statement:', error.message);
        }
      }
    }
    
    console.log('✅ Migration applied successfully!');
    
    // Verify tables were created
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('kb_documents', 'kb_chunks', 'conversations', 'messages')
    `;
    
    console.log('✅ Tables created:', tables.map(t => t.table_name));
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
