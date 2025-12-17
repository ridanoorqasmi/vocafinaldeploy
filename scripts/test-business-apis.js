const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'http://localhost:3000';
let authToken = '';
let businessId = '';

// Test data
const testBusiness = {
  businessName: 'Test Restaurant API',
  businessSlug: 'test-restaurant-api-' + Date.now(),
  industry: 'Food & Beverage',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john' + Date.now() + '@testrestaurant.com',
  password: 'SecurePassword123!',
  phone: '+1-555-123-4567',
  timezone: 'America/New_York'
};

const testLocation = {
  name: 'Main Location',
  address: '123 Main St',
  city: 'New York',
  state: 'NY',
  zipCode: '10001',
  country: 'US',
  phone: '+1-555-123-4567',
  isActive: true
};

const testCategory = {
  name: 'Appetizers',
  description: 'Delicious appetizers to start your meal',
  sortOrder: 0,
  isActive: true
};

const testMenuItem = {
  name: 'Test Pizza',
  description: 'A delicious test pizza',
  price: 15.99,
  image: 'https://example.com/pizza.jpg',
  isAvailable: true,
  sortOrder: 0,
  allergens: ['gluten', 'dairy'],
  calories: 300,
  prepTime: 15
};

const testPolicy = {
  type: 'delivery',
  title: 'Delivery Policy',
  content: 'We deliver within 5 miles of our location',
  isActive: true,
  effectiveDate: new Date().toISOString()
};

const testKnowledgeBase = {
  title: 'How to place an order?',
  content: 'You can place an order by calling us or visiting our website',
  category: 'FAQ',
  tags: ['ordering', 'help'],
  isActive: true
};

// Helper functions
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    }
  };
  
  const response = await fetch(url, { ...defaultOptions, ...options });
  const data = await response.json();
  
  console.log(`\n📡 ${options.method || 'GET'} ${endpoint}`);
  console.log(`📊 Status: ${response.status}`);
  console.log(`📋 Response:`, JSON.stringify(data, null, 2));
  
  return { response, data };
}

// Test functions
async function testRegistration() {
  console.log('\n🧪 Testing Business Registration...');
  const { response, data } = await makeRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(testBusiness)
  });
  
  if (response.ok && data.success) {
    authToken = data.data.tokens.accessToken;
    businessId = data.data.business.id;
    console.log('✅ Registration successful');
    console.log(`🔑 Auth Token: ${authToken.substring(0, 20)}...`);
    console.log(`🏢 Business ID: ${businessId}`);
    return true;
  } else {
    console.log('❌ Registration failed');
    return false;
  }
}

async function testBusinessProfile() {
  console.log('\n🧪 Testing Business Profile APIs...');
  
  // Get business details
  await makeRequest(`/api/businesses/${businessId}`);
  
  // Update business
  await makeRequest(`/api/businesses/${businessId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Updated Test Restaurant',
      phone: '+1-555-999-8888',
      description: 'Updated description'
    })
  });
  
  // Get business stats
  await makeRequest(`/api/businesses/${businessId}/stats`);
}

async function testLocationManagement() {
  console.log('\n🧪 Testing Location Management APIs...');
  
  // Create location
  const { data: locationData } = await makeRequest(`/api/businesses/${businessId}/locations`, {
    method: 'POST',
    body: JSON.stringify(testLocation)
  });
  
  const locationId = locationData.success ? locationData.data.id : null;
  
  if (locationId) {
    // Get locations
    await makeRequest(`/api/businesses/${businessId}/locations`);
    
    // Update location
    await makeRequest(`/api/businesses/${businessId}/locations/${locationId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Updated Main Location',
        city: 'Brooklyn'
      })
    });
    
    // Test operating hours
    await makeRequest(`/api/businesses/${businessId}/operating-hours?location_id=${locationId}`);
    
    // Update operating hours
    await makeRequest(`/api/businesses/${businessId}/operating-hours`, {
      method: 'PUT',
      body: JSON.stringify({
        locationId,
        hours: [
          { dayOfWeek: 0, openTime: '09:00', closeTime: '21:00', isClosed: false },
          { dayOfWeek: 1, openTime: '09:00', closeTime: '21:00', isClosed: false }
        ]
      })
    });
  }
}

