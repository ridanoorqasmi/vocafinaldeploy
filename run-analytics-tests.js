const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Phase 4C Analytics - Comprehensive Test Suite\n');

// Test configuration
const testSuites = [
  {
    name: 'Revenue Analytics Engine',
    path: 'src/tests/analytics/revenue-analytics.test.ts',
    description: 'Tests MRR calculation, LTV metrics, cohort analysis, and churn analysis'
  },
  {
    name: 'Predictive Models',
    path: 'src/tests/analytics/predictive-models.test.ts',
    description: 'Tests churn prediction, revenue forecasting, and expansion opportunities'
  },
  {
    name: 'Insights Engine',
    path: 'src/tests/analytics/insights-engine.test.ts',
    description: 'Tests business insights generation and alert system'
  },
  {
    name: 'Analytics Service',
    path: 'src/tests/analytics/analytics-service.test.ts',
    description: 'Tests analytics service integration and dashboard data'
  },
  {
    name: 'Integration Tests',
    path: 'src/tests/analytics/test-runner.ts',
    description: 'Comprehensive end-to-end integration tests'
  }
];

const results = [];

// First, let's check if the database schema exists
console.log('🔍 Checking database schema...');
try {
  // Check if analytics schema file exists
  const schemaPath = path.join(process.cwd(), 'database', 'phase4c-analytics-schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.log('❌ Analytics schema file not found at database/phase4c-analytics-schema.sql');
    console.log('   Please ensure the schema file exists before running tests');
    process.exit(1);
  }
  console.log('✅ Analytics schema file found');
} catch (error) {
  console.log('❌ Error checking schema file:', error.message);
  process.exit(1);
}

// Run each test suite
testSuites.forEach((suite, index) => {
  console.log(`\n🧪 Running ${suite.name} (${index + 1}/${testSuites.length})`);
  console.log(`   ${suite.description}`);
  console.log('   ' + '='.repeat(50));
  
  const startTime = Date.now();
  
  try {
    execSync(`npx jest ${suite.path} --verbose --no-coverage`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ ${suite.name} passed (${duration}ms)`);
    
    results.push({
      suite: suite.name,
      status: 'pass',
      duration: duration,
      error: null
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ ${suite.name} failed (${duration}ms)`);
    console.log(`   Error: ${error.message}`);
    
    results.push({
      suite: suite.name,
      status: 'fail',
      duration: duration,
      error: error.message
    });
  }
});

// Generate comprehensive test report
console.log('\n📊 Test Results Summary:');
console.log('='.repeat(60));

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;

results.forEach(result => {
  const icon = result.status === 'pass' ? '✅' : '❌';
  const duration = `(${result.duration}ms)`;
  console.log(`${icon} ${result.suite} ${duration}`);
  
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
});

console.log('\n📈 Summary:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${results.length}`);

if (failed === 0) {
  console.log('\n🎉 All test suites passed!');
  console.log('📊 Phase 4C Analytics System is fully functional');
  console.log('🚀 Ready for production deployment');
} else {
  console.log('\n❌ Some test suites failed');
  console.log('🔧 Please review and fix the failing tests');
  console.log('\n💡 Common issues and solutions:');
  console.log('   1. Database schema not applied: Run the analytics schema SQL file');
  console.log('   2. Missing dependencies: Run npm install');
  console.log('   3. TypeScript compilation errors: Check for syntax errors');
  console.log('   4. Database connection issues: Verify database is running');
}

// Save detailed results to file
const reportData = {
  timestamp: new Date().toISOString(),
  summary: { passed, failed, total: results.length },
  results: results,
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch
  }
};

fs.writeFileSync('test-results.json', JSON.stringify(reportData, null, 2));
console.log('\n📄 Detailed test report saved to test-results.json');

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
