// PostgreSQL setup script
const { Client } = require('pg');

async function setupPostgreSQL() {
  console.log('🔍 Setting up PostgreSQL database...');
  
  // Common PostgreSQL connection strings to try
  const connectionStrings = [
    'postgresql://postgres:postgres@localhost:5432/postgres',
    'postgresql://postgres:password@localhost:5432/postgres',
    'postgresql://postgres:@localhost:5432/postgres',
    'postgresql://localhost:5432/postgres'
  ];
  
  let workingConnection = null;
  
  for (const connectionString of connectionStrings) {
    console.log(`🧪 Trying connection: ${connectionString.replace(/:[^:@]*@/, ':***@')}`);
    
    const client = new Client({
      connectionString: connectionString
    });
    
    try {
      await client.connect();
      console.log('✅ Connection successful!');
      workingConnection = connectionString;
      await client.end();
      break;
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      try {
        await client.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  if (!workingConnection) {
    console.log('\n🚨 No working PostgreSQL connection found.');
    console.log('💡 Please ensure PostgreSQL is running and accessible.');
    console.log('📝 Common solutions:');
    console.log('   1. Install PostgreSQL: https://www.postgresql.org/download/');
    console.log('   2. Start PostgreSQL service');
    console.log('   3. Create a database: createdb voca_order_taking');
    console.log('   4. Update .env.local with correct credentials');
    return;
  }
  
  console.log('\n🎉 Found working connection!');
  console.log('📝 Update your .env.local file with:');
  console.log(`DATABASE_URL="${workingConnection.replace('postgres', 'voca_order_taking')}"`);
  
  // Try to create the database
  const client = new Client({
    connectionString: workingConnection
  });
  
  try {
    await client.connect();
    console.log('\n🔧 Creating database...');
    await client.query('CREATE DATABASE voca_order_taking');
    console.log('✅ Database created successfully!');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✅ Database already exists!');
    } else {
      console.log('⚠️  Could not create database:', error.message);
      console.log('💡 You may need to create it manually: createdb voca_order_taking');
    }
  } finally {
    await client.end();
  }
}

setupPostgreSQL();
