// ===== SEARCH PERFORMANCE TEST SCRIPT =====

const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BUSINESS_TOKEN = process.env.BUSINESS_TOKEN || 'your_business_token_here';
const TEST_QUERIES = [
  'pizza delivery',
  'menu items',
  'delivery policy',
  'how to order',
  'contact information',
  'business hours',
  'payment methods',
  'refund policy',
  'special offers',
  'customer service'
];

// Performance metrics
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let totalResponseTime = 0;
let minResponseTime = Infinity;
let maxResponseTime = 0;
let responseTimes = [];

// Test configuration
const CONCURRENT_REQUESTS = 10;
const TOTAL_REQUESTS = 100;
const ENDPOINTS = [
  '/api/search/menu',
  '/api/search/policies',
  '/api/search/faqs',
  '/api/search/all'
];

/**
 * Make a search request
 */
async function makeSearchRequest(endpoint, query) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BUSINESS_TOKEN}`
      },
      body: JSON.stringify({
        query: query,
        topN: 5,
        minScore: 0.75,
        includeMetadata: true
      })
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        responseTime,
        data: data.data,
        cached: data.data?.cached || false
      };
    } else {
      return {
        success: false,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      success: false,
      responseTime,
      error: error.message
    };
  }
}

/**
 * Run a single test
 */
async function runSingleTest() {
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const query = TEST_QUERIES[Math.floor(Math.random() * TEST_QUERIES.length)];
  
  const result = await makeSearchRequest(endpoint, query);
  
  totalRequests++;
  if (result.success) {
    successfulRequests++;
  } else {
    failedRequests++;
    console.error(`Request failed: ${result.error}`);
  }
  
  totalResponseTime += result.responseTime;
  minResponseTime = Math.min(minResponseTime, result.responseTime);
  maxResponseTime = Math.max(maxResponseTime, result.responseTime);
  responseTimes.push(result.responseTime);
  
  return result;
}

/**
 * Run concurrent tests
 */
async function runConcurrentTests() {
  const promises = [];
  
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(runSingleTest());
  }
  
  await Promise.all(promises);
}

/**
 * Calculate statistics
 */
function calculateStats() {
  const averageResponseTime = totalResponseTime / totalRequests;
  const successRate = (successfulRequests / totalRequests) * 100;
  
  // Calculate percentiles
  responseTimes.sort((a, b) => a - b);
  const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
  const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
  const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
  
  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    successRate,
    averageResponseTime,
    minResponseTime,
    maxResponseTime,
    p50,
    p95,
    p99
  };
}

/**
 * Test cache performance
 */
async function testCachePerformance() {
  console.log('\n🧪 Testing Cache Performance...');
  
  const query = 'pizza delivery';
  const endpoint = '/api/search/menu';
  
  // First request (cache miss)
  console.log('Making first request (cache miss)...');
  const firstRequest = await makeSearchRequest(endpoint, query);
  
  // Second request (cache hit)
  console.log('Making second request (cache hit)...');
  const secondRequest = await makeSearchRequest(endpoint, query);
  
  console.log(`First request: ${firstRequest.responseTime}ms (cached: ${firstRequest.cached})`);
  console.log(`Second request: ${secondRequest.responseTime}ms (cached: ${secondRequest.cached})`);
  
  if (firstRequest.cached === false && secondRequest.cached === true) {
    console.log('✅ Cache is working correctly');
    console.log(`Cache speedup: ${((firstRequest.responseTime - secondRequest.responseTime) / firstRequest.responseTime * 100).toFixed(1)}%`);
  } else {
    console.log('⚠️  Cache may not be working as expected');
  }
}

/**
 * Test search accuracy
 */
async function testSearchAccuracy() {
  console.log('\n🎯 Testing Search Accuracy...');
  
  const testCases = [
    {
      query: 'pepperoni pizza',
      expectedType: 'MENU',
      minConfidence: 0.8
    },
    {
      query: 'delivery policy',
      expectedType: 'POLICY',
      minConfidence: 0.7
    },
    {
      query: 'how to place order',
      expectedType: 'FAQ',
      minConfidence: 0.7
    }
  ];
  
  for (const testCase of testCases) {
    const result = await makeSearchRequest('/api/search/all', testCase.query);
    
    if (result.success && result.data?.results?.length > 0) {
      const topResult = result.data.results[0];
      const accuracy = topResult.contentType === testCase.expectedType && 
                      topResult.confidence >= testCase.minConfidence;
      
      console.log(`Query: "${testCase.query}"`);
      console.log(`  Expected: ${testCase.expectedType}, Got: ${topResult.contentType}`);
      console.log(`  Confidence: ${topResult.confidence.toFixed(3)} (min: ${testCase.minConfidence})`);
      console.log(`  Accuracy: ${accuracy ? '✅' : '❌'}`);
    } else {
      console.log(`Query: "${testCase.query}" - ❌ No results`);
    }
  }
}

/**
 * Test tenant isolation
 */
async function testTenantIsolation() {
  console.log('\n🔒 Testing Tenant Isolation...');
  
  // This test assumes you have multiple business tokens
  const business1Token = process.env.BUSINESS1_TOKEN || BUSINESS_TOKEN;
  const business2Token = process.env.BUSINESS2_TOKEN || BUSINESS_TOKEN;
  
  if (business1Token === business2Token) {
    console.log('⚠️  Skipping tenant isolation test - need different business tokens');
    return;
  }
  
  // Test with business 1
  const result1 = await makeSearchRequest('/api/search/all', 'pizza');
  
  // Test with business 2
  const result2 = await makeSearchRequest('/api/search/all', 'pizza');
  
  if (result1.success && result2.success) {
    const business1Ids = result1.data.results.map(r => r.businessId);
    const business2Ids = result2.data.results.map(r => r.businessId);
    
    const allBusiness1 = business1Ids.every(id => id === business1Ids[0]);
    const allBusiness2 = business2Ids.every(id => id === business2Ids[0]);
    const differentBusinesses = business1Ids[0] !== business2Ids[0];
    
    if (allBusiness1 && allBusiness2 && differentBusinesses) {
      console.log('✅ Tenant isolation is working correctly');
    } else {
      console.log('❌ Tenant isolation may have issues');
    }
  } else {
    console.log('❌ Could not test tenant isolation - requests failed');
  }
}

/**
 * Main test runner
 */
async function runPerformanceTests() {
  console.log('🚀 Starting Search Performance Tests...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log('');

  const startTime = Date.now();

  // Run main performance tests
  console.log('📊 Running Performance Tests...');
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const remaining = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    console.log(`Progress: ${i + remaining}/${TOTAL_REQUESTS} requests`);
    
    await runConcurrentTests();
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const endTime = Date.now();
  const totalTestTime = endTime - startTime;

  // Calculate and display results
  const stats = calculateStats();
  
  console.log('\n📈 Performance Test Results:');
  console.log('================================');
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful: ${stats.successfulRequests}`);
  console.log(`Failed: ${stats.failedRequests}`);
  console.log(`Success Rate: ${stats.successRate.toFixed(2)}%`);
  console.log('');
  console.log('Response Times:');
  console.log(`  Average: ${stats.averageResponseTime.toFixed(2)}ms`);
  console.log(`  Minimum: ${stats.minResponseTime}ms`);
  console.log(`  Maximum: ${stats.maxResponseTime}ms`);
  console.log(`  50th percentile: ${stats.p50}ms`);
  console.log(`  95th percentile: ${stats.p95}ms`);
  console.log(`  99th percentile: ${stats.p99}ms`);
  console.log('');
  console.log(`Total Test Time: ${totalTestTime}ms`);
  console.log(`Requests per Second: ${(stats.totalRequests / (totalTestTime / 1000)).toFixed(2)}`);

  // Performance criteria
  console.log('\n🎯 Performance Criteria:');
  console.log('========================');
  console.log(`Average Response Time: ${stats.averageResponseTime < 200 ? '✅' : '❌'} (${stats.averageResponseTime.toFixed(2)}ms < 200ms)`);
  console.log(`Success Rate: ${stats.successRate > 95 ? '✅' : '❌'} (${stats.successRate.toFixed(2)}% > 95%)`);
  console.log(`95th Percentile: ${stats.p95 < 500 ? '✅' : '❌'} (${stats.p95}ms < 500ms)`);

  // Run additional tests
  await testCachePerformance();
  await testSearchAccuracy();
  await testTenantIsolation();

  console.log('\n✅ Performance tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runPerformanceTests().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runPerformanceTests,
  makeSearchRequest,
  calculateStats
};

