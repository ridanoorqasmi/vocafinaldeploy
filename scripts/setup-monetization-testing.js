#!/usr/bin/env node

/**
 * Setup script for Phase 4D-2 Monetization Enhancements testing
 * This script prepares the database and environment for testing
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function setupMonetizationTesting() {
  console.log('🚀 Setting up Phase 4D-2 Monetization Testing Environment...\n');

  try {
    // 1. Apply database schema
    console.log('📊 Applying monetization database schema...');
    const schemaPath = path.join(__dirname, '../database/phase4d2-monetization-enhancements-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = schema.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.warn(`Warning: ${error.message}`);
          }
        }
      }
    }
    console.log('✅ Database schema applied successfully\n');

    // 2. Create test business
    console.log('🏢 Creating test business...');
    const testBusiness = await prisma.business.upsert({
      where: { id: 'test-business-123' },
      update: {},
      create: {
        id: 'test-business-123',
        name: 'Test Business for Monetization',
        email: 'test@monetization.com',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log(`✅ Test business created: ${testBusiness.id}\n`);

    // 3. Create test user
    console.log('👤 Creating test user...');
    const testUser = await prisma.user.upsert({
      where: { id: 'test-user-123' },
      update: {},
      create: {
        id: 'test-user-123',
        email: 'test@monetization.com',
        name: 'Test User',
        role: 'admin',
        businessId: 'test-business-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log(`✅ Test user created: ${testUser.id}\n`);

    // 4. Create test subscription
    console.log('💳 Creating test subscription...');
    const testSubscription = await prisma.subscription.upsert({
      where: { id: 'test-subscription-123' },
      update: {},
      create: {
        id: 'test-subscription-123',
        businessId: 'test-business-123',
        planId: 'pro',
        status: 'active',
        stripeSubscriptionId: 'sub_test_123',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log(`✅ Test subscription created: ${testSubscription.id}\n`);

    // 5. Create test add-ons
    console.log('🛒 Creating test add-ons...');
    const testAddOns = [
      {
        id: 'test-addon-1',
        name: 'Extra API Calls',
        description: 'Additional 10,000 API calls per month',
        priceCents: 2000,
        billingPeriod: 'monthly',
        eventType: 'api_call',
        quantityIncluded: 10000,
        isActive: true,
        sortOrder: 1
      },
      {
        id: 'test-addon-2',
        name: 'Extra Voice Minutes',
        description: 'Additional 1,000 voice minutes per month',
        priceCents: 5000,
        billingPeriod: 'monthly',
        eventType: 'voice_minute',
        quantityIncluded: 1000,
        isActive: true,
        sortOrder: 2
      }
    ];

    for (const addOn of testAddOns) {
      await prisma.addOn.upsert({
        where: { id: addOn.id },
        update: addOn,
        create: addOn
      });
    }
    console.log(`✅ Test add-ons created: ${testAddOns.length} add-ons\n`);

    // 6. Create test usage quotas
    console.log('📊 Creating test usage quotas...');
    const testQuotas = [
      {
        planId: 'pro',
        eventType: 'api_call',
        quotaLimit: 100000,
        overagePriceCents: 1,
        includedQuantity: 100000
      },
      {
        planId: 'pro',
        eventType: 'voice_minute',
        quotaLimit: 6000,
        overagePriceCents: 2,
        includedQuantity: 6000
      }
    ];

    for (const quota of testQuotas) {
      await prisma.usageQuota.upsert({
        where: {
          plan_id_event_type: {
            planId: quota.planId,
            eventType: quota.eventType
          }
        },
        update: quota,
        create: quota
      });
    }
    console.log(`✅ Test usage quotas created: ${testQuotas.length} quotas\n`);

    // 7. Enable feature flags
    console.log('🚩 Enabling feature flags...');
    const featureFlags = [
      { flagName: 'usage_based_billing', isEnabled: true, rolloutPercentage: 100 },
      { flagName: 'add_ons', isEnabled: true, rolloutPercentage: 100 },
      { flagName: 'custom_plans', isEnabled: true, rolloutPercentage: 100 },
      { flagName: 'flexible_invoicing', isEnabled: true, rolloutPercentage: 100 },
      { flagName: 'billing_insights', isEnabled: true, rolloutPercentage: 100 }
    ];

    for (const flag of featureFlags) {
      await prisma.billingFeatureFlag.upsert({
        where: { flagName: flag.flagName },
        update: flag,
        create: flag
      });
    }
    console.log(`✅ Feature flags enabled: ${featureFlags.length} flags\n`);

    console.log('🎉 Monetization testing environment setup complete!');
    console.log('\n📝 Test Data Summary:');
    console.log(`- Business ID: ${testBusiness.id}`);
    console.log(`- User ID: ${testUser.id}`);
    console.log(`- Subscription ID: ${testSubscription.id}`);
    console.log(`- Add-ons: ${testAddOns.length}`);
    console.log(`- Usage quotas: ${testQuotas.length}`);
    console.log(`- Feature flags: ${featureFlags.length}`);

  } catch (error) {
    console.error('❌ Error setting up testing environment:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
if (require.main === module) {
  setupMonetizationTesting();
}

module.exports = { setupMonetizationTesting };
