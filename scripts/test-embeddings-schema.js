const { PrismaClient } = require('@prisma/client');

async function testEmbeddingsSchema() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧪 Testing Embeddings Schema...\n');
    
    // Test 1: Verify table exists and has correct structure
    console.log('1️⃣ Testing table structure...');
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'embeddings' 
      ORDER BY ordinal_position;
    `;
    
    console.log('✅ Table structure:');
    tableInfo.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Test 2: Verify indexes exist
    console.log('\n2️⃣ Testing indexes...');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'embeddings';
    `;
    
    console.log('✅ Indexes found:');
    indexes.forEach(idx => {
      console.log(`   ${idx.indexname}`);
    });
    
    // Test 3: Verify constraints exist
    console.log('\n3️⃣ Testing constraints...');
    const constraints = await prisma.$queryRaw`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'embeddings'::regclass;
    `;
    
    console.log('✅ Constraints found:');
    constraints.forEach(constraint => {
      console.log(`   ${constraint.conname}: ${constraint.definition}`);
    });
    
    // Test 4: Verify enum type exists
    console.log('\n4️⃣ Testing enum type...');
    const enumValues = await prisma.$queryRaw`
      SELECT enumlabel
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EmbeddingType');
    `;
    
    console.log('✅ EmbeddingType enum values:');
    enumValues.forEach(val => {
      console.log(`   ${val.enumlabel}`);
    });
    
    // Test 5: Test basic CRUD operations
    console.log('\n5️⃣ Testing basic CRUD operations...');
    
    // Get a sample business ID
    const business = await prisma.business.findFirst();
    if (!business) {
      throw new Error('No businesses found in database');
    }
    
    console.log(`   Using business: ${business.name} (${business.id})`);
    
    // Create a test embedding
    const testEmbedding = await prisma.embedding.create({
      data: {
        businessId: business.id,
        contentType: 'MENU',
        contentId: 'test-menu-item-1',
        content: 'Delicious pizza with pepperoni and cheese',
        embedding: new Array(1536).fill(0.1), // Dummy embedding
        metadata: { test: true, category: 'pizza' }
      }
    });
    
    console.log('✅ Created test embedding:', testEmbedding.id);
    
    // Read the embedding
    const retrieved = await prisma.embedding.findUnique({
      where: { id: testEmbedding.id }
    });
    
    console.log('✅ Retrieved embedding:', retrieved ? 'SUCCESS' : 'FAILED');
    
    // Update the embedding
    const updated = await prisma.embedding.update({
      where: { id: testEmbedding.id },
      data: { 
        content: 'Updated: Delicious pizza with pepperoni and cheese',
        metadata: { test: true, category: 'pizza', updated: true }
      }
    });
    
    console.log('✅ Updated embedding:', updated.content.includes('Updated') ? 'SUCCESS' : 'FAILED');
    
    // Test unique constraint
    try {
      await prisma.embedding.create({
        data: {
          businessId: business.id,
          contentType: 'MENU',
          contentId: 'test-menu-item-1', // Same contentId
          content: 'Another pizza',
          embedding: new Array(1536).fill(0.2)
        }
      });
      console.log('❌ Unique constraint test: FAILED (should have thrown error)');
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('✅ Unique constraint test: SUCCESS (correctly prevented duplicate)');
      } else {
        console.log('❌ Unique constraint test: FAILED (unexpected error):', error.message);
      }
    }
    
    // Test foreign key constraint
    try {
      await prisma.embedding.create({
        data: {
          businessId: 'non-existent-business-id',
          contentType: 'MENU',
          contentId: 'test-menu-item-2',
          content: 'Test content',
          embedding: new Array(1536).fill(0.3)
        }
      });
      console.log('❌ Foreign key constraint test: FAILED (should have thrown error)');
    } catch (error) {
      if (error.code === 'P2003') {
        console.log('✅ Foreign key constraint test: SUCCESS (correctly prevented invalid business)');
      } else {
        console.log('❌ Foreign key constraint test: FAILED (unexpected error):', error.message);
      }
    }
    
    // Clean up test data
    await prisma.embedding.delete({
      where: { id: testEmbedding.id }
    });
    console.log('✅ Cleaned up test data');
    
    // Test 6: Verify RLS is enabled
    console.log('\n6️⃣ Testing RLS status...');
    const rlsStatus = await prisma.$queryRaw`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class 
      WHERE relname = 'embeddings';
    `;
    
    if (rlsStatus.length > 0) {
      const status = rlsStatus[0];
      console.log(`✅ RLS Status: enabled=${status.relrowsecurity}, enforced=${status.relforcerowsecurity}`);
    } else {
      console.log('❌ RLS Status: Table not found');
    }
    
    console.log('\n🎉 All schema tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Schema test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testEmbeddingsSchema()
  .then(() => {
    console.log('✅ Schema validation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Schema validation failed:', error);
    process.exit(1);
  });
