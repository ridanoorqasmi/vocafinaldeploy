#!/usr/bin/env node

/**
 * Installation Verification Script
 * Checks if all required dependencies and configurations are in place
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 VOCA AI - Installation Verification\n');
console.log('=' .repeat(50));

let allChecksPassed = true;

// Check Node.js version
console.log('\n📦 Checking Node.js...');
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
  const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
  
  if (majorVersion >= 18) {
    console.log(`✅ Node.js ${nodeVersion} (Required: 18+)`);
  } else {
    console.log(`❌ Node.js ${nodeVersion} (Required: 18+)`);
    console.log('   Please upgrade Node.js from https://nodejs.org/');
    allChecksPassed = false;
  }
} catch (error) {
  console.log('❌ Node.js not found');
  console.log('   Please install Node.js from https://nodejs.org/');
  allChecksPassed = false;
}

// Check npm
console.log('\n📦 Checking npm...');
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ npm ${npmVersion}`);
} catch (error) {
  console.log('❌ npm not found');
  allChecksPassed = false;
}

// Check PostgreSQL
console.log('\n🗄️  Checking PostgreSQL...');
try {
  const pgVersion = execSync('psql --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ PostgreSQL installed: ${pgVersion}`);
} catch (error) {
  console.log('⚠️  PostgreSQL not found in PATH');
  console.log('   Make sure PostgreSQL is installed and running');
  console.log('   Or use Docker: docker run --name voca-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=voca_order_taking -p 5432:5432 -d postgres:15');
}

// Check node_modules
console.log('\n📚 Checking dependencies...');
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules directory exists');
  
  // Check if Prisma is installed
  const prismaPath = path.join(nodeModulesPath, '@prisma', 'client');
  if (fs.existsSync(prismaPath)) {
    console.log('✅ Prisma Client installed');
  } else {
    console.log('⚠️  Prisma Client not found');
    console.log('   Run: npx prisma generate');
  }
} else {
  console.log('❌ node_modules not found');
  console.log('   Run: npm install');
  allChecksPassed = false;
}

// Check .env.local
console.log('\n🔐 Checking environment variables...');
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log('✅ .env.local file exists');
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'OPENAI_API_KEY'
  ];
  
  const missingVars = [];
  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      // Check if it has a value (not empty)
      const regex = new RegExp(`${varName}=["\']?([^"\'\\n]+)["\']?`, 'i');
      const match = envContent.match(regex);
      if (match && match[1] && match[1].trim() !== '') {
        console.log(`✅ ${varName} is set`);
      } else {
        console.log(`⚠️  ${varName} is empty`);
        missingVars.push(varName);
      }
    } else {
      console.log(`❌ ${varName} is missing`);
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    console.log(`\n⚠️  Missing or empty variables: ${missingVars.join(', ')}`);
    console.log('   Please update your .env.local file');
  }
} else {
  console.log('❌ .env.local file not found');
  console.log('   Create .env.local with required environment variables');
  console.log('   See INSTALLATION_GUIDE.md for details');
  allChecksPassed = false;
}

// Check Prisma schema
console.log('\n🗄️  Checking Prisma configuration...');
const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  console.log('✅ Prisma schema found');
} else {
  console.log('❌ Prisma schema not found');
  allChecksPassed = false;
}

// Check TypeScript config
console.log('\n📝 Checking TypeScript configuration...');
const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
if (fs.existsSync(tsConfigPath)) {
  console.log('✅ TypeScript config found');
} else {
  console.log('⚠️  TypeScript config not found');
}

// Check Next.js config
console.log('\n⚛️  Checking Next.js configuration...');
const nextConfigPath = path.join(process.cwd(), 'next.config.js');
if (fs.existsSync(nextConfigPath)) {
  console.log('✅ Next.js config found');
} else {
  console.log('⚠️  Next.js config not found');
}

// Summary
console.log('\n' + '='.repeat(50));
if (allChecksPassed) {
  console.log('\n✅ All critical checks passed!');
  console.log('\n📋 Next steps:');
  console.log('   1. Ensure PostgreSQL is running');
  console.log('   2. Run: npx prisma generate');
  console.log('   3. Run: npm run db:push');
  console.log('   4. Run: npm run dev');
} else {
  console.log('\n⚠️  Some checks failed. Please fix the issues above.');
  console.log('\n📖 See INSTALLATION_GUIDE.md for detailed setup instructions.');
}

console.log('\n');
