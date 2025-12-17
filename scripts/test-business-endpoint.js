const fetch = require('node-fetch');

// Test business API endpoint
async function testBusinessEndpoint() {
  try {
    // First, register a business to get a token
    console.log('🧪 Registering business to get auth token...');
    
    const registrationResponse = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessName: 'Test Business API',
        businessSlug: 'test-business-api-' + Date.now(),
        industry: 'Food & Beverage',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john' + Date.now() + '@testbusiness.com',
        password: 'SecurePassword123!',
        phone: '+1-555-123-4567',
        timezone: 'America/New_York'
      })
    });

    const registrationData = await registrationResponse.json();
    
    if (!registrationData.success) {
      console.log('❌ Registration failed:', registrationData);
      return;
    }

    const authToken = registrationData.data.tokens.accessToken;
    const businessId = registrationData.data.business.id;
    
    console.log('✅ Registration successful');
    console.log(`🔑 Auth Token: ${authToken.substring(0, 20)}...`);
    console.log(`🏢 Business ID: ${businessId}`);

    // Now test the business profile endpoint
    console.log('\n🧪 Testing business profile endpoint...');
    
    const businessResponse = await fetch(`http://localhost:3000/api/businesses/${businessId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      }
    });

    const businessData = await businessResponse.json();
    
    console.log(`📊 Response Status: ${businessResponse.status}`);
    console.log(`📋 Response Data:`, JSON.stringify(businessData, null, 2));
    
    if (businessResponse.ok && businessData.success) {
      console.log('✅ Business profile endpoint working!');
    } else {
      console.log('❌ Business profile endpoint failed');
    }

    // Test business stats endpoint
    console.log('\n🧪 Testing business stats endpoint...');
    
    const statsResponse = await fetch(`http://localhost:3000/api/businesses/${businessId}/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      }
    });

    const statsData = await statsResponse.json();
    
    console.log(`📊 Response Status: ${statsResponse.status}`);
    console.log(`📋 Response Data:`, JSON.stringify(statsData, null, 2));
    
    if (statsResponse.ok && statsData.success) {
      console.log('✅ Business stats endpoint working!');
    } else {
      console.log('❌ Business stats endpoint failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBusinessEndpoint();

