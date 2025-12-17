// Test database connection
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  console.log('📊 DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  
  const prisma = new PrismaClient();
  
  try {
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database query successful:', result);
    
    // Test if Business table exists
    try {
      const businessCount = await prisma.business.count();
      console.log('✅ Business table accessible, count:', businessCount);
    } catch (error) {
      console.log('❌ Business table error:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('💡 Make sure PostgreSQL is running and DATABASE_URL is correct');
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();
