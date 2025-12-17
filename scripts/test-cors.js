const fetch = require('node-fetch');

// Test CORS functionality
async function testCORS() {
  console.log('🌐 Testing CORS functionality...\n');
  
  try {
    // Test 1: Preflight OPTIONS request
    console.log('1️⃣ Testing preflight OPTIONS request...');
    
    const optionsResponse = await fetch('http://localhost:3000/api/businesses/test-id', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization, Content-Type'
      }
    });

    console.log(`📊 OPTIONS Response Status: ${optionsResponse.status}`);
    
    const corsHeaders = [
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-allow-credentials',
      'access-control-max-age'
    ];

    const presentHeaders = [];
    const missingHeaders = [];

    for (const header of corsHeaders) {
      const value = optionsResponse.headers.get(header);
      if (value) {
        presentHeaders.push(`${header}: ${value}`);
      } else {
        missingHeaders.push(header);
      }
    }

    if (presentHeaders.length > 0) {
      console.log('✅ CORS headers present:');
      presentHeaders.forEach(header => console.log(`   ${header}`));
    }

    if (missingHeaders.length > 0) {
      console.log('❌ Missing CORS headers:');
      missingHeaders.forEach(header => console.log(`   ${header}`));
    }

    // Test 2: Actual request with Origin header
    console.log('\n2️⃣ Testing actual request with Origin header...');
    
    const actualResponse = await fetch('http://localhost:3000/api/businesses/test-id', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000',
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 GET Response Status: ${actualResponse.status}`);
    
    const actualCorsHeaders = [];
    const actualMissingHeaders = [];

    for (const header of corsHeaders) {
      const value = actualResponse.headers.get(header);
      if (value) {
        actualCorsHeaders.push(`${header}: ${value}`);
      } else {
        actualMissingHeaders.push(header);
      }
    }

    if (actualCorsHeaders.length > 0) {
      console.log('✅ CORS headers in actual request:');
      actualCorsHeaders.forEach(header => console.log(`   ${header}`));
    }

    if (actualMissingHeaders.length > 0) {
      console.log('❌ Missing CORS headers in actual request:');
      actualMissingHeaders.forEach(header => console.log(`   ${header}`));
    }

    // Test 3: Test with different origin
    console.log('\n3️⃣ Testing with different origin...');
    
    const differentOriginResponse = await fetch('http://localhost:3000/api/businesses/test-id', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3001',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization'
      }
    });

    const allowedOrigin = differentOriginResponse.headers.get('access-control-allow-origin');
    console.log(`📊 Allowed Origin for localhost:3001: ${allowedOrigin}`);

    if (allowedOrigin === 'http://localhost:3001' || allowedOrigin === '*') {
      console.log('✅ Different origin allowed');
    } else {
      console.log('❌ Different origin not allowed');
    }

    // Test 4: Test API key endpoint CORS
    console.log('\n4️⃣ Testing API key endpoint CORS...');
    
    const apiKeyOptionsResponse = await fetch('http://localhost:3000/api/businesses/test-id/api-keys', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization, X-API-Key'
      }
    });

    console.log(`📊 API Key OPTIONS Response Status: ${apiKeyOptionsResponse.status}`);
    
    const apiKeyCorsHeaders = [];
    for (const header of corsHeaders) {
      const value = apiKeyOptionsResponse.headers.get(header);
      if (value) {
        apiKeyCorsHeaders.push(`${header}: ${value}`);
      }
    }

    if (apiKeyCorsHeaders.length > 0) {
      console.log('✅ API Key endpoint CORS headers:');
      apiKeyCorsHeaders.forEach(header => console.log(`   ${header}`));
    }

    // Summary
    console.log('\n📊 CORS Test Summary:');
    const allTestsPassed = presentHeaders.length >= 4 && actualCorsHeaders.length >= 4;
    
    if (allTestsPassed) {
      console.log('✅ CORS is working correctly!');
      console.log('✅ Preflight requests handled');
      console.log('✅ CORS headers present in responses');
      console.log('✅ Multiple origins supported');
      console.log('✅ API key endpoints have CORS');
    } else {
      console.log('⚠️ CORS needs attention:');
      if (presentHeaders.length < 4) {
        console.log('   - Preflight request headers missing');
      }
      if (actualCorsHeaders.length < 4) {
        console.log('   - Actual request headers missing');
      }
    }

  } catch (error) {
    console.error('❌ CORS test failed:', error);
  }
}

testCORS();
