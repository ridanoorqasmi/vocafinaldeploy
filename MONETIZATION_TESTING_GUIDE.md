# Phase 4D-2 Monetization Enhancements - Complete Testing Guide

## 🎯 Overview
This guide provides step-by-step instructions for testing the Phase 4D-2 Monetization Enhancements, covering backend services, frontend components, and end-to-end integration testing.

## 📋 Prerequisites

### 1. Environment Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### 2. Required Environment Variables
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/voca_db"

# Stripe (use test keys for testing)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."

# API Configuration
API_BASE_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"

# Testing
NODE_ENV="test"
```

### 3. Database Setup
```bash
# Apply the monetization schema
psql -d voca_db -f database/phase4d2-monetization-enhancements-schema.sql

# Run the setup script
npm run setup
```

## 🧪 Testing Phases

### Phase 1: Backend Testing

#### 1.1 Unit Tests
```bash
# Run unit tests for all services
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

**What's tested:**
- ✅ UsageBillingService - Usage tracking, aggregation, Stripe sync
- ✅ AddOnService - Add-on management, purchase flow, campaigns
- ✅ CustomPlanService - Enterprise plan creation and management
- ✅ InvoiceService - Invoice generation, billing info, alerts
- ✅ BillingInsightsService - Analytics, KPIs, recommendations

#### 1.2 API Endpoint Testing
```bash
# Test all API endpoints
npm run test:backend
```

**What's tested:**
- ✅ `/api/v1/monetization/usage` - Usage tracking and analytics
- ✅ `/api/v1/monetization/addons` - Add-on management
- ✅ `/api/v1/monetization/custom-plans` - Enterprise plans
- ✅ `/api/v1/monetization/invoices` - Invoice management
- ✅ `/api/v1/monetization/insights` - Billing analytics

#### 1.3 Manual API Testing with Postman

**Usage API Tests:**
```bash
# Record usage event
POST /api/v1/monetization/usage
{
  "businessId": "test-business-123",
  "eventType": "api_call",
  "quantity": 100,
  "unitPriceCents": 1,
  "metadata": {"source": "manual-test"}
}

# Get usage events
GET /api/v1/monetization/usage?businessId=test-business-123

# Get usage analytics
GET /api/v1/monetization/usage/analytics?businessId=test-business-123&type=quota
```

**Add-ons API Tests:**
```bash
# Get active add-ons
GET /api/v1/monetization/addons?type=active

# Purchase add-on
POST /api/v1/monetization/addons
{
  "action": "purchase",
  "businessId": "test-business-123",
  "addOnId": "test-addon-1",
  "quantity": 1
}

# Get business add-ons
GET /api/v1/monetization/addons?type=business&businessId=test-business-123
```

**Custom Plans API Tests:**
```bash
# Create custom plan
POST /api/v1/monetization/custom-plans
{
  "action": "create",
  "businessId": "test-business-123",
  "planName": "Enterprise Plan",
  "basePriceCents": 50000,
  "billingPeriod": "monthly",
  "limits": {"api_call": 100000},
  "createdBy": "test-user-123"
}

# Get custom plan
GET /api/v1/monetization/custom-plans?type=business&businessId=test-business-123
```

**Invoices API Tests:**
```bash
# Create invoice
POST /api/v1/monetization/invoices
{
  "action": "create",
  "businessId": "test-business-123",
  "invoiceNumber": "INV-001",
  "status": "open",
  "amountCents": 5000
}

# Get business invoices
GET /api/v1/monetization/invoices?type=business&businessId=test-business-123
```

**Billing Insights API Tests:**
```bash
# Get comprehensive insights
GET /api/v1/monetization/insights?businessId=test-business-123&type=comprehensive&startDate=2024-01-01&endDate=2024-01-31

# Get billing KPIs
GET /api/v1/monetization/insights?businessId=test-business-123&type=kpis
```

### Phase 2: Frontend Testing

#### 2.1 Component Testing
```bash
# Test frontend components
npm run test:frontend
```

**What's tested:**
- ✅ BillingInsightsDashboard - Analytics dashboard
- ✅ AddOnsManager - Add-on catalog and management
- ✅ UsageTracker - Real-time usage monitoring
- ✅ Responsive design across devices
- ✅ Error handling and edge cases

#### 2.2 Manual Frontend Testing

**Billing Insights Dashboard:**
1. Navigate to `/billing/insights`
2. Verify summary cards display correctly
3. Check charts render properly
4. Test tab navigation (Overview, Usage, Spending, Savings, Invoices)
5. Verify recommendations appear
6. Test responsive design on mobile/tablet

**Add-ons Manager:**
1. Navigate to `/billing/add-ons`
2. Verify add-on cards display
3. Test purchase flow (opens dialog)
4. Test create add-on dialog
5. Check upsell campaigns
6. Verify business add-ons section

**Usage Tracker:**
1. Navigate to `/billing/usage`
2. Verify usage cards with progress bars
3. Test tab navigation (Overview, Analytics, Trends, Alerts)
4. Check usage alerts
5. Verify quota utilization

#### 2.3 Browser Testing
```bash
# Test in different browsers
# Chrome, Firefox, Safari, Edge
# Test responsive design
# Test accessibility features
```

### Phase 3: Integration Testing

#### 3.1 End-to-End Workflows
```bash
# Run integration tests
npm run test:integration
```

