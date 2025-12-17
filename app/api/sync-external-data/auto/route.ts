import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createConnector } from '@/lib/db-connectors/factory'
import { decrypt } from '@/lib/encryption'

const prisma = new PrismaClient()

/**
 * POST /api/sync-external-data/auto
 * Auto-sync endpoint triggered by cron job
 * Syncs all connections where isAutoSyncEnabled = true and nextSyncAt <= now
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add API key authentication for cron jobs
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        ok: false,
        message: 'Unauthorized'
      }, { status: 401 })
    }

    const now = new Date()

    // Find all connections ready for sync
    const connectionsToSync = await prisma.connection.findMany({
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
        mappings: true
      }
    })

    if (connectionsToSync.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No connections ready for sync',
        synced: 0
      })
    }

    const results = []

    for (const connection of connectionsToSync) {
      // Set syncing flag
      await prisma.connection.update({
        where: { id: connection.id },
        data: { isSyncing: true }
      })

      try {
        // Sync each mapping for this connection
        for (const mapping of connection.mappings) {
          try {
            await syncMapping(connection, mapping)
          } catch (error) {
            console.error(`Error syncing mapping ${mapping.id} for connection ${connection.id}:`, error)
            // Continue with other mappings
          }
        }

        // Update sync metadata
        const nextSyncAt = connection.syncFrequencyMinutes
          ? new Date(now.getTime() + (connection.syncFrequencyMinutes * 60 * 1000))
          : null

        await prisma.connection.update({
          where: { id: connection.id },
          data: {
            lastSyncedAt: now,
            nextSyncAt,
            isSyncing: false
          }
        })

        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          success: true
        })

      } catch (error) {
        // Reset syncing flag on error
        await prisma.connection.update({
          where: { id: connection.id },
          data: { isSyncing: false }
        })

        console.error(`Error syncing connection ${connection.id}:`, error)
        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Processed ${connectionsToSync.length} connection(s)`,
      synced: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    })

  } catch (error) {
    console.error('Auto-sync error:', error)
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Sync a single mapping from external database
 * (Shared logic with sync-now endpoint)
 */
async function syncMapping(connection: any, mapping: any) {
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

    // Get existing mapped records
    const existingRecords = await prisma.mappedRecord.findMany({
      where: {
        connectionId: connection.id,
        mappingId: mapping.id
      }
    })

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
        // Update existing record
        await prisma.mappedRecord.update({
          where: { id: existing.id },
          data: {
            data: mappedData,
            isActive: true,
            syncedAt: new Date()
          }
        })
      } else {
        // Insert new record
        await prisma.mappedRecord.create({
          data: {
            connectionId: connection.id,
            mappingId: mapping.id,
            externalId,
            data: mappedData,
            isActive: true
          }
        })
      }
    }

    // Mark records not found in external data as inactive
    for (const [externalId, record] of existingMap.entries()) {
      if (!externalMap.has(externalId)) {
        await prisma.mappedRecord.update({
          where: { id: record.id },
          data: {
            isActive: false,
            syncedAt: new Date()
          }
        })
      }
    }

  } finally {
    await connector.close()
  }
}


