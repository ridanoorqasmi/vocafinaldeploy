#!/usr/bin/env node

/**
 * Backend testing script for Phase 4D-2 Monetization Enhancements
 * Tests all backend services and API endpoints
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_BUSINESS_ID = 'test-business-123';

// Test data
const testUsageEvent = {
  businessId: TEST_BUSINESS_ID,
  eventType: 'api_call',
  quantity: 100,
  unitPriceCents: 1,
  metadata: { source: 'test' }
};

const testAddOn = {
  name: 'Test Add-on',
  description: 'Test add-on for testing',
  priceCents: 1000,
  billingPeriod: 'monthly',
  eventType: 'api_call',
  quantityIncluded: 1000,
  isActive: true
};

const testCustomPlan = {
  businessId: TEST_BUSINESS_ID,
  planName: 'Test Enterprise Plan',
  basePriceCents: 50000,
  billingPeriod: 'monthly',
  limits: {
    api_call: 100000,
    voice_minute: 10000
  },
  createdBy: 'test-user-123'
};

// Test functions
async function testUsageAPI() {
  console.log('🧪 Testing Usage API...');
  
  try {
    // Test recording usage event
    console.log('  📝 Recording usage event...');
    const recordResponse = await fetch(`${BASE_URL}/api/v1/monetization/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUsageEvent)
    });
    
    const recordResult = await recordResponse.json();
    if (recordResult.success) {
      console.log('  ✅ Usage event recorded successfully');
    } else {
      console.log('  ❌ Failed to record usage event:', recordResult.error);
    }

    // Test getting usage events
    console.log('  📊 Getting usage events...');
    const getResponse = await fetch(`${BASE_URL}/api/v1/monetization/usage?businessId=${TEST_BUSINESS_ID}`);
    const getResult = await getResponse.json();
    if (getResult.success) {
      console.log(`  ✅ Retrieved ${getResult.data.length} usage events`);
    } else {
      console.log('  ❌ Failed to get usage events:', getResult.error);
    }

    // Test usage analytics
    console.log('  📈 Getting usage analytics...');
    const analyticsResponse = await fetch(`${BASE_URL}/api/v1/monetization/usage/analytics?businessId=${TEST_BUSINESS_ID}&type=quota`);
    const analyticsResult = await analyticsResponse.json();
    if (analyticsResult.success) {
      console.log('  ✅ Usage analytics retrieved successfully');
    } else {
      console.log('  ❌ Failed to get usage analytics:', analyticsResult.error);
    }

  } catch (error) {
    console.log('  ❌ Usage API test failed:', error.message);
  }
}

async function testAddOnsAPI() {
  console.log('🧪 Testing Add-ons API...');
  
  try {
    // Test getting active add-ons
    console.log('  🛒 Getting active add-ons...');
    const addOnsResponse = await fetch(`${BASE_URL}/api/v1/monetization/addons?type=active`);
    const addOnsResult = await addOnsResponse.json();
    if (addOnsResult.success) {
      console.log(`  ✅ Retrieved ${addOnsResult.data.length} active add-ons`);
    } else {
      console.log('  ❌ Failed to get add-ons:', addOnsResult.error);
    }

    // Test getting business add-ons
    console.log('  👤 Getting business add-ons...');
    const businessAddOnsResponse = await fetch(`${BASE_URL}/api/v1/monetization/addons?type=business&businessId=${TEST_BUSINESS_ID}`);
    const businessAddOnsResult = await businessAddOnsResponse.json();
    if (businessAddOnsResult.success) {
      console.log(`  ✅ Retrieved ${businessAddOnsResult.data.length} business add-ons`);
    } else {
      console.log('  ❌ Failed to get business add-ons:', businessAddOnsResult.error);
    }

    // Test creating add-on
    console.log('  ➕ Creating test add-on...');
    const createResponse = await fetch(`${BASE_URL}/api/v1/monetization/addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_addon',
        ...testAddOn
      })
    });
    const createResult = await createResponse.json();
    if (createResult.success) {
      console.log('  ✅ Add-on created successfully');
    } else {
      console.log('  ❌ Failed to create add-on:', createResult.error);
    }

    // Test getting upsell campaigns
    console.log('  🎯 Getting upsell campaigns...');
    const campaignsResponse = await fetch(`${BASE_URL}/api/v1/monetization/addons?type=campaigns&businessId=${TEST_BUSINESS_ID}`);
    const campaignsResult = await campaignsResponse.json();
    if (campaignsResult.success) {
      console.log(`  ✅ Retrieved ${campaignsResult.data.length} upsell campaigns`);
    } else {
      console.log('  ❌ Failed to get upsell campaigns:', campaignsResult.error);
    }

  } catch (error) {
    console.log('  ❌ Add-ons API test failed:', error.message);
  }
}

async function testCustomPlansAPI() {
  console.log('🧪 Testing Custom Plans API...');
  
  try {
    // Test getting custom plan
    console.log('  🏢 Getting custom plan...');
    const getResponse = await fetch(`${BASE_URL}/api/v1/monetization/custom-plans?type=business&businessId=${TEST_BUSINESS_ID}`);
    const getResult = await getResponse.json();
    if (getResult.success) {
      console.log('  ✅ Custom plan retrieved successfully');
    } else {
      console.log('  ❌ Failed to get custom plan:', getResult.error);
    }

    // Test creating custom plan
    console.log('  ➕ Creating custom plan...');
    const createResponse = await fetch(`${BASE_URL}/api/v1/monetization/custom-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        ...testCustomPlan
      })
    });
    const createResult = await createResponse.json();
    if (createResult.success) {
      console.log('  ✅ Custom plan created successfully');
    } else {
      console.log('  ❌ Failed to create custom plan:', createResult.error);
    }

    // Test getting billing info
    console.log('  💳 Getting billing info...');
    const billingResponse = await fetch(`${BASE_URL}/api/v1/monetization/custom-plans?type=billing_info&businessId=${TEST_BUSINESS_ID}`);
    const billingResult = await billingResponse.json();
    if (billingResult.success) {
      console.log('  ✅ Billing info retrieved successfully');
    } else {
      console.log('  ❌ Failed to get billing info:', billingResult.error);
    }

  } catch (error) {
    console.log('  ❌ Custom Plans API test failed:', error.message);
  }
}

async function testInvoicesAPI() {
  console.log('🧪 Testing Invoices API...');
  
  try {
    // Test getting business invoices
    console.log('  📄 Getting business invoices...');
    const invoicesResponse = await fetch(`${BASE_URL}/api/v1/monetization/invoices?type=business&businessId=${TEST_BUSINESS_ID}`);
    const invoicesResult = await invoicesResponse.json();
    if (invoicesResult.success) {
      console.log(`  ✅ Retrieved ${invoicesResult.data.length} invoices`);
    } else {
      console.log('  ❌ Failed to get invoices:', invoicesResult.error);
    }

    // Test getting billing insights
    console.log('  📊 Getting billing insights...');
    const insightsResponse = await fetch(`${BASE_URL}/api/v1/monetization/invoices?type=insights&businessId=${TEST_BUSINESS_ID}`);
    const insightsResult = await insightsResponse.json();
    if (insightsResult.success) {
      console.log('  ✅ Billing insights retrieved successfully');
    } else {
      console.log('  ❌ Failed to get billing insights:', insightsResult.error);
    }

    // Test getting billing alerts
    console.log('  🚨 Getting billing alerts...');
    const alertsResponse = await fetch(`${BASE_URL}/api/v1/monetization/invoices?type=alerts&businessId=${TEST_BUSINESS_ID}`);
    const alertsResult = await alertsResponse.json();
    if (alertsResult.success) {
      console.log(`  ✅ Retrieved ${alertsResult.data.length} billing alerts`);
    } else {
      console.log('  ❌ Failed to get billing alerts:', alertsResult.error);
    }

  } catch (error) {
    console.log('  ❌ Invoices API test failed:', error.message);
  }
}

async function testBillingInsightsAPI() {
  console.log('🧪 Testing Billing Insights API...');
  
  try {
    // Test getting comprehensive insights
    console.log('  📈 Getting comprehensive insights...');
    const insightsResponse = await fetch(`${BASE_URL}/api/v1/monetization/insights?businessId=${TEST_BUSINESS_ID}&type=comprehensive&startDate=2024-01-01&endDate=2024-01-31`);
    const insightsResult = await insightsResponse.json();
    if (insightsResult.success) {
      console.log('  ✅ Comprehensive insights retrieved successfully');
    } else {
      console.log('  ❌ Failed to get comprehensive insights:', insightsResult.error);
    }

    // Test getting KPIs
    console.log('  📊 Getting billing KPIs...');
    const kpisResponse = await fetch(`${BASE_URL}/api/v1/monetization/insights?businessId=${TEST_BUSINESS_ID}&type=kpis`);
    const kpisResult = await kpisResponse.json();
    if (kpisResult.success) {
      console.log('  ✅ Billing KPIs retrieved successfully');
    } else {
      console.log('  ❌ Failed to get billing KPIs:', kpisResult.error);
    }

    // Test getting monthly spend data
    console.log('  💰 Getting monthly spend data...');
    const spendResponse = await fetch(`${BASE_URL}/api/v1/monetization/insights?businessId=${TEST_BUSINESS_ID}&type=monthly_spend&startDate=2024-01-01&endDate=2024-01-31`);
    const spendResult = await spendResponse.json();
    if (spendResult.success) {
      console.log('  ✅ Monthly spend data retrieved successfully');
    } else {
      console.log('  ❌ Failed to get monthly spend data:', spendResult.error);
    }

  } catch (error) {
    console.log('  ❌ Billing Insights API test failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Phase 4D-2 Backend Testing...\n');
  
  await testUsageAPI();
  console.log('');
  
  await testAddOnsAPI();
  console.log('');
  
  await testCustomPlansAPI();
  console.log('');
  
  await testInvoicesAPI();
  console.log('');
  
  await testBillingInsightsAPI();
  console.log('');
  
  console.log('🎉 Backend testing complete!');
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testUsageAPI,
  testAddOnsAPI,
  testCustomPlansAPI,
  testInvoicesAPI,
  testBillingInsightsAPI,
  runAllTests
};
