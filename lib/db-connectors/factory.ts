import { Connector, ConnectionConfig } from './types'
import { PostgreSQLConnector } from './postgresql'
import { MySQLConnector } from './mysql'
import { MongoDBConnector } from './mongodb'
import { FirebaseConnector } from './firebase'

export type DatabaseType = 'POSTGRESQL' | 'MYSQL' | 'MONGODB' | 'FIREBASE'

export function createConnector(type: DatabaseType, config: ConnectionConfig): Connector {
  switch (type) {
    case 'POSTGRESQL':
      return new PostgreSQLConnector(config)
    case 'MYSQL':
      return new MySQLConnector(config)
    case 'MONGODB':
      return new MongoDBConnector(config)
    case 'FIREBASE':
      return new FirebaseConnector(config)
    default:
      throw new Error(`Unsupported database type: ${type}`)
  }
}

export function getDatabaseTypeLabel(type: DatabaseType): string {
  switch (type) {
    case 'POSTGRESQL':
      return 'PostgreSQL'
    case 'MYSQL':
      return 'MySQL'
    case 'MONGODB':
      return 'MongoDB'
    case 'FIREBASE':
      return 'Firebase'
    default:
      return 'Unknown'
  }
}

export function getDefaultPort(type: DatabaseType): number {
  switch (type) {
    case 'POSTGRESQL':
      return 5432
    case 'MYSQL':
      return 3306
    case 'MONGODB':
      return 27017
    case 'FIREBASE':
      return 443
    default:
      return 0
  }
}
