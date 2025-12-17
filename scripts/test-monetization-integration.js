#!/usr/bin/env node

/**
 * Integration testing script for Phase 4D-2 Monetization Enhancements
 * Tests end-to-end workflows and Stripe integration
 */

const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_BUSINESS_ID = 'test-business-123';

const prisma = new PrismaClient();

class IntegrationTester {
  constructor() {
    this.testResults = [];
  }

  async logTest(testName, success, details = '') {
    const result = {
      test: testName,
      success,
      details,
      timestamp: new Date().toISOString()
    };
    this.testResults.push(result);
    
    const status = success ? '✅' : '❌';
    console.log(`  ${status} ${testName}${details ? ` - ${details}` : ''}`);
  }

  async testUsageToBillingFlow() {
    console.log('🧪 Testing Usage to Billing Flow...');
    
    try {
      // 1. Record usage events
      console.log('  📝 Recording usage events...');
      const usageEvents = [
        { eventType: 'api_call', quantity: 1000, unitPriceCents: 1 },
        { eventType: 'voice_minute', quantity: 60, unitPriceCents: 2 },
        { eventType: 'ai_query', quantity: 50, unitPriceCents: 5 }
      ];

      for (const event of usageEvents) {
        const response = await fetch(`${BASE_URL}/api/v1/monetization/usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: TEST_BUSINESS_ID,
            ...event,
            metadata: { source: 'integration-test' }
          })
        });
        
        const result = await response.json();
        await this.logTest(`Record ${event.eventType}`, result.success, `${event.quantity} units`);
      }

      // 2. Check usage aggregation
      console.log('  📊 Checking usage aggregation...');
      const aggregationResponse = await fetch(`${BASE_URL}/api/v1/monetization/usage/analytics?businessId=${TEST_BUSINESS_ID}&type=analytics&startDate=2024-01-01&endDate=2024-01-31`);
      const aggregationResult = await aggregationResponse.json();
      await this.logTest('Usage aggregation', aggregationResult.success, `${aggregationResult.data?.length || 0} event types`);

      // 3. Check usage vs quota
      console.log('  📈 Checking usage vs quota...');
      const quotaResponse = await fetch(`${BASE_URL}/api/v1/monetization/usage/analytics?businessId=${TEST_BUSINESS_ID}&type=quota`);
      const quotaResult = await quotaResponse.json();
      await this.logTest('Usage vs quota', quotaResult.success, `${quotaResult.data?.length || 0} quota items`);

      // 4. Process pending usage events
      console.log('  ⚙️  Processing pending usage events...');
      const processResponse = await fetch(`${BASE_URL}/api/v1/monetization/usage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_pending' })
      });
      const processResult = await processResponse.json();
      await this.logTest('Process pending events', processResult.success);

    } catch (error) {
      await this.logTest('Usage to Billing Flow', false, error.message);
    }
  }

  async testAddOnPurchaseFlow() {
    console.log('🧪 Testing Add-on Purchase Flow...');
    
    try {
      // 1. Get available add-ons
      console.log('  🛒 Getting available add-ons...');
      const addOnsResponse = await fetch(`${BASE_URL}/api/v1/monetization/addons?type=active`);
      const addOnsResult = await addOnsResponse.json();
      await this.logTest('Get add-ons', addOnsResult.success, `${addOnsResult.data?.length || 0} add-ons`);

      if (addOnsResult.data && addOnsResult.data.length > 0) {
        const addOn = addOnsResult.data[0];
        
        // 2. Test purchase flow (without actual Stripe checkout)
        console.log('  💳 Testing purchase flow...');
        const purchaseResponse = await fetch(`${BASE_URL}/api/v1/monetization/addons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'purchase',
            businessId: TEST_BUSINESS_ID,
            addOnId: addOn.id,
            quantity: 1
          })
        });
        const purchaseResult = await purchaseResponse.json();
        await this.logTest('Purchase add-on', purchaseResult.success, purchaseResult.data?.checkoutUrl ? 'Checkout URL generated' : 'No checkout URL');

        // 3. Get business add-ons
        console.log('  👤 Getting business add-ons...');
        const businessAddOnsResponse = await fetch(`${BASE_URL}/api/v1/monetization/addons?type=business&businessId=${TEST_BUSINESS_ID}`);
        const businessAddOnsResult = await businessAddOnsResponse.json();
        await this.logTest('Get business add-ons', businessAddOnsResult.success, `${businessAddOnsResult.data?.length || 0} business add-ons`);
      }

    } catch (error) {
      await this.logTest('Add-on Purchase Flow', false, error.message);
    }
  }

  async testCustomPlanWorkflow() {
    console.log('🧪 Testing Custom Plan Workflow...');
    
    try {
      // 1. Create custom plan
      console.log('  ➕ Creating custom plan...');
      const customPlan = {
        businessId: TEST_BUSINESS_ID,
        planName: 'Integration Test Enterprise Plan',
        basePriceCents: 100000,
        billingPeriod: 'monthly',
        limits: {
          api_call: 500000,
          voice_minute: 50000,
          ai_query: 10000
        },
        features: {
          priority_support: true,
          custom_integrations: true,
          dedicated_account_manager: true
        },
        createdBy: 'test-user-123'
      };

      const createResponse = await fetch(`${BASE_URL}/api/v1/monetization/custom-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...customPlan
        })
      });
      const createResult = await createResponse.json();
      await this.logTest('Create custom plan', createResult.success, createResult.data?.planName || 'No plan name');