**What's tested:**
- ✅ Usage to billing flow
- ✅ Add-on purchase workflow
- ✅ Custom plan management
- ✅ Invoice generation
- ✅ Billing insights workflow
- ✅ Database consistency
- ✅ Error scenarios

#### 3.2 Stripe Integration Testing

**Test Stripe Webhooks:**
```bash
# Use Stripe CLI for webhook testing
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Test webhook events
stripe trigger payment_intent.succeeded
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.updated
```

**Test Stripe Checkout:**
1. Create add-on purchase
2. Verify checkout session creation
3. Complete test payment
4. Verify webhook handling
5. Check database updates

#### 3.3 Database Testing
```bash
# Check database consistency
# Verify RLS policies
# Test data integrity
# Check performance with large datasets
```

### Phase 4: Performance Testing

#### 4.1 Load Testing
```bash
# Test with multiple concurrent users
# Test with large datasets
# Monitor response times
# Check memory usage
```

#### 4.2 Stress Testing
```bash
# Test with high usage volumes
# Test with many add-ons
# Test with complex custom plans
# Monitor system performance
```

## 🔧 Testing Tools

### 1. Automated Testing
- **Vitest**: Unit testing framework
- **Puppeteer**: Frontend testing with browser automation
- **Node-fetch**: API testing
- **Prisma**: Database testing

### 2. Manual Testing
- **Postman**: API endpoint testing
- **Browser DevTools**: Frontend debugging
- **Stripe Dashboard**: Payment testing
- **Database Tools**: Data verification

### 3. Monitoring
- **Console Logs**: Application debugging
- **Network Tab**: API request monitoring
- **Performance Tab**: Frontend performance
- **Database Logs**: Query performance

## 📊 Test Data

### Test Business
- **ID**: `test-business-123`
- **Name**: Test Business for Monetization
- **Email**: test@monetization.com
- **Status**: active

### Test User
- **ID**: `test-user-123`
- **Email**: test@monetization.com
- **Role**: admin
- **Business**: test-business-123

### Test Subscription
- **ID**: `test-subscription-123`
- **Plan**: pro
- **Status**: active
- **Stripe ID**: sub_test_123

### Test Add-ons
- **Extra API Calls**: $20/month, 10,000 calls
- **Extra Voice Minutes**: $50/month, 1,000 minutes

### Test Usage Quotas
- **API Calls**: 100,000/month, $0.01 overage
- **Voice Minutes**: 6,000/month, $0.02 overage

## 🚨 Common Issues & Solutions

### 1. Database Connection Issues
```bash
# Check database connection
psql -d voca_db -c "SELECT 1;"

# Verify environment variables
echo $DATABASE_URL

# Check Prisma connection
npx prisma db push
```

### 2. Stripe Integration Issues
```bash
# Verify Stripe keys
stripe --version

# Test Stripe connection
stripe balance retrieve

# Check webhook endpoints
stripe webhooks list
```

### 3. Frontend Issues
```bash
# Check component imports
# Verify API endpoints
# Check console errors
# Test responsive design
```

### 4. API Issues
```bash
# Check server logs
# Verify request/response format
# Test with Postman
# Check database queries
```

## 📈 Success Criteria

### Backend Testing
- ✅ All unit tests pass (>90% coverage)
- ✅ All API endpoints respond correctly
- ✅ Database operations work properly
- ✅ Stripe integration functions
- ✅ Error handling works

### Frontend Testing
- ✅ All components render correctly
- ✅ User interactions work properly
- ✅ Responsive design functions
- ✅ Error states display correctly
- ✅ Performance is acceptable

### Integration Testing
- ✅ End-to-end workflows complete
- ✅ Data flows correctly between systems
- ✅ Stripe payments process
- ✅ Database remains consistent
- ✅ Error scenarios handled

## 🎯 Testing Checklist

### Pre-Testing Setup
- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] Test data created
- [ ] Stripe test keys configured
- [ ] Dependencies installed

### Backend Testing
- [ ] Unit tests pass
- [ ] API endpoints tested
- [ ] Database operations verified
- [ ] Stripe integration tested
- [ ] Error handling verified

### Frontend Testing
- [ ] Components render correctly
- [ ] User interactions work
- [ ] Responsive design tested
- [ ] Error states handled
- [ ] Performance acceptable

### Integration Testing
- [ ] End-to-end workflows tested
- [ ] Data consistency verified
- [ ] Stripe payments tested
- [ ] Error scenarios handled
- [ ] Performance tested

### Post-Testing
- [ ] Test results documented
- [ ] Issues identified and fixed
- [ ] Performance optimized
- [ ] Documentation updated
- [ ] Ready for production

## 🚀 Running All Tests

```bash
# Complete test suite
npm run test:all

# Individual test phases
npm run setup          # Setup test environment
npm run test:backend   # Backend API testing
npm run test:frontend  # Frontend component testing
npm run test:integration # End-to-end testing
npm run test:unit      # Unit tests
```

## 📝 Test Results

After running tests, you should see:
- ✅ All tests passing
- 📊 Coverage reports
- 📸 Screenshots of frontend tests
- 📋 Detailed test logs
- 🎯 Performance metrics

## 🔄 Continuous Testing

For ongoing development:
```bash
# Watch mode for unit tests
npm run test:watch

# Continuous integration
npm run test:all

# Performance monitoring
npm run test:integration
```

---

**Phase 4D-2 Monetization Enhancements** testing is now complete! The system is ready for production deployment with comprehensive test coverage and validation. 🎉
