import { PrismaClient } from '@prisma/client'
import { createConnector } from '@/lib/db-connectors/factory'
import { decrypt } from '@/lib/encryption'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

/**
 * Internal scheduler for automatic database sync
 * Checks and syncs connections every minute based on their sync frequency
 */
export class DatabaseSyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    // Do NOT auto-start on construction
  }
  

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('Database sync scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting database sync scheduler...');

    // Schedule sync check every 1 minute (60000 milliseconds)
    this.intervalId = setInterval(() => {
      this.triggerAutoSync().catch(err => {
        console.error('[DB SYNC] Unhandled sync error (non-fatal):', err);
      });
    }, 60_000); // 1 minute
    

    console.log('Database sync scheduler started successfully (checking every 1 minute)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('Database sync scheduler is not running');
      return;
    }

    console.log('Stopping database sync scheduler...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    console.log('Database sync scheduler stopped');
  }

  /**
   * Trigger auto-sync by directly calling the sync logic
   */
  private async triggerAutoSync() {
    try {
      // Check if Prisma client and required models are available
      if (!prisma || !prisma.external_connections) {
        console.warn('[DB SYNC] Prisma client or external_connections model not ready, skipping run');
        return;
      }

      const now = new Date()

      // Find all connections ready for sync
      const connectionsToSync = await prisma.external_connections.findMany({
        where: {
          isAutoSyncEnabled: true,
          status: 'ACTIVE',
          isSyncing: false,
          OR: [
            { nextSyncAt: { lte: now } },
            { nextSyncAt: null }
          ]
        },
        include: {
          followup_mappings: true
        }
      })

      if (connectionsToSync.length === 0) {
        return // No connections to sync
      }

      // Sync each connection
      for (const connection of connectionsToSync) {
        // Set syncing flag
        await prisma.external_connections.update({
          where: { id: connection.id },
          data: { isSyncing: true }
        })

        try {
          // Sync each mapping for this connection
          for (const mapping of connection.followup_mappings) {
            try {
              await this.syncMapping(connection, mapping)
            } catch (error) {
              console.error(`Error syncing mapping ${mapping.id} for connection ${connection.id}:`, error)
              // Continue with other mappings
            }
          }

          // Update sync metadata
          const nextSyncAt = connection.syncFrequencyMinutes
            ? new Date(now.getTime() + (connection.syncFrequencyMinutes * 60 * 1000))
            : null

          await prisma.external_connections.update({
            where: { id: connection.id },
            data: {
              lastSyncedAt: now,
              nextSyncAt,
              isSyncing: false
            }
          })

          console.log(`Database sync completed for connection: ${connection.name}`)
        } catch (error) {
          // Reset syncing flag on error
          await prisma.external_connections.update({
            where: { id: connection.id },
            data: { isSyncing: false }
          })

          console.error(`Error syncing connection ${connection.id}:`, error)
        }
      }
    } catch (error) {
      console.error('Error in database sync scheduler:', error)
    }
  }

  /**
   * Sync a single mapping from external database
   * (Same logic as in the auto-sync route)
   */
  private async syncMapping(connection: any, mapping: any) {
    // Decrypt credentials
    const decryptedPassword = connection.password ? decrypt(connection.password) : ''
    const decryptedServiceKey = connection.config && (connection.config as any).serviceKey 
      ? decrypt((connection.config as any).serviceKey) 
      : undefined

    // Create connector
    const config = {
      host: connection.host,
      port: connection.port || undefined,
      database: connection.database,
      username: connection.username,
      password: decryptedPassword,
      ssl: (connection.config as any)?.ssl || false,
      serviceKey: decryptedServiceKey
    }

    const connector = createConnector(connection.type, config)

    try {
      // Test connection
      const isConnected = await connector.testConnection()
      if (!isConnected) {
        throw new Error('Database connection failed')
      }

      // Get field mappings
      const fields = mapping.fields as Record<string, string>
      const pkField = fields.pk || 'id'
      
      // Get all columns to fetch
      const allColumns = Object.values(fields).filter(Boolean)
      if (!allColumns.includes(pkField)) {
        allColumns.push(pkField)
      }

      // Fetch all data from external database
      const externalData = await connector.query(mapping.resource, {}, 10000)

      // Get existing mapped records using raw query (model not in Prisma schema)
      let existingRecords: Array<{
        id: string
        externalId: string
        data: any
        isActive: boolean
      }> = []
      try {
        existingRecords = await prisma.$queryRaw<Array<{
          id: string
          externalId: string
          data: any
          isActive: boolean
        }>>`
          SELECT id, "externalId", data, "isActive"
          FROM mapped_records
          WHERE "connectionId" = ${connection.id} AND "mappingId" = ${mapping.id || null}
        `
      } catch (error: any) {
        // If table doesn't exist (P2021), skip this mapping
        if (error?.code === 'P2021') {
          console.warn(`[DB SYNC] mapped_records table may not exist, skipping record sync:`, error.message)
          return // Skip this mapping if table doesn't exist
        }
        throw error
      }

      // Create maps for quick lookup
      const existingMap = new Map(
        existingRecords.map(r => [r.externalId, r])
      )
      const externalMap = new Map(
        externalData.map((row: any) => [String(row[pkField] || row.id || ''), row])
      )

      // Process external data: insert or update
      for (const [externalId, rowData] of externalMap.entries()) {
        if (!externalId) continue

        // Transform row data
        const mappedData: Record<string, any> = {}
        for (const [canonicalField, actualField] of Object.entries(fields)) {
          if (actualField && rowData[actualField] !== undefined) {
            mappedData[canonicalField] = rowData[actualField]
          }
        }
        mappedData._raw = rowData

        const existing = existingMap.get(externalId)

        if (existing) {
          // Update existing record using raw query
          await prisma.$executeRaw`
            UPDATE mapped_records
            SET data = ${JSON.stringify(mappedData)}::jsonb, "isActive" = true, "syncedAt" = ${new Date()}, "updatedAt" = ${new Date()}
            WHERE id = ${existing.id}
          `
        } else {
          // Insert new record using raw query
          const recordId = randomUUID()
          await prisma.$executeRaw`
            INSERT INTO mapped_records (id, "connectionId", "mappingId", "externalId", data, "isActive", "syncedAt", "createdAt", "updatedAt")
            VALUES (${recordId}, ${connection.id}, ${mapping.id || null}, ${externalId}, ${JSON.stringify(mappedData)}::jsonb, true, ${new Date()}, ${new Date()}, ${new Date()})
          `
        }
      }

      // Mark records not found in external data as inactive
      for (const [externalId, record] of existingMap.entries()) {
        if (!externalMap.has(externalId)) {
          await prisma.$executeRaw`
            UPDATE mapped_records
            SET "isActive" = false, "syncedAt" = ${new Date()}, "updatedAt" = ${new Date()}
            WHERE id = ${record.id}
          `
        }
      }

    } finally {
      await connector.close()
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null
    };
  }
}

// Singleton instance
let databaseSyncScheduler: DatabaseSyncScheduler | null = null;

/**
 * Get the database sync scheduler instance
 */
export function getDatabaseSyncScheduler(): DatabaseSyncScheduler {
  if (!databaseSyncScheduler) {
    databaseSyncScheduler = new DatabaseSyncScheduler();
  }
  return databaseSyncScheduler;
}

/**
 * Initialize the database sync scheduler
 */
export function initializeDatabaseSyncScheduler() {
  if (process.env.ENABLE_DB_SYNC !== 'true') {
    console.log('Database sync scheduler disabled (ENABLE_DB_SYNC != true)');
    return null;
  }

  const scheduler = getDatabaseSyncScheduler();
  scheduler.start();
  console.log('Database sync scheduler initialized');
  return scheduler;
}


/**
 * Graceful shutdown
 */
export function shutdownDatabaseSyncScheduler() {
  if (databaseSyncScheduler) {
    databaseSyncScheduler.stop();
    databaseSyncScheduler = null;
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down database sync scheduler...');
  shutdownDatabaseSyncScheduler();
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down database sync scheduler...');
  shutdownDatabaseSyncScheduler();
});

