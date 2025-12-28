const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🗄️  Applying Question Analytics Migration (Direct)...\n');
    
    // Create table
    console.log('Creating question_analytics table...');
    await prisma.$executeRawUnsafe(`
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
      )
    `);
    console.log('✅ Table created');
    
    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "question_analytics_tenantId_idx" ON "public"."question_analytics"("tenantId")',
      'CREATE INDEX IF NOT EXISTS "question_analytics_conversationId_idx" ON "public"."question_analytics"("conversationId")',
      'CREATE INDEX IF NOT EXISTS "question_analytics_normalizedQuestion_idx" ON "public"."question_analytics"("normalizedQuestion")',
      'CREATE INDEX IF NOT EXISTS "question_analytics_confidenceLevel_idx" ON "public"."question_analytics"("confidenceLevel")',
      'CREATE INDEX IF NOT EXISTS "question_analytics_coverageStatus_idx" ON "public"."question_analytics"("coverageStatus")',
      'CREATE INDEX IF NOT EXISTS "question_analytics_supportIntent_idx" ON "public"."question_analytics"("supportIntent")',
      'CREATE INDEX IF NOT EXISTS "question_analytics_createdAt_idx" ON "public"."question_analytics"("createdAt")'
    ];
    
    for (const indexSQL of indexes) {
      try {
        await prisma.$executeRawUnsafe(indexSQL);
        console.log(`✅ Index created`);
      } catch (error) {
        if (error.message && !error.message.includes('already exists')) {
          console.log(`⚠️  Index creation: ${error.message}`);
        } else {
          console.log(`✅ Index already exists`);
        }
      }
    }
    
    // Verify
    console.log('\n🔍 Verifying table...');
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'question_analytics'
    `;
    
    if (result && result.length > 0) {
      console.log('✅ question_analytics table verified!');
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 Next step: Run "npx prisma generate" to update Prisma Client');
    } else {
      console.log('❌ Table verification failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();