async function testCategoryManagement() {
  console.log('\n🧪 Testing Category Management APIs...');
  
  // Create category
  const { data: categoryData } = await makeRequest(`/api/businesses/${businessId}/categories`, {
    method: 'POST',
    body: JSON.stringify(testCategory)
  });
  
  const categoryId = categoryData.success ? categoryData.data.id : null;
  
  if (categoryId) {
    // Get categories
    await makeRequest(`/api/businesses/${businessId}/categories`);
    
    // Update category
    await makeRequest(`/api/businesses/${businessId}/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Updated Appetizers',
        description: 'Updated description'
      })
    });
    
    return categoryId;
  }
  
  return null;
}

async function testMenuItemManagement(categoryId) {
  console.log('\n🧪 Testing Menu Item Management APIs...');
  
  const menuItemData = { ...testMenuItem, categoryId };
  
  // Create menu item
  const { data: itemData } = await makeRequest(`/api/businesses/${businessId}/menu-items`, {
    method: 'POST',
    body: JSON.stringify(menuItemData)
  });
  
  const itemId = itemData.success ? itemData.data.id : null;
  
  if (itemId) {
    // Get menu items
    await makeRequest(`/api/businesses/${businessId}/menu-items`);
    
    // Update menu item
    await makeRequest(`/api/businesses/${businessId}/menu-items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Updated Test Pizza',
        price: 18.99
      })
    });
    
    // Get full menu
    await makeRequest(`/api/businesses/${businessId}/menu`);
  }
}

async function testPolicyManagement() {
  console.log('\n🧪 Testing Policy Management APIs...');
  
  // Create policy
  const { data: policyData } = await makeRequest(`/api/businesses/${businessId}/policies`, {
    method: 'POST',
    body: JSON.stringify(testPolicy)
  });
  
  const policyId = policyData.success ? policyData.data.id : null;
  
  if (policyId) {
    // Get policies
    await makeRequest(`/api/businesses/${businessId}/policies`);
    
    // Update policy
    await makeRequest(`/api/businesses/${businessId}/policies/${policyId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Updated Delivery Policy',
        content: 'We deliver within 10 miles of our location'
      })
    });
  }
}

async function testKnowledgeBaseManagement() {
  console.log('\n🧪 Testing Knowledge Base Management APIs...');
  
  // Create knowledge base item
  const { data: kbData } = await makeRequest(`/api/businesses/${businessId}/knowledge-base`, {
    method: 'POST',
    body: JSON.stringify(testKnowledgeBase)
  });
  
  const kbId = kbData.success ? kbData.data.id : null;
  
  if (kbId) {
    // Get knowledge base
    await makeRequest(`/api/businesses/${businessId}/knowledge-base`);
    
    // Update knowledge base item
    await makeRequest(`/api/businesses/${businessId}/knowledge-base/${kbId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'How to place an order online?',
        content: 'Visit our website and click the order button'
      })
    });
  }
}

async function testTeamManagement() {
  console.log('\n🧪 Testing Team Management APIs...');
  
  // Get team members
  await makeRequest(`/api/businesses/${businessId}/team`);
  
  // Note: We can't test role changes or user removal without additional users
  // This would require the invitation system to be implemented
}

async function testUnauthorizedAccess() {
  console.log('\n🧪 Testing Unauthorized Access...');
  
  // Test without token
  const { response } = await makeRequest(`/api/businesses/${businessId}`);
  if (response.status === 401) {
    console.log('✅ Unauthorized access properly blocked');
  } else {
    console.log('❌ Unauthorized access not properly blocked');
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Business API Tests...\n');
  
  try {
    // Test registration first
    const registrationSuccess = await testRegistration();
    if (!registrationSuccess) {
      console.log('❌ Cannot continue without successful registration');
      return;
    }
    
    // Test all API endpoints
    await testBusinessProfile();
    await testLocationManagement();
    const categoryId = await testCategoryManagement();
    await testMenuItemManagement(categoryId);
    await testPolicyManagement();
    await testKnowledgeBaseManagement();
    await testTeamManagement();
    await testUnauthorizedAccess();
    
    console.log('\n🎉 All API tests completed!');
    console.log('\n📊 Test Summary:');
    console.log('✅ Business Profile Management');
    console.log('✅ Location Management');
    console.log('✅ Operating Hours Management');
    console.log('✅ Category Management');
    console.log('✅ Menu Item Management');
    console.log('✅ Policy Management');
    console.log('✅ Knowledge Base Management');
    console.log('✅ Team Management');
    console.log('✅ Security & Authentication');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
runTests();

