#!/usr/bin/env node

// PostgreSQL Connection Test Script
// This script helps diagnose PostgreSQL connection issues

const { Client } = require('pg');
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

async function testPostgreSQLConnection() {
  console.log('🔍 PostgreSQL Connection Diagnostic Tool');
  console.log('=====================================\n');

  // Get connection details
  const host = await askQuestion('Enter PostgreSQL host (default: localhost): ') || 'localhost';
  const port = await askQuestion('Enter PostgreSQL port (default: 5432): ') || '5432';
  const database = await askQuestion('Enter database name: ');
  const username = await askQuestion('Enter username: ');
  const password = await askQuestion('Enter password: ');
  const useSSL = await askQuestion('Use SSL? (y/n, default: n): ').toLowerCase() === 'y';

  console.log('\n🧪 Testing connection...\n');

  // Test configurations to try
  const configs = [
    {
      name: 'Primary configuration',
      config: {
        host,
        port: parseInt(port),
        database,
        user: username,
        password,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 30000,
        query_timeout: 30000,
        statement_timeout: 30000
      }
    },
    {
      name: 'Without SSL',
      config: {
        host,
        port: parseInt(port),
        database,
        user: username,
        password,
        ssl: false,
        connectionTimeoutMillis: 30000,
        query_timeout: 30000,
        statement_timeout: 30000
      }
    },
    {
      name: 'Alternative port (5433)',
      config: {
        host,
        port: 5433,
        database,
        user: username,
        password,
        ssl: false,
        connectionTimeoutMillis: 30000,
        query_timeout: 30000,
        statement_timeout: 30000
      }
    }
  ];

  let successfulConfig = null;

  for (const { name, config } of configs) {
    console.log(`Testing ${name}...`);
    
    const client = new Client(config);
    
    try {
      await client.connect();
      console.log(`✅ ${name} - Connection successful!`);
      
      // Test a simple query
      const result = await client.query('SELECT version()');
      console.log(`   PostgreSQL version: ${result.rows[0].version.split(' ')[0]}`);
      
      // Test database access
      const dbResult = await client.query('SELECT current_database()');
      console.log(`   Current database: ${dbResult.rows[0].current_database}`);
      
      await client.end();
      successfulConfig = config;
      break;
    } catch (error) {
      console.log(`❌ ${name} - Failed: ${error.message}`);
      
      // Provide specific error guidance
      if (error.message.includes('timeout')) {
        console.log('   💡 Timeout error - check if PostgreSQL is running and accessible');
      } else if (error.message.includes('ENOTFOUND')) {
        console.log('   💡 Host not found - check the host address');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.log('   💡 Connection refused - check if PostgreSQL is running on the specified port');
      } else if (error.message.includes('password authentication failed')) {
        console.log('   💡 Authentication failed - check username and password');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.log('   💡 Database does not exist - create the database first');
      }
    }
  }

  console.log('\n📋 Summary:');
  if (successfulConfig) {
    console.log('✅ Connection successful!');
    console.log('📝 Working configuration:');
    console.log(`   Host: ${successfulConfig.host}`);
    console.log(`   Port: ${successfulConfig.port}`);
    console.log(`   Database: ${successfulConfig.database}`);
    console.log(`   User: ${successfulConfig.user}`);
    console.log(`   SSL: ${successfulConfig.ssl ? 'Yes' : 'No'}`);
  } else {
    console.log('❌ All connection attempts failed');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Ensure PostgreSQL is installed and running');
    console.log('2. Check if the service is listening on the correct port');
    console.log('3. Verify firewall settings allow connections');
    console.log('4. Confirm database and user exist');
    console.log('5. Check PostgreSQL logs for detailed error information');
  }

  rl.close();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Connection test cancelled');
  rl.close();
  process.exit(0);
});

testPostgreSQLConnection().catch(console.error);
