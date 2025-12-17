// Create .env.local file with proper encoding
const fs = require('fs');
const path = require('path');

const envContent = `DATABASE_URL="postgresql://postgres:rida1234@localhost:5432/voca_order_taking"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars-change-in-production-12345"
JWT_REFRESH_SECRET="your-different-refresh-secret-min-32-chars-change-in-production-67890"
BCRYPT_ROUNDS=12`;

const envPath = path.join(__dirname, '..', '.env.local');

try {
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ .env.local file created successfully');
  console.log('📄 Content:');
  console.log(envContent);
} catch (error) {
  console.error('❌ Error creating .env.local:', error.message);
}
