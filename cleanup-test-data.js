const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    await prisma.business.deleteMany({ where: { name: 'Analytics Test Business' } });
    console.log('✅ Cleaned up test data');
  } catch (error) {
    console.log('✅ No test data to clean');
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
