import { Pool, PoolClient } from 'pg'
import { Connector, ColumnInfo, SampleData, ConnectionConfig } from './types'

export class PostgreSQLConnector implements Connector {
  private pool: Pool
  private client?: PoolClient

  constructor(private config: ConnectionConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000, // Increased from 5000 to 30000 (30 seconds)
      query_timeout: 30000, // Add query timeout
      statement_timeout: 30000, // Add statement timeout
    })
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()
      return true
    } catch (error) {
      console.error('PostgreSQL connection test failed:', error)
      
      // Handle different types of connection errors
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : ''
      const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('connection terminated')
      const isSSLError = errorMessage.includes('ssl') || errorMessage.includes('certificate')
      const isNetworkError = errorMessage.includes('enotfound') || errorMessage.includes('econnrefused')
      
      // Try alternative connection methods
      if (isTimeoutError || isSSLError || isNetworkError) {
        console.log('Attempting connection with alternative settings...')
        
        try {
          // Try without SSL first
          const poolNoSSL = new Pool({
            host: this.config.host,
            port: this.config.port || 5432,
            database: this.config.database,
            user: this.config.username,
            password: this.config.password,
            ssl: false,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 30000, // Increased timeout
            query_timeout: 30000,
            statement_timeout: 30000,
          })
          
          const client = await poolNoSSL.connect()
          await client.query('SELECT 1')
          client.release()
          await poolNoSSL.end()
          console.log('Connection successful without SSL')
          return true
        } catch (retryError) {
          console.error('PostgreSQL connection retry without SSL failed:', retryError)
          
          // Try with different port if default failed
          if (this.config.port === 5432 || !this.config.port) {
            try {
              const poolAltPort = new Pool({
                host: this.config.host,
                port: 5433, // Try alternative port
                database: this.config.database,
                user: this.config.username,
                password: this.config.password,
                ssl: false,
                max: 5,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 30000,
                query_timeout: 30000,
                statement_timeout: 30000,
              })
              
              const client = await poolAltPort.connect()
              await client.query('SELECT 1')
              client.release()
              await poolAltPort.end()
              console.log('Connection successful on alternative port')
              return true
            } catch (altPortError) {
              console.error('PostgreSQL connection retry on alternative port failed:', altPortError)
            }
          }
        }
      }
      
      // Throw the original error so the API can capture it
      throw error
    }
  }

  async listTables(): Promise<string[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `)
      return result.rows.map(row => row.table_name)
    } catch (error) {
      console.error('Error listing tables:', error)
      // If we can't list tables due to permissions or other issues,
      // return an empty array rather than throwing
      return []
    } finally {
      client.release()
    }
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [table])

      const columns: ColumnInfo[] = []
      
      for (const row of result.rows) {
        // Get a sample value
        let sample: string | undefined
        try {
          const sampleResult = await client.query(`
            SELECT "${row.column_name}" 
            FROM "${table}" 
            WHERE "${row.column_name}" IS NOT NULL 
            LIMIT 1
          `)
          if (sampleResult.rows.length > 0) {
            sample = String(sampleResult.rows[0][row.column_name])
          }
        } catch (error) {
          // Ignore sample fetch errors
        }

        columns.push({
          name: row.column_name,
          type: row.data_type,
          sample,
          nullable: row.is_nullable === 'YES'
        })
      }

      return columns
    } finally {
      client.release()
    }
  }

  async sampleData(table: string, fields: string[]): Promise<SampleData[]> {
    const client = await this.pool.connect()
    try {
      const fieldList = fields.map(field => `"${field}"`).join(', ')
      const result = await client.query(`
        SELECT ${fieldList} 
        FROM "${table}" 
        LIMIT 10
      `)
      return result.rows
    } finally {
      client.release()
    }
  }

  async query(table: string, whereClause: any, limit: number = 20): Promise<SampleData[]> {
    const client = await this.pool.connect()
    try {
      const { whereSQL, params } = this.buildWhereClause(whereClause)
      // PostgreSQL is case-sensitive with quoted identifiers
      // Use lowercase table name to match unquoted identifiers (which are normalized to lowercase)
      const tableName = table.includes('"') ? table : `"${table}"`
      const querySQL = `SELECT * FROM ${tableName}${whereSQL ? ` WHERE ${whereSQL}` : ''} LIMIT $${params.length + 1}`
      
      // Enhanced debug logging
      console.log('\n========== [PostgreSQL] Query Debug ==========');
      console.log('[PostgreSQL] Table:', tableName);
      console.log('[PostgreSQL] WHERE Clause SQL:', whereSQL || '(no WHERE clause - selecting all)');
      console.log('[PostgreSQL] Parameters:', params);
      console.log('[PostgreSQL] Final Query:');
      console.log('  ' + querySQL);
      
      // Show parameter substitution for easier debugging
      if (params.length > 0) {
        let debugQuery = querySQL;
        params.forEach((param, idx) => {
          const placeholder = `$${idx + 1}`;
          const value = typeof param === 'string' ? `'${param}'` : param;
          debugQuery = debugQuery.replace(placeholder, value);
        });
        console.log('[PostgreSQL] Query with parameters substituted:');
        console.log('  ' + debugQuery);
      }
      console.log('=============================================\n');
      const result = await client.query(querySQL, [...params, limit])
      return result.rows
    } finally {
      client.release()
    }
  }

  private buildWhereClause(whereClause: any): { whereSQL: string; params: any[] } {
    if (!whereClause || typeof whereClause !== 'object') {
      return { whereSQL: '', params: [] }
    }

    const params: any[] = []
    let paramIndex = 1

    const buildCondition = (condition: any): string => {
      if (!condition || typeof condition !== 'object') {
        return ''
      }

      // Handle AND conditions
      if (condition.AND && Array.isArray(condition.AND)) {
        const andConditions = condition.AND
          .map(buildCondition)
          .filter(Boolean)
        return andConditions.length > 0 ? `(${andConditions.join(' AND ')})` : ''
      }

      // Handle OR conditions
      if (condition.OR && Array.isArray(condition.OR)) {
        const orConditions = condition.OR
          .map(buildCondition)
          .filter(Boolean)
        return orConditions.length > 0 ? `(${orConditions.join(' OR ')})` : ''
      }

      // Handle field conditions
      const fieldEntries = Object.entries(condition).filter(([key]) => key !== 'AND' && key !== 'OR')
      
      if (fieldEntries.length === 0) {
        return ''
      }

      const conditions: string[] = []

      for (const [field, value] of fieldEntries) {
        // PostgreSQL: unquoted identifiers are normalized to lowercase
        // If field is lowercase or mixed case, quote it to preserve exact case
        // For case-insensitive matching, use lowercase unquoted
        // We'll quote the field to match exact database column name
        const quotedField = `"${field}"`
        
        if (value === null || value === undefined) {
          conditions.push(`${quotedField} IS NULL`)
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Handle operators like { lt: date }, { gt: date }, etc.
          if (value.lt !== undefined) {
            params.push(value.lt)
            conditions.push(`${quotedField} < $${paramIndex++}`)
          } else if (value.lte !== undefined) {
            params.push(value.lte)
            conditions.push(`${quotedField} <= $${paramIndex++}`)
          } else if (value.gt !== undefined) {
            params.push(value.gt)
            conditions.push(`${quotedField} > $${paramIndex++}`)
          } else if (value.gte !== undefined) {
            params.push(value.gte)
            conditions.push(`${quotedField} >= $${paramIndex++}`)
          } else if (value.ne !== undefined) {
            params.push(value.ne)
            conditions.push(`${quotedField} != $${paramIndex++}`)
          }
        } else {
          // Simple equality
          params.push(value)
          conditions.push(`${quotedField} = $${paramIndex++}`)
        }
      }

      return conditions.join(' AND ')
    }

    const whereSQL = buildCondition(whereClause)
    return { whereSQL, params }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
