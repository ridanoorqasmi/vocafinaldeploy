// Check environment variables
require('dotenv').config({ path: '.env.local' });
console.log('🔍 Checking environment variables...');

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingVars = [];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    console.log(`❌ Missing: ${varName}`);
  } else {
    console.log(`✅ Found: ${varName}`);
  }
});

if (missingVars.length > 0) {
  console.log('\n🚨 Missing required environment variables:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('\n📝 Please create a .env.local file with these variables.');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
}

// Check JWT secret length
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.log('⚠️  Warning: JWT_SECRET should be at least 32 characters long');
}

if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
  console.log('⚠️  Warning: JWT_REFRESH_SECRET should be at least 32 characters long');
}
