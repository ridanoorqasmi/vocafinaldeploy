const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRLSSimple() {
  try {
    console.log('🧪 Simple RLS Test...\n');
    
    // Create test businesses
    const timestamp = Date.now();
    const business1 = await prisma.business.create({
      data: {
        name: 'RLS Test 1',
        slug: `rls-test-1-${timestamp}`,
        email: `rls1-${timestamp}@test.com`,
        passwordHash: 'hashed',
        status: 'ACTIVE'
      }
    });

    const business2 = await prisma.business.create({
      data: {
        name: 'RLS Test 2',
        slug: `rls-test-2-${timestamp}`,
        email: `rls2-${timestamp}@test.com`,
        passwordHash: 'hashed',
        status: 'ACTIVE'
      }
    });

    console.log(`Created businesses: ${business1.id}, ${business2.id}`);

    // Test 1: Direct query without RLS context
    console.log('\n1. Testing direct query without RLS context:');
    const allBusinesses = await prisma.$queryRaw`SELECT id, name FROM businesses WHERE id IN (${business1.id}, ${business2.id})`;
    console.log('All businesses:', allBusinesses);

    // Test 2: Set context and query
    console.log('\n2. Testing with RLS context set:');
    await prisma.$executeRaw`SELECT set_current_business_id(${business1.id})`;
    
    const businessesWithContext = await prisma.$queryRaw`SELECT id, name FROM businesses WHERE id IN (${business1.id}, ${business2.id})`;
    console.log('Businesses with context:', businessesWithContext);

    // Test 3: Check current setting
    console.log('\n3. Checking current setting:');
    const currentSetting = await prisma.$queryRaw`SELECT current_setting('app.current_business_id', true) as current_business_id`;
    console.log('Current business ID setting:', currentSetting);

    // Test 4: Test with Prisma ORM (should respect RLS)
    console.log('\n4. Testing with Prisma ORM:');
    try {
      const business1ORM = await prisma.business.findUnique({ where: { id: business1.id } });
      console.log('Business 1 via ORM:', business1ORM ? 'Found' : 'Not found');
      
      const business2ORM = await prisma.business.findUnique({ where: { id: business2.id } });
      console.log('Business 2 via ORM:', business2ORM ? 'Found' : 'Not found');
    } catch (error) {
      console.log('ORM Error:', error.message);
    }

    // Clean up
    await prisma.business.deleteMany({
      where: { id: { in: [business1.id, business2.id] } }
    });
    console.log('\n✅ Cleaned up test data');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRLSSimple();

