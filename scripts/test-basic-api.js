// Test basic API functionality
const fetch = require('node-fetch');

async function testBasicAPI() {
  try {
    console.log('🧪 Testing basic API endpoint...');
    
    const response = await fetch('http://localhost:3001/api/test', {
      method: 'GET'
    });

    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ Basic API is working!');
    } else {
      console.log('❌ Basic API failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testBasicAPI();
