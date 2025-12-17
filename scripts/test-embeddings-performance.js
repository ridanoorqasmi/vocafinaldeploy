const { PrismaClient } = require('@prisma/client');

async function testEmbeddingsPerformance() {
  const prisma = new PrismaClient();
  
  try {
    console.log('⚡ Testing Embeddings Performance...\n');
    
    // Get a sample business
    const business = await prisma.business.findFirst();
    if (!business) {
      throw new Error('No businesses found in database');
    }
    
    console.log(`Using business: ${business.name} (${business.id})\n`);
    
    // Test 1: Create performance
    console.log('1️⃣ Testing CREATE performance...');
    const createStart = Date.now();
    
    const testEmbeddings = [];
    for (let i = 0; i < 10; i++) {
      const embedding = await prisma.embedding.create({
        data: {
          businessId: business.id,
          contentType: 'MENU',
          contentId: `perf-test-item-${i}`,
          content: `Performance test menu item ${i}`,
          embedding: new Array(1536).fill(Math.random()),
          metadata: { test: true, index: i }
        }
      });
      testEmbeddings.push(embedding);
    }
    
    const createEnd = Date.now();
    const createTime = createEnd - createStart;
    console.log(`✅ Created 10 embeddings in ${createTime}ms (${(createTime/10).toFixed(2)}ms per embedding)`);
    
    // Test 2: Read performance (by business ID)
    console.log('\n2️⃣ Testing READ performance (by business ID)...');
    const readStart = Date.now();
    
    const allEmbeddings = await prisma.embedding.findMany({
      where: { businessId: business.id }
    });
    
    const readEnd = Date.now();
    const readTime = readEnd - readStart;
    console.log(`✅ Read ${allEmbeddings.length} embeddings in ${readTime}ms`);
    
    // Test 3: Read performance (by content type)
    console.log('\n3️⃣ Testing READ performance (by content type)...');
    const readByTypeStart = Date.now();
    
    const menuEmbeddings = await prisma.embedding.findMany({
      where: { 
        businessId: business.id,
        contentType: 'MENU'
      }
    });
    
    const readByTypeEnd = Date.now();
    const readByTypeTime = readByTypeEnd - readByTypeStart;
    console.log(`✅ Read ${menuEmbeddings.length} MENU embeddings in ${readByTypeTime}ms`);
    
    // Test 4: Read performance (by unique constraint)
    console.log('\n4️⃣ Testing READ performance (by unique constraint)...');
    const readUniqueStart = Date.now();
    
    const uniqueEmbedding = await prisma.embedding.findUnique({
      where: {
        businessId_contentType_contentId: {
          businessId: business.id,
          contentType: 'MENU',
          contentId: 'perf-test-item-5'
        }
      }
    });
    
    const readUniqueEnd = Date.now();
    const readUniqueTime = readUniqueEnd - readUniqueStart;
    console.log(`✅ Read embedding by unique constraint in ${readUniqueTime}ms`);
    
    // Test 5: Update performance
    console.log('\n5️⃣ Testing UPDATE performance...');
    const updateStart = Date.now();
    
    for (let i = 0; i < 5; i++) {
      await prisma.embedding.update({
        where: { id: testEmbeddings[i].id },
        data: { 
          content: `Updated performance test menu item ${i}`,
          metadata: { test: true, index: i, updated: true }
        }
      });
    }
    
    const updateEnd = Date.now();
    const updateTime = updateEnd - updateStart;
    console.log(`✅ Updated 5 embeddings in ${updateTime}ms (${(updateTime/5).toFixed(2)}ms per update)`);
    
    // Test 6: Batch operations performance
    console.log('\n6️⃣ Testing BATCH operations performance...');
    const batchStart = Date.now();
    
    const batchData = [];
    for (let i = 10; i < 20; i++) {
      batchData.push({
        businessId: business.id,
        contentType: 'POLICY',
        contentId: `batch-test-item-${i}`,
        content: `Batch test policy item ${i}`,
        embedding: new Array(1536).fill(Math.random()),
        metadata: { test: true, batch: true, index: i }
      });
    }
    
    // Create batch using createMany
    const batchResult = await prisma.embedding.createMany({
      data: batchData
    });
    
    const batchEnd = Date.now();
    const batchTime = batchEnd - batchStart;
    console.log(`✅ Created ${batchResult.count} embeddings in batch in ${batchTime}ms (${(batchTime/batchResult.count).toFixed(2)}ms per embedding)`);
    
    // Test 7: Index effectiveness
    console.log('\n7️⃣ Testing INDEX effectiveness...');
    
    // Test with index (businessId + contentType)
    const indexStart = Date.now();
    const indexedResults = await prisma.embedding.findMany({
      where: {
        businessId: business.id,
        contentType: 'MENU'
      },
      orderBy: { createdAt: 'desc' }
    });
    const indexEnd = Date.now();
    const indexTime = indexEnd - indexStart;
    
    console.log(`✅ Indexed query (businessId + contentType): ${indexTime}ms for ${indexedResults.length} results`);
    
    // Test 8: Count performance
    console.log('\n8️⃣ Testing COUNT performance...');
    const countStart = Date.now();
    
    const totalCount = await prisma.embedding.count({
      where: { businessId: business.id }
    });
    
    const countEnd = Date.now();
    const countTime = countEnd - countStart;
    console.log(`✅ Count query: ${countTime}ms for ${totalCount} total embeddings`);
    
    // Test 9: Pagination performance
    console.log('\n9️⃣ Testing PAGINATION performance...');
    const paginationStart = Date.now();
    
    const paginatedResults = await prisma.embedding.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      skip: 0
    });
    
    const paginationEnd = Date.now();
    const paginationTime = paginationEnd - paginationStart;
    console.log(`✅ Pagination query: ${paginationTime}ms for ${paginatedResults.length} results`);
    
    // Clean up test data
    console.log('\n🔧 Cleaning up test data...');
    const cleanupStart = Date.now();
    
    await prisma.embedding.deleteMany({
      where: {
        businessId: business.id,
        OR: [
          { contentId: { startsWith: 'perf-test-item-' } },
          { contentId: { startsWith: 'batch-test-item-' } }
        ]
      }
    });
    
    const cleanupEnd = Date.now();
    const cleanupTime = cleanupEnd - cleanupStart;
    console.log(`✅ Cleanup completed in ${cleanupTime}ms`);
    
    // Performance summary
    console.log('\n📊 PERFORMANCE SUMMARY:');
    console.log(`   Create: ${(createTime/10).toFixed(2)}ms per embedding`);
    console.log(`   Read (all): ${readTime}ms for ${allEmbeddings.length} embeddings`);
    console.log(`   Read (by type): ${readByTypeTime}ms for ${menuEmbeddings.length} embeddings`);
    console.log(`   Read (unique): ${readUniqueTime}ms`);
    console.log(`   Update: ${(updateTime/5).toFixed(2)}ms per update`);
    console.log(`   Batch create: ${(batchTime/batchResult.count).toFixed(2)}ms per embedding`);
    console.log(`   Indexed query: ${indexTime}ms`);
    console.log(`   Count: ${countTime}ms`);
    console.log(`   Pagination: ${paginationTime}ms`);
    console.log(`   Cleanup: ${cleanupTime}ms`);
    
    console.log('\n🎉 Performance testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testEmbeddingsPerformance()
  .then(() => {
    console.log('✅ Performance validation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Performance validation failed:', error);
    process.exit(1);
  });
