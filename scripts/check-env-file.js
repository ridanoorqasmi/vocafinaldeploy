// Check .env.local file content
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking .env.local file...');

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  console.log('📁 File path:', envPath);
  
  if (fs.existsSync(envPath)) {
    console.log('✅ File exists');
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('📄 File content:');
    console.log('---');
    console.log(content);
    console.log('---');
    console.log('📏 File size:', content.length, 'bytes');
    console.log('📝 Number of lines:', content.split('\n').length);
  } else {
    console.log('❌ File does not exist');
  }
} catch (error) {
  console.error('💥 Error:', error.message);
}
