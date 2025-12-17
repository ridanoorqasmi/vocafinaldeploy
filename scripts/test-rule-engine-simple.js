const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Simple test script for Rule Definition + Core Follow-Up Engine
 */
async function testRuleEngine() {
  console.log('🧪 Testing Rule Definition + Core Follow-Up Engine...\n');

  try {
    // Test 1: Check if Rule and Delivery models exist
    console.log('1️⃣ Testing database models...');
    
    const ruleCount = await prisma.rule.count();
    const deliveryCount = await prisma.delivery.count();
    const mappingCount = await prisma.mapping.count();
    const connectionCount = await prisma.connection.count();
    
    console.log(`✅ Found ${ruleCount} rules, ${deliveryCount} deliveries, ${mappingCount} mappings, ${connectionCount} connections`);

    // Test 2: Test rule creation with sample data
    console.log('\n2️⃣ Testing rule creation...');
    
    // Check if we have any mappings to work with
    const mappings = await prisma.mapping.findMany({
      include: {
        connection: true
      },
      take: 1
    });

    if (mappings.length === 0) {
      console.log('⚠️  No mappings found. Creating a test mapping...');
      
      // Create a test connection first
      const testConnection = await prisma.connection.create({
        data: {
          tenantId: 'test-tenant',
          type: 'POSTGRESQL',
          name: 'Test Connection',
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password',
          status: 'ACTIVE'
        }
      });

      // Create a test mapping
      const testMapping = await prisma.mapping.create({
        data: {
          connectionId: testConnection.id,
          resource: 'test_table',
          fields: {
            status: 'replyStatus',
            date: 'lastEmailSent',
            contact: 'email',
            pk: 'id',
            last_touch: 'updatedAt'
          },
          validatedAt: new Date()
        }
      });

      mappings.push(testMapping);
    }

    const mapping = mappings[0];
    
    // Create a test rule
    const testRule = await prisma.rule.create({
      data: {
        mappingId: mapping.id,
        name: 'Test Follow-up Rule',
        active: true,
        scheduleCron: '0 */3 * * *',
        condition: {
          all: [
            { equals: { field: 'replyStatus', value: 'NoReply' } },
            { olderThanDays: { field: 'lastEmailSent', days: 3 } }
          ]
        },
        action: {
          channel: 'email',
          subject: 'Test Follow-up',
          content: 'Hello {name}, this is a test follow-up message.'
        }
      }
    });

    console.log(`✅ Created test rule: ${testRule.name} (${testRule.id})`);

    // Test 3: Test delivery creation
    console.log('\n3️⃣ Testing delivery creation...');
    
    const testDelivery = await prisma.delivery.create({
      data: {
        ruleId: testRule.id,
        entityPk: 'test-entity-123',
        contact: 'test@example.com',
        channel: 'email',
        status: 'sent',
        idempotencyKey: 'test-key-123',
        sentAt: new Date()
      }
    });

    console.log(`✅ Created test delivery: ${testDelivery.id}`);

    // Test 4: Test rule retrieval with relations
    console.log('\n4️⃣ Testing rule retrieval with relations...');
    
    const ruleWithRelations = await prisma.rule.findUnique({
      where: { id: testRule.id },
      include: {
        mapping: {
          include: {
            connection: true
          }
        },
        deliveries: true
      }
    });

    if (ruleWithRelations) {
      console.log(`✅ Retrieved rule with relations: ${ruleWithRelations.name}`);
      console.log(`   - Mapping: ${ruleWithRelations.mapping.resource}`);
      console.log(`   - Connection: ${ruleWithRelations.mapping.connection?.name || 'None'}`);
      console.log(`   - Deliveries: ${ruleWithRelations.deliveries.length}`);
    }

    // Test 5: Test rule update
    console.log('\n5️⃣ Testing rule update...');
    
    const updatedRule = await prisma.rule.update({
      where: { id: testRule.id },
      data: {
        name: 'Updated Test Follow-up Rule',
        active: false
      }
    });

    console.log(`✅ Updated rule: ${updatedRule.name} (active: ${updatedRule.active})`);

    // Test 6: Clean up test data
    console.log('\n6️⃣ Cleaning up test data...');
    
    await prisma.delivery.deleteMany({
      where: { ruleId: testRule.id }
    });
    
    await prisma.rule.delete({
      where: { id: testRule.id }
    });
    
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Database models are working');
    console.log('✅ Rule creation is working');
    console.log('✅ Delivery creation is working');
    console.log('✅ Rule retrieval with relations is working');
    console.log('✅ Rule update is working');
    console.log('✅ Cleanup is working');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testRuleEngine()
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
