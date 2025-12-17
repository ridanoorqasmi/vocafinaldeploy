// Quick test to verify embeddings functionality
const { PrismaClient } = require('@prisma/client');

async function quickTest() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧪 Quick Embedding Test...');
    
    // Get a business
    const business = await prisma.business.findFirst();
    if (!business) {
      console.log('❌ No businesses found');
      return;
    }
    
    console.log(`✅ Found business: ${business.name}`);
    
    // Test creating an embedding
    const embedding = await prisma.embedding.create({
      data: {
        businessId: business.id,
        contentType: 'MENU',
        contentId: 'test-item-1',
        content: 'Test menu item',
        embedding: new Array(1536).fill(0.1),
        metadata: { test: true }
      }
    });
    
    console.log(`✅ Created embedding: ${embedding.id}`);
    
    // Test reading it back
    const retrieved = await prisma.embedding.findUnique({
      where: { id: embedding.id }
    });
    
    console.log(`✅ Retrieved embedding: ${retrieved ? 'SUCCESS' : 'FAILED'}`);
    
    // Test listing embeddings
    const allEmbeddings = await prisma.embedding.findMany({
      where: { businessId: business.id }
    });
    
    console.log(`✅ Found ${allEmbeddings.length} embeddings for business`);
    
    // Clean up
    await prisma.embedding.delete({
      where: { id: embedding.id }
    });
    
    console.log('✅ Cleaned up test data');
    console.log('🎉 Quick test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickTest();
