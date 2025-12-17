const { PrismaClient } = require('@prisma/client');

async function enablePgVector() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Enabling pgvector extension...');
    
    // Enable pgvector extension
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
    
    console.log('✅ pgvector extension enabled successfully');
    
    // Verify extension is available
    const result = await prisma.$queryRaw`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector';
    `;
    
    console.log('Extension status:', result);
    
  } catch (error) {
    console.error('❌ Error enabling pgvector:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

enablePgVector()
  .then(() => {
    console.log('✅ pgvector setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ pgvector setup failed:', error);
    process.exit(1);
  });
