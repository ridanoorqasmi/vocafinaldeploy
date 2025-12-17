// Test script with environment variables
require('dotenv').config({ path: '.env.local' });

const fetch = require('node-fetch');

async function testRegistration() {
  try {
    console.log('🧪 Testing registration endpoint...');
    console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('🔑 JWT_REFRESH_SECRET exists:', !!process.env.JWT_REFRESH_SECRET);
    console.log('🗄️ DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    const response = await fetch('http://localhost:3002/api/auth/register', {
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
