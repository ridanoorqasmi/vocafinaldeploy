// ===== GENERIC READ-ONLY RECORD QUERY SERVICE =====
// Phase 2: Performs dynamic read-only lookups on tenant databases

import { Pool, PoolClient } from 'pg';
import { createReadOnlyConnection, getReadOnlyClient, DatabaseConfig } from './connection';

export interface TableMapping {
  tableName: string;
  primaryKeyColumn: string;
  displayFields: string[];
}

export interface QueryRecordResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

/**
 * Query a single record from tenant database using identifier value
 * STRICT: Read-only SELECT query only
 */
export async function queryRecord(
  dbConfig: DatabaseConfig,
  mapping: TableMapping,
  identifierValue: string
): Promise<QueryRecordResult> {
  let pool: Pool | null = null;
  let client: PoolClient | null = null;

  try {
    // Validate inputs
    if (!mapping.tableName || !mapping.primaryKeyColumn) {
      return {
        success: false,
        error: 'Table name and primary key column are required'
      };
    }

    if (!identifierValue || identifierValue.trim().length === 0) {
      return {
        success: false,
        error: 'Identifier value is required'
      };
    }

    // Validate displayFields
    const displayFields = mapping.displayFields || [];
    if (displayFields.length === 0) {
      return {
        success: false,
        error: 'At least one display field is required'
      };
    }

    // Create read-only connection
    pool = await createReadOnlyConnection(dbConfig);
    client = await getReadOnlyClient(pool);

    // Build SELECT query - ONLY SELECT, no modifications
    // Include primary key and all display fields
    const allFields = [mapping.primaryKeyColumn, ...displayFields];
    const fieldsList = allFields.map(field => `"${field}"`).join(', ');
    
    // Use parameterized query to prevent SQL injection
    const query = `
      SELECT ${fieldsList}
      FROM "${mapping.tableName}"
      WHERE "${mapping.primaryKeyColumn}" = $1
      LIMIT 1
    `;

    console.log('Executing read-only query:', {
      table: mapping.tableName,
      primaryKey: mapping.primaryKeyColumn,
      identifierValue: identifierValue,
      fields: allFields
    });

    // Execute query
    const result = await client.query(query, [identifierValue]);

    if (result.rows.length === 0) {
      return {
        success: true,
        data: null // No record found, but query was successful
      };
    }

    // Return the first (and only) row
    return {
      success: true,
      data: result.rows[0]
    };

  } catch (error: any) {
    console.error('Query record error:', error);
    return {
      success: false,
      error: error.message || 'Failed to query record'
    };
  } finally {
    // Always release resources
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
}

/**
 * Validate table mapping configuration
 */
export function validateTableMapping(mapping: any): {
  valid: boolean;
  error?: string;
} {
  if (!mapping) {
    return { valid: false, error: 'Mapping is required' };
  }

  if (!mapping.tableName || typeof mapping.tableName !== 'string') {
    return { valid: false, error: 'Table name is required and must be a string' };
  }

  if (!mapping.primaryKeyColumn || typeof mapping.primaryKeyColumn !== 'string') {
    return { valid: false, error: 'Primary key column is required and must be a string' };
  }

  if (!mapping.displayFields || !Array.isArray(mapping.displayFields)) {
    return { valid: false, error: 'Display fields must be an array' };
  }

  if (mapping.displayFields.length === 0) {
    return { valid: false, error: 'At least one display field is required' };
  }

  // Validate all display fields are strings
  for (const field of mapping.displayFields) {
    if (typeof field !== 'string' || field.trim().length === 0) {
      return { valid: false, error: 'All display fields must be non-empty strings' };
    }
  }

  return { valid: true };
}