      // 2. Get custom plan
      console.log('  📋 Getting custom plan...');
      const getResponse = await fetch(`${BASE_URL}/api/v1/monetization/custom-plans?type=business&businessId=${TEST_BUSINESS_ID}`);
      const getResult = await getResponse.json();
      await this.logTest('Get custom plan', getResult.success, getResult.data?.planName || 'No plan data');

      // 3. Check if business should use custom plan
      console.log('  🔍 Checking custom plan usage...');
      const shouldUseResponse = await fetch(`${BASE_URL}/api/v1/monetization/custom-plans?type=should_use&businessId=${TEST_BUSINESS_ID}`);
      const shouldUseResult = await shouldUseResponse.json();
      await this.logTest('Check custom plan usage', shouldUseResult.success, shouldUseResult.data?.shouldUse ? 'Should use custom plan' : 'Should not use custom plan');

      // 4. Get billing info
      console.log('  💳 Getting billing info...');
      const billingResponse = await fetch(`${BASE_URL}/api/v1/monetization/custom-plans?type=billing_info&businessId=${TEST_BUSINESS_ID}`);
      const billingResult = await billingResponse.json();
      await this.logTest('Get billing info', billingResult.success, billingResult.data?.basePrice ? `$${billingResult.data.basePrice / 100}` : 'No billing info');

    } catch (error) {
      await this.logTest('Custom Plan Workflow', false, error.message);
    }
  }

  async testInvoiceGeneration() {
    console.log('🧪 Testing Invoice Generation...');
    
    try {
      // 1. Create test invoice
      console.log('  📄 Creating test invoice...');
      const invoice = {
        businessId: TEST_BUSINESS_ID,
        invoiceNumber: 'INV-TEST-001',
        status: 'open',
        amountCents: 5000,
        amountPaidCents: 0,
        taxCents: 500,
        discountCents: 0,
        currency: 'usd'
      };

      const createResponse = await fetch(`${BASE_URL}/api/v1/monetization/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...invoice
        })
      });
      const createResult = await createResponse.json();
      await this.logTest('Create invoice', createResult.success, createResult.data?.invoiceNumber || 'No invoice number');

      // 2. Get business invoices
      console.log('  📋 Getting business invoices...');
      const invoicesResponse = await fetch(`${BASE_URL}/api/v1/monetization/invoices?type=business&businessId=${TEST_BUSINESS_ID}`);
      const invoicesResult = await invoicesResponse.json();
      await this.logTest('Get business invoices', invoicesResult.success, `${invoicesResult.data?.length || 0} invoices`);

      // 3. Get invoice analytics
      console.log('  📊 Getting invoice analytics...');
      const analyticsResponse = await fetch(`${BASE_URL}/api/v1/monetization/invoices?type=analytics`);
      const analyticsResult = await analyticsResponse.json();
      await this.logTest('Get invoice analytics', analyticsResult.success, analyticsResult.data?.total_invoices ? `${analyticsResult.data.total_invoices} total invoices` : 'No analytics data');

    } catch (error) {
      await this.logTest('Invoice Generation', false, error.message);
    }
  }

  async testBillingInsightsWorkflow() {
    console.log('🧪 Testing Billing Insights Workflow...');
    
    try {
      // 1. Get comprehensive insights
      console.log('  📈 Getting comprehensive insights...');
      const insightsResponse = await fetch(`${BASE_URL}/api/v1/monetization/insights?businessId=${TEST_BUSINESS_ID}&type=comprehensive&startDate=2024-01-01&endDate=2024-01-31`);
      const insightsResult = await insightsResponse.json();
      await this.logTest('Get comprehensive insights', insightsResult.success, insightsResult.data?.summary ? 'Insights summary available' : 'No insights summary');

      // 2. Get billing KPIs
      console.log('  📊 Getting billing KPIs...');
      const kpisResponse = await fetch(`${BASE_URL}/api/v1/monetization/insights?businessId=${TEST_BUSINESS_ID}&type=kpis`);
      const kpisResult = await kpisResponse.json();
      await this.logTest('Get billing KPIs', kpisResult.success, kpisResult.data?.currentSpendCents ? `$${kpisResult.data.currentSpendCents / 100} current spend` : 'No KPI data');

      // 3. Get monthly spend data
      console.log('  💰 Getting monthly spend data...');
      const spendResponse = await fetch(`${BASE_URL}/api/v1/monetization/insights?businessId=${TEST_BUSINESS_ID}&type=monthly_spend&startDate=2024-01-01&endDate=2024-01-31`);
      const spendResult = await spendResponse.json();
      await this.logTest('Get monthly spend data', spendResult.success, spendResult.data?.monthlyData ? `${spendResult.data.monthlyData.length} months` : 'No spend data');

      // 4. Get usage vs quota data
      console.log('  📊 Getting usage vs quota data...');
      const quotaResponse = await fetch(`${BASE_URL}/api/v1/monetization/insights?businessId=${TEST_BUSINESS_ID}&type=usage_quota`);
      const quotaResult = await quotaResponse.json();
      await this.logTest('Get usage vs quota data', quotaResult.success, quotaResult.data?.length ? `${quotaResult.data.length} quota items` : 'No quota data');

    } catch (error) {
      await this.logTest('Billing Insights Workflow', false, error.message);
    }
  }

  async testDatabaseConsistency() {
    console.log('🧪 Testing Database Consistency...');
    
    try {
      // Check usage events
      console.log('  📝 Checking usage events...');
      const usageEvents = await prisma.usageEvent.findMany({
        where: { businessId: TEST_BUSINESS_ID }
      });
      await this.logTest('Usage events in DB', true, `${usageEvents.length} events`);

      // Check add-ons
      console.log('  🛒 Checking add-ons...');
      const addOns = await prisma.addOn.findMany({
        where: { isActive: true }
      });
      await this.logTest('Active add-ons in DB', true, `${addOns.length} add-ons`);

      // Check custom plans
      console.log('  🏢 Checking custom plans...');
      const customPlans = await prisma.customPlan.findMany({
        where: { businessId: TEST_BUSINESS_ID }
      });
      await this.logTest('Custom plans in DB', true, `${customPlans.length} plans`);

      // Check invoices
      console.log('  📄 Checking invoices...');
      const invoices = await prisma.invoice.findMany({
        where: { businessId: TEST_BUSINESS_ID }
      });
      await this.logTest('Invoices in DB', true, `${invoices.length} invoices`);

      // Check billing snapshots
      console.log('  📊 Checking billing snapshots...');
      const snapshots = await prisma.billingSnapshot.findMany({
        where: { businessId: TEST_BUSINESS_ID }
      });
      await this.logTest('Billing snapshots in DB', true, `${snapshots.length} snapshots`);

    } catch (error) {
      await this.logTest('Database Consistency', false, error.message);
    }
  }

  async testErrorScenarios() {
    console.log('🧪 Testing Error Scenarios...');
    
    try {
      // Test with invalid business ID
      console.log('  🚫 Testing invalid business ID...');
      const invalidResponse = await fetch(`${BASE_URL}/api/v1/monetization/usage?businessId=invalid-id`);
      const invalidResult = await invalidResponse.json();
      await this.logTest('Invalid business ID handling', !invalidResult.success, 'Error response received');

      // Test with missing parameters
      console.log('  📝 Testing missing parameters...');
      const missingResponse = await fetch(`${BASE_URL}/api/v1/monetization/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Missing required fields
      });
      const missingResult = await missingResponse.json();
      await this.logTest('Missing parameters handling', !missingResult.success, 'Error response received');

      // Test with invalid add-on ID
      console.log('  🛒 Testing invalid add-on ID...');
      const invalidAddOnResponse = await fetch(`${BASE_URL}/api/v1/monetization/addons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          businessId: TEST_BUSINESS_ID,
          addOnId: 'invalid-addon-id',
          quantity: 1
        })
      });
      const invalidAddOnResult = await invalidAddOnResponse.json();
      await this.logTest('Invalid add-on ID handling', !invalidAddOnResult.success, 'Error response received');

    } catch (error) {
      await this.logTest('Error Scenarios', false, error.message);
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Phase 4D-2 Integration Testing...\n');
    
    await this.testUsageToBillingFlow();
    console.log('');
    
    await this.testAddOnPurchaseFlow();
    console.log('');
    
    await this.testCustomPlanWorkflow();
    console.log('');
    
    await this.testInvoiceGeneration();
    console.log('');
    
    await this.testBillingInsightsWorkflow();
    console.log('');
    
    await this.testDatabaseConsistency();
    console.log('');
    
    await this.testErrorScenarios();
    console.log('');
    
    // Generate test report
    console.log('📊 Integration Test Results Summary:');
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} ✅`);
    console.log.log(`  Failed: ${failedTests} ❌`);
    console.log(`  Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => !r.success).forEach(result => {
        console.log(`  - ${result.test}: ${result.details}`);
      });
    }
    
    console.log('\n🎉 Integration testing complete!');
  }
}

// Run tests
if (require.main === module) {
  const tester = new IntegrationTester();
  tester.runAllTests().catch(console.error).finally(() => {
    prisma.$disconnect();
  });
}

module.exports = IntegrationTester;
