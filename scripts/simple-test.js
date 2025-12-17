// Simple test using built-in fetch
console.log('🧪 Testing registration endpoint...');

const testData = {
  businessName: 'Test Restaurant',
  businessSlug: 'test-restaurant-' + Date.now(),
  industry: 'Food & Beverage',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john' + Date.now() + '@testrestaurant.com',
  password: 'SecurePassword123!',
  phone: '+1-555-123-4567',
  timezone: 'America/New_York'
};

console.log('📤 Sending request to:', 'http://localhost:3002/api/auth/register');
console.log('📋 Request data:', JSON.stringify(testData, null, 2));

fetch('http://localhost:3002/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData)
})
.then(response => {
  console.log('📊 Response Status:', response.status);
  return response.json();
})
.then(data => {
  console.log('📋 Response Data:', JSON.stringify(data, null, 2));
  if (data.success) {
    console.log('✅ Registration successful!');
  } else {
    console.log('❌ Registration failed:', data.error?.message);
  }
})
.catch(error => {
  console.error('💥 Test failed:', error.message);
});
