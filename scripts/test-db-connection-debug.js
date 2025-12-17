#!/usr/bin/env node

const { Pool } = require('pg');

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection...\n');
  
  // Get connection details from user input
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  try {
    const host = await question('Enter database host (default: localhost): ') || 'localhost';
    const port = await question('Enter database port (default: 5432): ') || '5432';
    const database = await question('Enter database name: ');
    const username = await question('Enter username: ');
    const password = await question('Enter password: ');
    const ssl = await question('Use SSL? (y/N): ').then(answer => answer.toLowerCase() === 'y');

    if (!database || !username || !password) {
      console.log('❌ Database name, username, and password are required');
      rl.close();
      return;
    }

    console.log('\n🔄 Testing connection...');

    // Test connection with SSL
    if (ssl) {
      console.log('Testing with SSL...');
      try {
        const poolSSL = new Pool({
          host,
          port: parseInt(port),
          database,
          user: username,
          password,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
        });

        const client = await poolSSL.connect();
        await client.query('SELECT 1');
        client.release();
        await poolSSL.end();
        console.log('✅ Connection successful with SSL');
        rl.close();
        return;
      } catch (error) {
        console.log('❌ SSL connection failed:', error.message);
      }
    }

    // Test connection without SSL
    console.log('Testing without SSL...');
    try {
      const poolNoSSL = new Pool({
        host,
        port: parseInt(port),
        database,
        user: username,
        password,
        ssl: false,
        connectionTimeoutMillis: 10000,
      });

      const client = await poolNoSSL.connect();
      await client.query('SELECT 1');
      client.release();
      await poolNoSSL.end();
      console.log('✅ Connection successful without SSL');
    } catch (error) {
      console.log('❌ Connection failed:', error.message);
      
      // Provide specific error guidance
      if (error.message.includes('ECONNREFUSED')) {
        console.log('\n💡 Troubleshooting:');
        console.log('   - Ensure PostgreSQL is running');
        console.log('   - Check if the port is correct');
        console.log('   - Verify firewall settings');
      } else if (error.message.includes('ENOTFOUND')) {
        console.log('\n💡 Troubleshooting:');
        console.log('   - Verify the host address is correct');
        console.log('   - Check network connectivity');
      } else if (error.message.includes('authentication failed')) {
        console.log('\n💡 Troubleshooting:');
        console.log('   - Verify username and password');
        console.log('   - Check if the user has proper permissions');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.log('\n💡 Troubleshooting:');
        console.log('   - Verify the database name is correct');
        console.log('   - Create the database if it doesn\'t exist');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    rl.close();
  }
}

testDatabaseConnection();
