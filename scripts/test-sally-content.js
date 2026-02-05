/**
 * Test Sally Content Table
 * 
 * This script tests if the sally_sales_content table exists and can be queried
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTable() {
  try {
    console.log('🔍 Testing sally_sales_content table...\n');
    
    // Try to count records
    const count = await prisma.sally_sales_content.count();
    console.log(`✅ Table exists! Found ${count} content records\n`);
    
    // Try to find all content
    const allContent = await prisma.sally_sales_content.findMany({
      take: 5,
      select: {
        id: true,
        userId: true,
        companyId: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    
    console.log(`📊 Sample content records (showing up to 5):`);
    allContent.forEach((content, idx) => {
      console.log(`\n  ${idx + 1}. Content ID: ${content.id}`);
      console.log(`     User ID: ${content.userId}`);
      console.log(`     Company ID: ${content.companyId}`);
      console.log(`     Workspace ID: ${content.workspaceId || '(null)'}`);
      console.log(`     Created: ${content.createdAt}`);
      console.log(`     Updated: ${content.updatedAt}`);
    });
    
    if (allContent.length === 0) {
      console.log('\n⚠️  No content records found in the table');
      console.log('   This is normal if you haven\'t generated any content yet');
    }
    
  } catch (error) {
    console.error('❌ Error testing table:', error.message);
    console.error('\nError details:');
    console.error('  Code:', error.code);
    console.error('  Meta:', error.meta);
    
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('\n⚠️  The sally_sales_content table does not exist!');
      console.error('💡 Run: node scripts/create-sally-tables-simple.js');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testTable();
