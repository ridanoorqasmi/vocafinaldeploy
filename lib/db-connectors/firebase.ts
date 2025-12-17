import { initializeApp, getApps, App, cert } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { Connector, ColumnInfo, SampleData, ConnectionConfig } from './types'

export class FirebaseConnector implements Connector {
  private app?: App
  private db?: Firestore

  constructor(private config: ConnectionConfig) {}

  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.serviceKey) {
        throw new Error('Firebase service key is required')
      }

      // Parse service key
      const serviceAccount = JSON.parse(this.config.serviceKey)
      
      this.app = initializeApp({
        credential: cert(serviceAccount),
        projectId: this.config.database,
      })

      this.db = getFirestore(this.app)
      
      // Test connection by trying to read a collection
      await this.db.collection('_test').limit(1).get()
      return true
    } catch (error) {
      console.error('Firebase connection test failed:', error)
      return false
    }
  }

  async listTables(): Promise<string[]> {
    if (!this.db) throw new Error('Not connected')
    
    // Firebase doesn't have a direct way to list collections
    // We'll return common collection names or use a predefined list
    // In production, you might want to maintain a list of known collections
    return ['users', 'orders', 'leads', 'customers', 'products'] // Common collection names
  }

  async listColumns(table: string): Promise<ColumnInfo[]> {
    if (!this.db) throw new Error('Not connected')

    const collection = this.db.collection(table)
    
    // Sample documents to infer schema
    const snapshot = await collection.limit(5).get()
    const sampleDocs = snapshot.docs.map(doc => doc.data())

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
        nullable: true // Firebase fields are always nullable
      })
    }

    return columns.sort((a, b) => a.name.localeCompare(b.name))
  }

  async sampleData(table: string, fields: string[]): Promise<SampleData[]> {
    if (!this.db) throw new Error('Not connected')

    const collection = this.db.collection(table)
    const snapshot = await collection.limit(10).get()
    
    return snapshot.docs.map(doc => {
      const data = doc.data()
      const result: SampleData = {}
      fields.forEach(field => {
        result[field] = data[field]
      })
      return result
    })
  }

  async query(table: string, whereClause: any, limit: number = 20): Promise<SampleData[]> {
    if (!this.db) throw new Error('Not connected')

    const collection = this.db.collection(table)
    let query = collection.limit(limit)

    // Apply where conditions
    const conditions = this.extractFirestoreConditions(whereClause)
    
    for (const condition of conditions) {
      if (condition.operator === '=') {
        query = query.where(condition.field, '==', condition.value)
      } else if (condition.operator === '<') {
        query = query.where(condition.field, '<', condition.value)
      } else if (condition.operator === '<=') {
        query = query.where(condition.field, '<=', condition.value)
      } else if (condition.operator === '>') {
        query = query.where(condition.field, '>', condition.value)
      } else if (condition.operator === '>=') {
        query = query.where(condition.field, '>=', condition.value)
      } else if (condition.operator === '!=') {
        query = query.where(condition.field, '!=', condition.value)
      }
    }

    const snapshot = await query.get()
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  }

  private extractFirestoreConditions(whereClause: any): Array<{ field: string; operator: string; value: any }> {
    const conditions: Array<{ field: string; operator: string; value: any }> = []

    if (!whereClause || typeof whereClause !== 'object') {
      return conditions
    }

    // Handle AND conditions (Firestore requires all AND conditions to be chained)
    if (whereClause.AND && Array.isArray(whereClause.AND)) {
      for (const condition of whereClause.AND) {
        conditions.push(...this.extractFirestoreConditions(condition))
      }
      return conditions
    }

    // Handle OR conditions - Firestore has limited support, so we'll combine them
    // Note: Firestore only supports one 'in' query per field, so OR might need special handling
    if (whereClause.OR && Array.isArray(whereClause.OR)) {
      // For OR, we'll take the first condition (Firestore limitation)
      // In production, you might want to fetch separately and merge
      if (whereClause.OR.length > 0) {
        conditions.push(...this.extractFirestoreConditions(whereClause.OR[0]))
      }
      return conditions
    }

    // Handle field conditions
    const fieldEntries = Object.entries(whereClause).filter(([key]) => key !== 'AND' && key !== 'OR')

    for (const [field, value] of fieldEntries) {
      if (value === null || value === undefined) {
        conditions.push({ field, operator: '==', value: null })
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle operators like { lt: date }, { gt: date }, etc.
        if (value.lt !== undefined) {
          conditions.push({ field, operator: '<', value: value.lt })
        } else if (value.lte !== undefined) {
          conditions.push({ field, operator: '<=', value: value.lte })
        } else if (value.gt !== undefined) {
          conditions.push({ field, operator: '>', value: value.gt })
        } else if (value.gte !== undefined) {
          conditions.push({ field, operator: '>=', value: value.gte })
        } else if (value.ne !== undefined) {
          conditions.push({ field, operator: '!=', value: value.ne })
        } else {
          conditions.push({ field, operator: '==', value })
        }
      } else {
        // Simple equality
        conditions.push({ field, operator: '==', value })
      }
    }

    return conditions
  }

  async close(): Promise<void> {
    // Firebase doesn't require explicit connection closing
    // The connection will be cleaned up automatically
  }
}
