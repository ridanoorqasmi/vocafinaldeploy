import mysql from 'mysql2/promise'
import { Connector, ColumnInfo, SampleData, ConnectionConfig } from './types'

export class MySQLConnector implements Connector {
  private connection?: mysql.Connection

  constructor(private config: ConnectionConfig) {}

  async testConnection(): Promise<boolean> {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port || 3306,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        connectTimeout: 5000,
      })
      await this.connection.ping()
      return true
    } catch (error) {
      console.error('MySQL connection test failed:', error)
      return false
    }
  }

  async listTables(): Promise<string[]> {
    if (!this.connection) throw new Error('Not connected')
    
    const [rows] = await this.connection.execute('SHOW TABLES')
    return (rows as any[]).map(row => Object.values(row)[0] as string)
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    if (!this.connection) throw new Error('Not connected')

    const [rows] = await this.connection.execute(`SHOW COLUMNS FROM \`${table}\``)
    const columns: ColumnInfo[] = []

    for (const row of rows as any[]) {
      // Get a sample value
      let sample: string | undefined
      try {
        const [sampleRows] = await this.connection.execute(`
          SELECT \`${row.Field}\` 
          FROM \`${table}\` 
          WHERE \`${row.Field}\` IS NOT NULL 
          LIMIT 1
        `)
        if ((sampleRows as any[]).length > 0) {
          sample = String((sampleRows as any[])[0][row.Field])
        }
      } catch (error) {
        // Ignore sample fetch errors
      }

      columns.push({
        name: row.Field,
        type: row.Type,
        sample,
        nullable: row.Null === 'YES'
      })
    }

    return columns
  }

  async sampleData(table: string, fields: string[]): Promise<SampleData[]> {
    if (!this.connection) throw new Error('Not connected')

    const fieldList = fields.map(field => `\`${field}\``).join(', ')
    const [rows] = await this.connection.execute(`
      SELECT ${fieldList} 
      FROM \`${table}\` 
      LIMIT 10
    `)
    return rows as SampleData[]
  }

  async query(table: string, whereClause: any, limit: number = 20): Promise<SampleData[]> {
    // Ensure connection is established
    if (!this.connection) {
      await this.testConnection()
    }
    if (!this.connection) throw new Error('Not connected')

    const { whereSQL, params } = this.buildWhereClause(whereClause)
    const querySQL = `SELECT * FROM \`${table}\`${whereSQL ? ` WHERE ${whereSQL}` : ''} LIMIT ?`
    const [rows] = await this.connection.execute(querySQL, [...params, limit])
    return rows as SampleData[]
  }

  private buildWhereClause(whereClause: any): { whereSQL: string; params: any[] } {
    if (!whereClause || typeof whereClause !== 'object') {
      return { whereSQL: '', params: [] }
    }

    const params: any[] = []

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
        if (value === null || value === undefined) {
          conditions.push(`\`${field}\` IS NULL`)
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Handle operators like { lt: date }, { gt: date }, etc.
          if (value.lt !== undefined) {
            params.push(value.lt)
            conditions.push(`\`${field}\` < ?`)
          } else if (value.lte !== undefined) {
            params.push(value.lte)
            conditions.push(`\`${field}\` <= ?`)
          } else if (value.gt !== undefined) {
            params.push(value.gt)
            conditions.push(`\`${field}\` > ?`)
          } else if (value.gte !== undefined) {
            params.push(value.gte)
            conditions.push(`\`${field}\` >= ?`)
          } else if (value.ne !== undefined) {
            params.push(value.ne)
            conditions.push(`\`${field}\` != ?`)
          }
        } else {
          // Simple equality
          params.push(value)
          conditions.push(`\`${field}\` = ?`)
        }
      }

      return conditions.join(' AND ')
    }

    const whereSQL = buildCondition(whereClause)
    return { whereSQL, params }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
    }
  }
}
