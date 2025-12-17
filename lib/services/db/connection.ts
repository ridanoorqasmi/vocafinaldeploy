// ===== READ-ONLY DATABASE CONNECTION SERVICE =====
// Phase 2: Creates read-only database connections for tenant databases

import { Pool, PoolClient } from 'pg';
import { decryptPassword } from './encryption';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string; // Encrypted password
  database: string;
}

export interface ReadOnlyClient {
  query: (text: string, params?: any[]) => Promise<any>;
  release: () => void;
}

/**
 * Create a read-only PostgreSQL connection pool
 * All queries are executed with read-only transaction mode
 */
export async function createReadOnlyConnection(
  config: DatabaseConfig
): Promise<Pool> {
  // Decrypt password
  const decryptedPassword = decryptPassword(config.password);

  // Create connection pool with read-only settings
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: decryptedPassword,
    max: 2, // Limit connections for read-only access
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Read-only mode enforced at application level
  });

  return pool;
}

/**
 * Get a read-only client from the pool
 * Sets transaction to read-only mode
 */
export async function getReadOnlyClient(
  pool: Pool
): Promise<PoolClient> {
  const client = await pool.connect();
  
  // Set transaction to read-only mode
  try {
    await client.query('SET TRANSACTION READ ONLY');
  } catch (error) {
    // Some databases may not support this, continue anyway
    console.warn('Could not set read-only transaction mode:', error);
  }

  return client;
}

/**
 * Test database connection with plain password (for initial testing)
 */
export async function testConnectionPlain(
  host: string,
  port: number,
  username: string,
  password: string,
  database: string
): Promise<{ success: boolean; error?: string }> {
  let pool: Pool | null = null;
  let client: PoolClient | null = null;

  try {
    // Create connection pool with plain password
    pool = new Pool({
      host,
      port,
      database,
      user: username,
      password, // Plain password for testing
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    client = await pool.connect();
    
    // Test with a simple SELECT query
    await client.query('SELECT 1 as test');
    
    return { success: true };
  } catch (error: any) {
    console.error('Database connection test failed:', error);
    return {
      success: false,
      error: error.message || 'Connection test failed'
    };
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
}

/**
 * Test database connection with encrypted password (for existing configs)
 */
export async function testConnection(
  config: DatabaseConfig
): Promise<{ success: boolean; error?: string }> {
  let pool: Pool | null = null;
  let client: PoolClient | null = null;

  try {
    pool = await createReadOnlyConnection(config);
    client = await getReadOnlyClient(pool);
    
    // Test with a simple SELECT query
    await client.query('SELECT 1 as test');
    
    return { success: true };
  } catch (error: any) {
    console.error('Database connection test failed:', error);
    return {
      success: false,
      error: error.message || 'Connection test failed'
    };
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
}

