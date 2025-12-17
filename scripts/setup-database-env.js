#!/usr/bin/env node

// Database Environment Setup Script
// This script helps set up the database environment for the application

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupDatabaseEnvironment() {
  console.log('🗄️  Database Environment Setup');
  console.log('=============================\n');

  console.log('This script will help you set up your database environment.');
  console.log('Choose your database type:\n');
  console.log('1. PostgreSQL (External database)');
  console.log('2. SQLite (Local file database - Recommended for development)');
  console.log('3. Use existing .env.local file');
  
  const choice = await askQuestion('\nEnter your choice (1-3): ');

  let envContent = '';

  switch (choice) {
    case '1':
      console.log('\n📊 Setting up PostgreSQL...');
      const pgHost = await askQuestion('PostgreSQL host (default: localhost): ') || 'localhost';
      const pgPort = await askQuestion('PostgreSQL port (default: 5432): ') || '5432';
      const pgDatabase = await askQuestion('Database name: ');
      const pgUser = await askQuestion('Username: ');
      const pgPassword = await askQuestion('Password: ');
      
      envContent = `# Database Configuration
DATABASE_URL="postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}"

# Application Configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
`;
      break;

    case '2':
      console.log('\n📁 Setting up SQLite...');
      const dbPath = await askQuestion('Database file path (default: ./dev.db): ') || './dev.db';
      
      envContent = `# Database Configuration
DATABASE_URL="file:${dbPath}"

# Application Configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
`;
      break;

    case '3':
      console.log('\n📄 Using existing .env.local file...');
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        console.log('✅ Found existing .env.local file');
        rl.close();
        return;
      } else {
        console.log('❌ No .env.local file found');
        rl.close();
        return;
      }

    default:
      console.log('❌ Invalid choice');
      rl.close();
      return;
  }

  // Write the environment file
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`\n✅ Environment file created: ${envPath}`);
    console.log('\n📝 Next steps:');
    console.log('1. Run: npm run db:push (to create database schema)');
    console.log('2. Run: npm run db:seed (to populate with sample data)');
    console.log('3. Run: npm run dev (to start the development server)');
  } catch (error) {
    console.error('❌ Error creating environment file:', error.message);
  }

  rl.close();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup cancelled');
  rl.close();
  process.exit(0);
});

setupDatabaseEnvironment().catch(console.error);
