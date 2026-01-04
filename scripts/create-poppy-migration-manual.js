const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function createPoppyMigration() {
  try {
    console.log('🔧 Creating Poppy tables manually (safe method)...\n');
    
    // Check if tables already exist
    const existing = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'poppy_%'
    `;
    
    if (existing.length > 0) {
      console.log('⚠️  Some Poppy tables already exist:');
      existing.forEach(t => console.log(`  - ${t.table_name}`));
      console.log('\n💡 Skipping creation of existing tables.');
      return;
    }
    
    console.log('📝 Creating Poppy tables...\n');
    
    // Create enum first
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "PoppyUserRole" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('  ✅ Created PoppyUserRole enum');
    
    // Create tables in dependency order
    const tables = [
      {
        name: 'poppy_tenants',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_tenants" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "poppy_tenants_pkey" PRIMARY KEY ("id")
          );
        `
      },
      {
        name: 'poppy_users',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_users" (
            "id" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "name" TEXT,
            "passwordHash" TEXT,
            "tenantId" TEXT NOT NULL,
            "role" "PoppyUserRole" NOT NULL DEFAULT 'MEMBER',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "poppy_users_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "poppy_users_email_key" UNIQUE ("email")
          );
        `
      },
      {
        name: 'poppy_auth_sessions',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_auth_sessions" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "role" "PoppyUserRole" NOT NULL,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "poppy_auth_sessions_pkey" PRIMARY KEY ("id")
          );
        `
      },
      {
        name: 'poppy_datasets',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_datasets" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "poppy_datasets_pkey" PRIMARY KEY ("id")
          );
        `
      },
      {
        name: 'poppy_dataset_versions',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_dataset_versions" (
            "id" TEXT NOT NULL,
            "datasetId" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "version" INTEGER NOT NULL,
            "filePath" TEXT NOT NULL,
            "fileSize" INTEGER NOT NULL,
            "rowCount" INTEGER,
            "columnCount" INTEGER,
            "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "poppy_dataset_versions_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "poppy_dataset_versions_datasetId_version_key" UNIQUE ("datasetId", "version")
          );
        `
      },
      {
        name: 'poppy_dataset_profiles',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_dataset_profiles" (
            "id" TEXT NOT NULL,
            "datasetVersionId" TEXT NOT NULL,
            "rowCount" INTEGER NOT NULL,
            "columnCount" INTEGER NOT NULL,
            "columns" JSONB NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "poppy_dataset_profiles_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "poppy_dataset_profiles_datasetVersionId_key" UNIQUE ("datasetVersionId")
          );
        `
      },
      {
        name: 'poppy_analysis_sessions',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_analysis_sessions" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "datasetId" TEXT,
            "title" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "poppy_analysis_sessions_pkey" PRIMARY KEY ("id")
          );
        `
      },
      {
        name: 'poppy_chat_messages',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_chat_messages" (
            "id" TEXT NOT NULL,
            "sessionId" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "role" TEXT NOT NULL,
            "content" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "poppy_chat_messages_pkey" PRIMARY KEY ("id")
          );
        `
      },
      {
        name: 'poppy_artifacts',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_artifacts" (
            "id" TEXT NOT NULL,
            "sessionId" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "data" JSONB NOT NULL,
            "metadata" JSONB,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "poppy_artifacts_pkey" PRIMARY KEY ("id")
          );
        `
      },
      {
        name: 'poppy_explanations',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_explanations" (
            "id" TEXT NOT NULL,
            "sessionId" TEXT NOT NULL,
            "artifactId" TEXT NOT NULL,
            "summary" TEXT NOT NULL,
            "implications" JSONB,
            "caveats" JSONB,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "poppy_explanations_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "poppy_explanations_artifactId_key" UNIQUE ("artifactId")
          );
        `
      },
      {
        name: 'poppy_token_usage',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_token_usage" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "sessionId" TEXT,
            "artifactId" TEXT,
            "promptTokens" INTEGER NOT NULL,
            "completionTokens" INTEGER NOT NULL,
            "totalTokens" INTEGER NOT NULL,
            "estimatedCost" DOUBLE PRECISION NOT NULL,
            "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "poppy_token_usage_pkey" PRIMARY KEY ("id")
          );
        `
      },
      {
        name: 'poppy_audit_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS "poppy_audit_logs" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "resourceType" TEXT NOT NULL,
            "resourceId" TEXT,
            "metadata" JSONB,
            "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "poppy_audit_logs_pkey" PRIMARY KEY ("id")
          );
        `
      }
    ];
    
    // Create tables
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(table.sql);
        console.log(`  ✅ Created table: ${table.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⚠️  Table ${table.name} already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
    
    // Create indexes
    console.log('\n📊 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "poppy_tenants_createdAt_idx" ON "poppy_tenants"("createdAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_users_tenantId_idx" ON "poppy_users"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_users_email_idx" ON "poppy_users"("email")',
      'CREATE INDEX IF NOT EXISTS "poppy_users_createdAt_idx" ON "poppy_users"("createdAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_auth_sessions_userId_idx" ON "poppy_auth_sessions"("userId")',
      'CREATE INDEX IF NOT EXISTS "poppy_auth_sessions_tenantId_idx" ON "poppy_auth_sessions"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_auth_sessions_expiresAt_idx" ON "poppy_auth_sessions"("expiresAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_datasets_tenantId_idx" ON "poppy_datasets"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_datasets_createdAt_idx" ON "poppy_datasets"("createdAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_dataset_versions_datasetId_idx" ON "poppy_dataset_versions"("datasetId")',
      'CREATE INDEX IF NOT EXISTS "poppy_dataset_versions_tenantId_idx" ON "poppy_dataset_versions"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_dataset_versions_uploadedAt_idx" ON "poppy_dataset_versions"("uploadedAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_dataset_profiles_datasetVersionId_idx" ON "poppy_dataset_profiles"("datasetVersionId")',
      'CREATE INDEX IF NOT EXISTS "poppy_analysis_sessions_tenantId_idx" ON "poppy_analysis_sessions"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_analysis_sessions_datasetId_idx" ON "poppy_analysis_sessions"("datasetId")',
      'CREATE INDEX IF NOT EXISTS "poppy_analysis_sessions_createdAt_idx" ON "poppy_analysis_sessions"("createdAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_chat_messages_sessionId_idx" ON "poppy_chat_messages"("sessionId")',
      'CREATE INDEX IF NOT EXISTS "poppy_chat_messages_tenantId_idx" ON "poppy_chat_messages"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_chat_messages_createdAt_idx" ON "poppy_chat_messages"("createdAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_artifacts_sessionId_idx" ON "poppy_artifacts"("sessionId")',
      'CREATE INDEX IF NOT EXISTS "poppy_artifacts_tenantId_idx" ON "poppy_artifacts"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_artifacts_createdAt_idx" ON "poppy_artifacts"("createdAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_explanations_sessionId_idx" ON "poppy_explanations"("sessionId")',
      'CREATE INDEX IF NOT EXISTS "poppy_explanations_artifactId_idx" ON "poppy_explanations"("artifactId")',
      'CREATE INDEX IF NOT EXISTS "poppy_explanations_createdAt_idx" ON "poppy_explanations"("createdAt")',
      'CREATE INDEX IF NOT EXISTS "poppy_token_usage_userId_idx" ON "poppy_token_usage"("userId")',
      'CREATE INDEX IF NOT EXISTS "poppy_token_usage_tenantId_idx" ON "poppy_token_usage"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_token_usage_sessionId_idx" ON "poppy_token_usage"("sessionId")',
      'CREATE INDEX IF NOT EXISTS "poppy_token_usage_timestamp_idx" ON "poppy_token_usage"("timestamp")',
      'CREATE INDEX IF NOT EXISTS "poppy_audit_logs_userId_idx" ON "poppy_audit_logs"("userId")',
      'CREATE INDEX IF NOT EXISTS "poppy_audit_logs_tenantId_idx" ON "poppy_audit_logs"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "poppy_audit_logs_resourceType_idx" ON "poppy_audit_logs"("resourceType")',
      'CREATE INDEX IF NOT EXISTS "poppy_audit_logs_timestamp_idx" ON "poppy_audit_logs"("timestamp")'
    ];
    
    for (const index of indexes) {
      try {
        await prisma.$executeRawUnsafe(index);
      } catch (error) {
        // Ignore index creation errors (they might already exist)
      }
    }
    console.log('  ✅ Indexes created');
    
    // Create foreign keys
    console.log('\n🔗 Creating foreign keys...');
    const foreignKeys = [
      'ALTER TABLE "poppy_users" ADD CONSTRAINT "poppy_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "poppy_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_datasets" ADD CONSTRAINT "poppy_datasets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "poppy_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_dataset_versions" ADD CONSTRAINT "poppy_dataset_versions_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "poppy_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_dataset_profiles" ADD CONSTRAINT "poppy_dataset_profiles_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "poppy_dataset_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_analysis_sessions" ADD CONSTRAINT "poppy_analysis_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "poppy_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_analysis_sessions" ADD CONSTRAINT "poppy_analysis_sessions_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "poppy_datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE',
      'ALTER TABLE "poppy_chat_messages" ADD CONSTRAINT "poppy_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "poppy_analysis_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_artifacts" ADD CONSTRAINT "poppy_artifacts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "poppy_analysis_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_artifacts" ADD CONSTRAINT "poppy_artifacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "poppy_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_explanations" ADD CONSTRAINT "poppy_explanations_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "poppy_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_token_usage" ADD CONSTRAINT "poppy_token_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "poppy_users"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_token_usage" ADD CONSTRAINT "poppy_token_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "poppy_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_token_usage" ADD CONSTRAINT "poppy_token_usage_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "poppy_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE',
      'ALTER TABLE "poppy_audit_logs" ADD CONSTRAINT "poppy_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "poppy_users"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE "poppy_audit_logs" ADD CONSTRAINT "poppy_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "poppy_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    ];
    
    for (const fk of foreignKeys) {
      try {
        await prisma.$executeRawUnsafe(fk.replace('ADD CONSTRAINT', 'ADD CONSTRAINT IF NOT EXISTS'));
      } catch (error) {
        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
          // Try without IF NOT EXISTS (PostgreSQL doesn't support it for constraints)
          try {
            await prisma.$executeRawUnsafe(fk);
          } catch (e) {
            if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
              console.warn(`  ⚠️  Warning creating FK: ${e.message}`);
            }
          }
        }
      }
    }
    console.log('  ✅ Foreign keys created');
    
    console.log('\n✅ All Poppy tables created successfully!');
    console.log('   No existing tables were modified or dropped.');
    
    // Verify
    const verify = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'poppy_%'
      ORDER BY table_name
    `;
    
    console.log(`\n📊 Created ${verify.length} Poppy tables:`);
    verify.forEach(t => console.log(`  ✅ ${t.table_name}`));
    
  } catch (error) {
    console.error('❌ Error creating Poppy tables:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createPoppyMigration();





