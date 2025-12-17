const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRLS() {
  try {
    console.log('🔍 Checking RLS policies...\n');
    
    // Check if RLS is enabled on tables
    const rlsStatus = await prisma.$queryRaw`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relkind = 'r' 
      AND relname IN ('businesses', 'users', 'menu_items', 'orders')
      ORDER BY relname;
    `;
    
    console.log('RLS Status:');
    console.log(rlsStatus);
    
    // Check policies
    const policies = await prisma.$queryRaw`
      SELECT tablename, policyname, cmd, qual 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      ORDER BY tablename, policyname;
    `;
    
    console.log('\nRLS Policies:');
    console.log(policies);
    
    // Test RLS isolation
    console.log('\n🧪 Testing RLS isolation...');
    
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

    // Set context for business 1
    await prisma.$executeRaw`SELECT set_current_business_id(${business1.id})`;
    console.log('Set context for business 1');

    // Test if business 1 can see business 2's data
    const business2Data = await prisma.$queryRaw`
      SELECT * FROM businesses WHERE id = ${business2.id};
    `;
    
    console.log('Business 1 trying to see Business 2 data:');
    console.log('Result:', business2Data);
    
    if (business2Data.length > 0) {
      console.log('❌ RLS isolation failed - Business 1 can see Business 2 data');
    } else {
      console.log('✅ RLS isolation working - Business 1 cannot see Business 2 data');
    }

    // Clean up
    await prisma.business.deleteMany({
      where: { id: { in: [business1.id, business2.id] } }
    });
    console.log('Cleaned up test data');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRLS();

