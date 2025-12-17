const { PrismaClient } = require('@prisma/client');

async function testRLSEmbeddings() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔐 Testing RLS for Embeddings Table...\n');
    
    // Get two different businesses for testing
    const businesses = await prisma.business.findMany({ take: 2 });
    if (businesses.length < 2) {
      throw new Error('Need at least 2 businesses for RLS testing');
    }
    
    const business1 = businesses[0];
    const business2 = businesses[1];
    
    console.log(`Business 1: ${business1.name} (${business1.id})`);
    console.log(`Business 2: ${business2.name} (${business2.id})\n`);
    
    // Test 1: Create embeddings for both businesses
    console.log('1️⃣ Creating test embeddings...');
    
    const embedding1 = await prisma.embedding.create({
      data: {
        businessId: business1.id,
        contentType: 'MENU',
        contentId: 'rls-test-item-1',
        content: 'Business 1 menu item',
        embedding: new Array(1536).fill(0.1),
        metadata: { business: 'business1' }
      }
    });
    
    const embedding2 = await prisma.embedding.create({
      data: {
        businessId: business2.id,
        contentType: 'MENU',
        contentId: 'rls-test-item-2',
        content: 'Business 2 menu item',
        embedding: new Array(1536).fill(0.2),
        metadata: { business: 'business2' }
      }
    });
    
    console.log('✅ Created embeddings for both businesses');
    
    // Test 2: Set business context and test isolation
    console.log('\n2️⃣ Testing business context isolation...');
    
    // Set context for business 1
    await prisma.$executeRaw`SELECT set_current_business_id(${business1.id})`;
    
    const business1Embeddings = await prisma.embedding.findMany();
    console.log(`Business 1 context: Found ${business1Embeddings.length} embeddings`);
    
    // Set context for business 2
    await prisma.$executeRaw`SELECT set_current_business_id(${business2.id})`;
    
    const business2Embeddings = await prisma.embedding.findMany();
    console.log(`Business 2 context: Found ${business2Embeddings.length} embeddings`);
    
    // Test 3: Verify cross-tenant isolation
    console.log('\n3️⃣ Testing cross-tenant isolation...');
    
    // Business 1 should only see its own embeddings
    await prisma.$executeRaw`SELECT set_current_business_id(${business1.id})`;
    const business1View = await prisma.embedding.findMany();
    const business1CanSeeBusiness2 = business1View.some(e => e.businessId === business2.id);
    
    if (business1CanSeeBusiness2) {
      console.log('❌ RLS FAILED: Business 1 can see Business 2 embeddings');
    } else {
      console.log('✅ RLS SUCCESS: Business 1 cannot see Business 2 embeddings');
    }
    
    // Business 2 should only see its own embeddings
    await prisma.$executeRaw`SELECT set_current_business_id(${business2.id})`;
    const business2View = await prisma.embedding.findMany();
    const business2CanSeeBusiness1 = business2View.some(e => e.businessId === business1.id);
    
    if (business2CanSeeBusiness1) {
      console.log('❌ RLS FAILED: Business 2 can see Business 1 embeddings');
    } else {
      console.log('✅ RLS SUCCESS: Business 2 cannot see Business 1 embeddings');
    }
    
    // Test 4: Test operations with wrong business context
    console.log('\n4️⃣ Testing operations with wrong business context...');
    
    // Try to update embedding from wrong business context
    await prisma.$executeRaw`SELECT set_current_business_id(${business1.id})`;
    
    try {
      await prisma.embedding.update({
        where: { id: embedding2.id },
        data: { content: 'Hacked content' }
      });
      console.log('❌ RLS FAILED: Could update embedding from wrong business context');
    } catch (error) {
      console.log('✅ RLS SUCCESS: Cannot update embedding from wrong business context');
    }
    
    // Test 5: Test delete operations
    console.log('\n5️⃣ Testing delete operations...');
    
    // Try to delete embedding from wrong business context
    try {
      await prisma.embedding.delete({
        where: { id: embedding2.id }
      });
      console.log('❌ RLS FAILED: Could delete embedding from wrong business context');
    } catch (error) {
      console.log('✅ RLS SUCCESS: Cannot delete embedding from wrong business context');
    }
    
    // Clean up test data
    console.log('\n6️⃣ Cleaning up test data...');
    
    // Delete from correct business contexts
    await prisma.$executeRaw`SELECT set_current_business_id(${business1.id})`;
    await prisma.embedding.delete({ where: { id: embedding1.id } });
    
    await prisma.$executeRaw`SELECT set_current_business_id(${business2.id})`;
    await prisma.embedding.delete({ where: { id: embedding2.id } });
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 RLS testing completed successfully!');
    
  } catch (error) {
    console.error('❌ RLS test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testRLSEmbeddings()
  .then(() => {
    console.log('✅ RLS validation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 RLS validation failed:', error);
    process.exit(1);
  });
