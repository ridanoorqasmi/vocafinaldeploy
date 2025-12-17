// Simple test script for registration endpoint
const fetch = require('node-fetch');

async function testRegistration() {
  try {
    console.log('🧪 Testing registration endpoint...');
    
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessName: 'Test Restaurant',
        businessSlug: 'test-restaurant-' + Date.now(),
        industry: 'Food & Beverage',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john' + Date.now() + '@testrestaurant.com',
        password: 'SecurePassword123!',
        phone: '+1-555-123-4567',
        timezone: 'America/New_York'
      })
    });

    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Registration successful!');
    } else {
      console.log('❌ Registration failed:', data.error?.message);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testRegistration();
