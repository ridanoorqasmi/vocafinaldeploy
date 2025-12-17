import { MongoClient, Db } from 'mongodb'
import { Connector, ColumnInfo, SampleData, ConnectionConfig } from './types'

export class MongoDBConnector implements Connector {
  private client?: MongoClient
  private db?: Db

  constructor(private config: ConnectionConfig) {}

  async testConnection(): Promise<boolean> {
    try {
      const uri = `mongodb://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port || 27017}/${this.config.database}`
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      })
      
      await this.client.connect()
      this.db = this.client.db(this.config.database)
      await this.db.admin().ping()
      return true
    } catch (error) {
      console.error('MongoDB connection test failed:', error)
      return false
    }
  }

  async listTables(): Promise<string[]> {
    if (!this.db) throw new Error('Not connected')
    
    const collections = await this.db.listCollections().toArray()
    return collections.map(col => col.name)
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    if (!this.db) throw new Error('Not connected')

    const collection = this.db.collection(table)
    
    // Sample documents to infer schema
    const sampleDocs = await collection.aggregate([
      { $sample: { size: 5 } }
    ]).toArray()

    if (sampleDocs.length === 0) {
      return []
    }

    // Infer column types from sample documents
    const columns: ColumnInfo[] = []
    const fieldTypes = new Map<string, Set<string>>()

    for (const doc of sampleDocs) {
      for (const [key, value] of Object.entries(doc)) {
        if (!fieldTypes.has(key)) {
          fieldTypes.set(key, new Set())
        }
        fieldTypes.get(key)!.add(typeof value)
      }
    }

    for (const [fieldName, types] of fieldTypes) {
      const typeSet = Array.from(types)
      const primaryType = typeSet.includes('string') ? 'string' : 
                         typeSet.includes('number') ? 'number' :
                         typeSet.includes('object') ? 'object' : 'mixed'
      
      // Get a sample value
      const sampleDoc = sampleDocs.find(doc => doc[fieldName] !== undefined)
      const sample = sampleDoc ? String(sampleDoc[fieldName]) : undefined

      columns.push({
        name: fieldName,
        type: primaryType,
        sample,
        nullable: true // MongoDB fields are always nullable
      })
    }

    return columns.sort((a, b) => a.name.localeCompare(b.name))
  }

  async sampleData(table: string, fields: string[]): Promise<SampleData[]> {
    if (!this.db) throw new Error('Not connected')

    const collection = this.db.collection(table)
    const projection: any = {}
    fields.forEach(field => projection[field] = 1)

    const docs = await collection.find({}, { projection }).limit(10).toArray()
    return docs
  }

  async query(table: string, whereClause: any, limit: number = 20): Promise<SampleData[]> {
    if (!this.db) throw new Error('Not connected')

    const collection = this.db.collection(table)
    const mongoQuery = this.convertWhereClauseToMongo(whereClause)
    const docs = await collection.find(mongoQuery).limit(limit).toArray()
    return docs
  }

  private convertWhereClauseToMongo(whereClause: any): any {
    if (!whereClause || typeof whereClause !== 'object') {
      return {}
    }

    // Handle AND conditions
    if (whereClause.AND && Array.isArray(whereClause.AND)) {
      const conditions = whereClause.AND
        .map((cond: any) => this.convertWhereClauseToMongo(cond))
        .filter((cond: any) => Object.keys(cond).length > 0)
      
      if (conditions.length === 0) {
        return {}
      }
      
      return { $and: conditions }
    }

    // Handle OR conditions
    if (whereClause.OR && Array.isArray(whereClause.OR)) {
      const conditions = whereClause.OR
        .map((cond: any) => this.convertWhereClauseToMongo(cond))
        .filter((cond: any) => Object.keys(cond).length > 0)
      
      if (conditions.length === 0) {
        return {}
      }
      
      return { $or: conditions }
    }

    // Handle field conditions
    const query: any = {}
    const fieldEntries = Object.entries(whereClause).filter(([key]) => key !== 'AND' && key !== 'OR')

    for (const [field, value] of fieldEntries) {
      if (value === null || value === undefined) {
        query[field] = null
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle operators like { lt: date }, { gt: date }, etc.
        const mongoOperators: any = {}
        if (value.lt !== undefined) mongoOperators.$lt = value.lt
        if (value.lte !== undefined) mongoOperators.$lte = value.lte
        if (value.gt !== undefined) mongoOperators.$gt = value.gt
        if (value.gte !== undefined) mongoOperators.$gte = value.gte
        if (value.ne !== undefined) mongoOperators.$ne = value.ne
        
        if (Object.keys(mongoOperators).length > 0) {
          query[field] = mongoOperators
        } else {
          query[field] = value
        }
      } else {
        // Simple equality
        query[field] = value
      }
    }

    return query
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close()
    }
  }
}
