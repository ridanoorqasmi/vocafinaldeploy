#!/usr/bin/env node

/**
 * Frontend testing script for Phase 4D-2 Monetization Enhancements
 * Tests frontend components and user interactions
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const TEST_BUSINESS_ID = 'test-business-123';

class FrontendTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.screenshots = [];
  }

  async setup() {
    console.log('🌐 Setting up browser for frontend testing...');
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      defaultViewport: { width: 1280, height: 720 }
    });
    this.page = await this.browser.newPage();
    
    // Set up console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('  🚨 Browser Error:', msg.text());
      }
    });
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async takeScreenshot(name) {
    const screenshotPath = `screenshots/monetization-${name}-${Date.now()}.png`;
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    this.screenshots.push(screenshotPath);
    console.log(`  📸 Screenshot saved: ${screenshotPath}`);
  }

  async testBillingInsightsDashboard() {
    console.log('🧪 Testing Billing Insights Dashboard...');
    
    try {
      // Navigate to billing insights page
      console.log('  📊 Navigating to billing insights...');
      await this.page.goto(`${BASE_URL}/billing/insights`);
      await this.page.waitForSelector('[data-testid="billing-insights-dashboard"]', { timeout: 10000 });
      await this.takeScreenshot('billing-insights-dashboard');

      // Check for summary cards
      console.log('  💳 Checking summary cards...');
      const summaryCards = await this.page.$$('[data-testid="summary-card"]');
      if (summaryCards.length > 0) {
        console.log(`  ✅ Found ${summaryCards.length} summary cards`);
      } else {
        console.log('  ⚠️  No summary cards found');
      }

      // Check for charts
      console.log('  📈 Checking charts...');
      const charts = await this.page.$$('.recharts-wrapper');
      if (charts.length > 0) {
        console.log(`  ✅ Found ${charts.length} charts`);
      } else {
        console.log('  ⚠️  No charts found');
      }

      // Test tab navigation
      console.log('  🔄 Testing tab navigation...');
      const tabs = ['overview', 'usage', 'spending', 'savings', 'invoices'];
      for (const tab of tabs) {
        try {
          await this.page.click(`[data-testid="tab-${tab}"]`);
          await this.page.waitForTimeout(1000);
          console.log(`  ✅ Tab '${tab}' clicked successfully`);
        } catch (error) {
          console.log(`  ⚠️  Tab '${tab}' not found or clickable`);
        }
      }

      // Check for recommendations
      console.log('  💡 Checking recommendations...');
      const recommendations = await this.page.$$('[data-testid="recommendation"]');
      if (recommendations.length > 0) {
        console.log(`  ✅ Found ${recommendations.length} recommendations`);
      } else {
        console.log('  ℹ️  No recommendations displayed');
      }

    } catch (error) {
      console.log('  ❌ Billing Insights Dashboard test failed:', error.message);
    }
  }

  async testAddOnsManager() {
    console.log('🧪 Testing Add-ons Manager...');
    
    try {
      // Navigate to add-ons page
      console.log('  🛒 Navigating to add-ons page...');
      await this.page.goto(`${BASE_URL}/billing/add-ons`);
      await this.page.waitForSelector('[data-testid="add-ons-manager"]', { timeout: 10000 });
      await this.takeScreenshot('add-ons-manager');

      // Check for available add-ons
      console.log('  📦 Checking available add-ons...');
      const addOnCards = await this.page.$$('[data-testid="add-on-card"]');
      if (addOnCards.length > 0) {
        console.log(`  ✅ Found ${addOnCards.length} add-on cards`);
      } else {
        console.log('  ⚠️  No add-on cards found');
      }

      // Test add-on purchase flow
      console.log('  💳 Testing add-on purchase flow...');
      const purchaseButtons = await this.page.$$('[data-testid="purchase-addon-button"]');
      if (purchaseButtons.length > 0) {
        await purchaseButtons[0].click();
        await this.page.waitForSelector('[data-testid="purchase-dialog"]', { timeout: 5000 });
        console.log('  ✅ Purchase dialog opened successfully');
        
        // Close dialog
        const closeButton = await this.page.$('[data-testid="close-dialog"]');
        if (closeButton) {
          await closeButton.click();
          console.log('  ✅ Purchase dialog closed successfully');
        }
      } else {
        console.log('  ⚠️  No purchase buttons found');
      }

      // Check for upsell campaigns
      console.log('  🎯 Checking upsell campaigns...');
      const campaignCards = await this.page.$$('[data-testid="upsell-campaign"]');
      if (campaignCards.length > 0) {
        console.log(`  ✅ Found ${campaignCards.length} upsell campaigns`);
      } else {
        console.log('  ℹ️  No upsell campaigns displayed');
      }

      // Test create add-on dialog
      console.log('  ➕ Testing create add-on dialog...');
      const createButton = await this.page.$('[data-testid="create-addon-button"]');
      if (createButton) {
        await createButton.click();
        await this.page.waitForSelector('[data-testid="create-addon-dialog"]', { timeout: 5000 });
        console.log('  ✅ Create add-on dialog opened successfully');
        
        // Fill form
        await this.page.type('[data-testid="addon-name-input"]', 'Test Add-on');
        await this.page.type('[data-testid="addon-description-input"]', 'Test description');
        await this.page.type('[data-testid="addon-price-input"]', '1000');
        
        // Close dialog
        const cancelButton = await this.page.$('[data-testid="cancel-create-addon"]');
        if (cancelButton) {
          await cancelButton.click();
          console.log('  ✅ Create add-on dialog closed successfully');
        }
      } else {
        console.log('  ⚠️  No create add-on button found');
      }

    } catch (error) {
      console.log('  ❌ Add-ons Manager test failed:', error.message);
    }
  }

  async testUsageTracker() {
    console.log('🧪 Testing Usage Tracker...');
    
    try {
      // Navigate to usage page
      console.log('  📊 Navigating to usage page...');
      await this.page.goto(`${BASE_URL}/billing/usage`);
      await this.page.waitForSelector('[data-testid="usage-tracker"]', { timeout: 10000 });
      await this.takeScreenshot('usage-tracker');

      // Check for usage cards
      console.log('  📈 Checking usage cards...');
      const usageCards = await this.page.$$('[data-testid="usage-card"]');
      if (usageCards.length > 0) {
        console.log(`  ✅ Found ${usageCards.length} usage cards`);
      } else {
        console.log('  ⚠️  No usage cards found');
      }

      // Check for progress bars
      console.log('  📊 Checking progress bars...');
      const progressBars = await this.page.$$('.progress');
      if (progressBars.length > 0) {
        console.log(`  ✅ Found ${progressBars.length} progress bars`);
      } else {
        console.log('  ⚠️  No progress bars found');
      }

      // Test tab navigation
      console.log('  🔄 Testing tab navigation...');
      const tabs = ['overview', 'analytics', 'trends', 'alerts'];
      for (const tab of tabs) {
        try {
          await this.page.click(`[data-testid="tab-${tab}"]`);
          await this.page.waitForTimeout(1000);
          console.log(`  ✅ Tab '${tab}' clicked successfully`);
        } catch (error) {
          console.log(`  ⚠️  Tab '${tab}' not found or clickable`);
        }
      }

      // Check for usage alerts
      console.log('  🚨 Checking usage alerts...');
      const alerts = await this.page.$$('[data-testid="usage-alert"]');
      if (alerts.length > 0) {
        console.log(`  ✅ Found ${alerts.length} usage alerts`);
      } else {
        console.log('  ℹ️  No usage alerts displayed');
      }

    } catch (error) {
      console.log('  ❌ Usage Tracker test failed:', error.message);
    }
  }

  async testResponsiveDesign() {
    console.log('🧪 Testing Responsive Design...');
    
    try {
      // Test mobile viewport
      console.log('  📱 Testing mobile viewport...');
      await this.page.setViewport({ width: 375, height: 667 });
      await this.page.goto(`${BASE_URL}/billing/insights`);
      await this.page.waitForTimeout(2000);
      await this.takeScreenshot('mobile-billing-insights');

      // Test tablet viewport
      console.log('  📱 Testing tablet viewport...');
      await this.page.setViewport({ width: 768, height: 1024 });
      await this.page.goto(`${BASE_URL}/billing/add-ons`);
      await this.page.waitForTimeout(2000);
      await this.takeScreenshot('tablet-add-ons');

      // Test desktop viewport
      console.log('  💻 Testing desktop viewport...');
      await this.page.setViewport({ width: 1280, height: 720 });
      await this.page.goto(`${BASE_URL}/billing/usage`);
      await this.page.waitForTimeout(2000);
      await this.takeScreenshot('desktop-usage-tracker');

      console.log('  ✅ Responsive design tests completed');

    } catch (error) {
      console.log('  ❌ Responsive design test failed:', error.message);
    }
  }

  async testErrorHandling() {
    console.log('🧪 Testing Error Handling...');
    
    try {
      // Test with invalid business ID
      console.log('  🚫 Testing with invalid business ID...');
      await this.page.goto(`${BASE_URL}/billing/insights?businessId=invalid-id`);
      await this.page.waitForTimeout(3000);
      
      const errorMessage = await this.page.$('[data-testid="error-message"]');
      if (errorMessage) {
        console.log('  ✅ Error message displayed for invalid business ID');
      } else {
        console.log('  ⚠️  No error message found for invalid business ID');
      }

      // Test network error simulation
      console.log('  🌐 Testing network error handling...');
      await this.page.setOfflineMode(true);
      await this.page.goto(`${BASE_URL}/billing/insights`);
      await this.page.waitForTimeout(3000);
      
      const offlineMessage = await this.page.$('[data-testid="offline-message"]');
      if (offlineMessage) {
        console.log('  ✅ Offline message displayed');
      } else {
        console.log('  ⚠️  No offline message found');
      }

      await this.page.setOfflineMode(false);
      console.log('  ✅ Error handling tests completed');

    } catch (error) {
      console.log('  ❌ Error handling test failed:', error.message);
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Phase 4D-2 Frontend Testing...\n');
    
    // Create screenshots directory
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots');
    }

    await this.setup();
    
    await this.testBillingInsightsDashboard();
    console.log('');
    
    await this.testAddOnsManager();
    console.log('');
    
    await this.testUsageTracker();
    console.log('');
    
    await this.testResponsiveDesign();
    console.log('');
    
    await this.testErrorHandling();
    console.log('');
    
    await this.teardown();
    
    console.log('🎉 Frontend testing complete!');
    console.log(`📸 Screenshots saved: ${this.screenshots.length} files`);
    this.screenshots.forEach(screenshot => {
      console.log(`  - ${screenshot}`);
    });
  }
}

// Run tests
if (require.main === module) {
  const tester = new FrontendTester();
  tester.runAllTests().catch(console.error);
}

module.exports = FrontendTester;
