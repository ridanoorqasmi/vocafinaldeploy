export interface ColumnInfo {
  name: string
  type: string
  sample?: string
  nullable?: boolean
}

export interface SampleData {
  [key: string]: any
}

export interface Connector {
  testConnection(): Promise<boolean>
  listTables(): Promise<string[]>
  listColumns(table: string): Promise<ColumnInfo[]>
  sampleData(table: string, fields: string[]): Promise<SampleData[]>
  query(table: string, whereClause: any, limit?: number): Promise<SampleData[]>
  close(): Promise<void>
}

export interface ConnectionConfig {
  host: string
  port?: number
  database: string
  username: string
  password: string
  ssl?: boolean
  serviceKey?: string // For Firebase
}

export interface ValidationMetrics {
  rowCount: number
  contactNonNull: number
  dateParseSuccess: boolean
  statusValid: boolean
  warnings: string[]
}
