const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugRLS() {
  try {
    console.log('🔍 Debugging RLS Policies...\n');
    
    // Create test businesses
    const timestamp = Date.now();
    const business1 = await prisma.business.create({
      data: {
        name: 'RLS Debug 1',
        slug: `rls-debug-1-${timestamp}`,
        email: `rls-debug-1-${timestamp}@test.com`,
        passwordHash: 'hashed',
        status: 'ACTIVE'
      }
    });

    const business2 = await prisma.business.create({
      data: {
        name: 'RLS Debug 2',
        slug: `rls-debug-2-${timestamp}`,
        email: `rls-debug-2-${timestamp}@test.com`,
        passwordHash: 'hashed',
        status: 'ACTIVE'
      }
    });

    console.log(`Created businesses: ${business1.id}, ${business2.id}`);

    // Set context
    await prisma.$executeRaw`SELECT set_current_business_id(${business1.id})`;
    console.log('Set context to business 1');

    // Test the exact policy condition
    console.log('\nTesting policy condition manually:');
    const policyTest = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        (id = current_setting('app.current_business_id', true)) as policy_condition,
        current_setting('app.current_business_id', true) as current_business_id
      FROM businesses 
      WHERE id IN (${business1.id}, ${business2.id});
    `;
    console.log('Policy test results:', policyTest);

    // Test if RLS is actually enabled
    console.log('\nChecking RLS status:');
    const rlsStatus = await prisma.$queryRaw`
      SELECT 
        relname,
        relrowsecurity,
        relforcerowsecurity
      FROM pg_class 
      WHERE relname = 'businesses';
    `;
    console.log('RLS status:', rlsStatus);

    // Test with a different approach - check if policies are active
    console.log('\nChecking active policies:');
    const activePolicies = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE tablename = 'businesses';
    `;
    console.log('Active policies:', activePolicies);

    // Test the policy condition directly
    console.log('\nTesting policy condition directly:');
    const directTest = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        CASE 
          WHEN id = current_setting('app.current_business_id', true) THEN 'MATCH'
          ELSE 'NO_MATCH'
        END as match_status
      FROM businesses 
      WHERE id IN (${business1.id}, ${business2.id});
    `;
    console.log('Direct test results:', directTest);

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

debugRLS();

