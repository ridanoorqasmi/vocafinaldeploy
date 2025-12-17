import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createConnector } from '@/lib/db-connectors/factory'
import { decrypt } from '@/lib/encryption'
import { getUserIdFromRequest } from '@/lib/followup-auth-middleware'

const prisma = new PrismaClient()

/**
 * POST /api/mapped-database/sync-now
 * Manually trigger sync for a specific connection
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({
        ok: false,
        message: 'Authentication required'
      }, { status: 401 })
    }

    const body = await request.json()
    const { connectionId } = body

    if (!connectionId) {
      return NextResponse.json({
        ok: false,
        message: 'Connection ID is required'
      }, { status: 400 })
    }

    // Get connection with mappings - handle backward compatibility
    let connection: any
    try {
      connection = await prisma.connection.findFirst({
        where: {
          id: connectionId,
          // Ensure connection belongs to user's tenant (via mappings)
          mappings: {
            some: {
              userId: userId
            }
          }
        },
        include: {
          mappings: {
            where: {
              userId: userId
            }
          }
        }
      })
    } catch (error: any) {
      // If P2022 error (sync columns don't exist), fetch without them
      if (error?.code === 'P2022') {
        // First verify the connection exists and belongs to user via raw query
        const connectionCheck = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT c.id
          FROM external_connections c
          INNER JOIN followup_mappings m ON m."connectionId" = c.id
          WHERE c.id = ${connectionId} AND m."userId" = ${userId}
          LIMIT 1
        `
        
        if (!connectionCheck || connectionCheck.length === 0) {
          return NextResponse.json({
            ok: false,
            message: 'Connection not found or access denied'
          }, { status: 404 })
        }
        
        // Fetch connection without sync fields
        const connectionData = await prisma.$queryRaw<Array<{
          id: string
          tenantId: string
          type: string
          name: string
          host: string
          port: number | null
          database: string
          username: string
          password: string
          config: any
          status: string
          lastTested: Date | null
        }>>`
          SELECT id, "tenantId", type, name, host, port, database, username, password, config, status, "lastTested"
          FROM external_connections
          WHERE id = ${connectionId}
        `
        
        // Fetch mappings
        const mappings = await prisma.mapping.findMany({
          where: {
            connectionId: connectionId,
            userId: userId
          }
        })
        
        connection = {
          ...connectionData[0],
          mappings: mappings,
          // Add default sync field values for backward compatibility
          syncFrequencyMinutes: null,
          isAutoSyncEnabled: true,
          lastSyncedAt: null,
          nextSyncAt: null,
          isSyncing: false
        }
      } else {
        throw error
      }
    }

    if (!connection) {
      return NextResponse.json({
        ok: false,
        message: 'Connection not found or access denied'
      }, { status: 404 })
    }

    // Check if sync is already in progress (if field exists)
    if (connection.isSyncing) {
      return NextResponse.json({
        ok: false,
        message: 'Sync is already in progress for this connection'
      }, { status: 409 })
    }

    // Set syncing flag - handle backward compatibility
    try {
      await prisma.connection.update({
        where: { id: connectionId },
        data: { isSyncing: true }
      })
    } catch (updateError: any) {
      // If isSyncing column doesn't exist, skip (backward compatibility)
      if (updateError?.code === 'P2022') {
        console.log('isSyncing column not available, skipping lock (backward compatibility)')
      } else {
        throw updateError
      }
    }

    try {
      // Perform sync for each mapping
      const syncResults = []
      
      for (const mapping of connection.mappings) {
        try {
          const result = await syncMapping(connection, mapping)
          syncResults.push({
            mappingId: mapping.id,
            resource: mapping.resource,
            ...result
          })
        } catch (error) {
          console.error(`Error syncing mapping ${mapping.id}:`, error)
          syncResults.push({
            mappingId: mapping.id,
            resource: mapping.resource,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Update connection sync metadata - handle backward compatibility
      const now = new Date()
      const nextSyncAt = connection.isAutoSyncEnabled && connection.syncFrequencyMinutes
        ? new Date(now.getTime() + (connection.syncFrequencyMinutes * 60 * 1000))
        : null

      try {
        await prisma.connection.update({
          where: { id: connectionId },
          data: {
            lastSyncedAt: now,
            nextSyncAt,
            isSyncing: false
          }
        })
      } catch (updateError: any) {
        // If sync columns don't exist, try to update using raw SQL
        if (updateError?.code === 'P2022') {
          console.log('Sync metadata columns not available, attempting raw SQL update (backward compatibility)')
          // Try to update sync fields if they exist, otherwise just update updatedAt
          try {
            // First check if columns exist by trying to update them
            await prisma.$executeRaw`
              UPDATE external_connections
              SET 
                "lastSyncedAt" = ${now},
                "nextSyncAt" = ${nextSyncAt},
                "isSyncing" = false,
                "updatedAt" = NOW()
              WHERE id = ${connectionId}
            `
          } catch (rawError: any) {
            // If raw SQL also fails (columns truly don't exist), just update updatedAt
            console.log('Sync columns do not exist, updating only updatedAt')
            await prisma.$executeRaw`
              UPDATE external_connections
              SET "updatedAt" = NOW()
              WHERE id = ${connectionId}
            `
          }
        } else {
          throw updateError
        }
      }

      const allSuccessful = syncResults.every(r => r.success)
      
      return NextResponse.json({
        ok: true,
        status: allSuccessful ? 'success' : 'partial',
        message: allSuccessful 
          ? 'Data successfully synced'
          : 'Sync completed with some errors',
        lastSyncedAt: now.toISOString(),
        nextSyncAt: nextSyncAt?.toISOString() || null,
        results: syncResults
      })

    } catch (error) {
      // Reset syncing flag on error - handle backward compatibility
      try {
        await prisma.connection.update({
          where: { id: connectionId },
          data: { isSyncing: false }
        })
      } catch (updateError: any) {
        // If isSyncing column doesn't exist, skip (backward compatibility)
        if (updateError?.code === 'P2022') {
          // Ignore - column doesn't exist
        } else {
          console.error('Failed to reset syncing flag:', updateError)
        }
      }

      console.error('Sync error:', error)
      return NextResponse.json({
        ok: false,
        message: error instanceof Error ? error.message : 'Sync failed'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Sync a single mapping from external database
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
    const pkField = fields.pk || 'id' // Primary key field
    
    // Get all columns to fetch
    const allColumns = Object.values(fields).filter(Boolean)
    if (!allColumns.includes(pkField)) {
      allColumns.push(pkField)
    }

    // Fetch all data from external database
    // Note: This uses query method which should fetch all records
    // For large datasets, consider pagination
    const externalData = await connector.query(mapping.resource, {}, 10000) // Limit to 10k records

    // Get existing mapped records for this connection and mapping
    // Handle backward compatibility if mapped_records table doesn't exist
    let existingRecords: any[] = []
    try {
      existingRecords = await prisma.mappedRecord.findMany({
        where: {
          connectionId: connection.id,
          mappingId: mapping.id
        }
      })
    } catch (error: any) {
      // If table doesn't exist (P2021) or column doesn't exist (P2022), return early
      if (error?.code === 'P2021' || error?.code === 'P2022') {
        throw new Error('Sync requires database migration to be run. Please run the migration to enable sync functionality.')
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

    // Track operations
    let inserted = 0
    let updated = 0
    let deactivated = 0

    // Process external data: insert or update
    for (const [externalId, rowData] of externalMap.entries()) {
      if (!externalId) continue // Skip rows without ID

      // Transform row data to match mapping structure
      const mappedData: Record<string, any> = {}
      for (const [canonicalField, actualField] of Object.entries(fields)) {
        if (actualField && rowData[actualField] !== undefined) {
          mappedData[canonicalField] = rowData[actualField]
        }
      }
      // Also store raw data for reference
      mappedData._raw = rowData

      const existing = existingMap.get(externalId)

      if (existing) {
        // Update existing record
        try {
          await prisma.mappedRecord.update({
            where: { id: existing.id },
            data: {
              data: mappedData,
              isActive: true,
              syncedAt: new Date()
            }
          })
          updated++
        } catch (error: any) {
          if (error?.code === 'P2021' || error?.code === 'P2022') {
            throw new Error('Sync requires database migration to be run.')
          }
          throw error
        }
      } else {
        // Insert new record
        try {
          await prisma.mappedRecord.create({
            data: {
              connectionId: connection.id,
              mappingId: mapping.id,
              externalId,
              data: mappedData,
              isActive: true
            }
          })
          inserted++
        } catch (error: any) {
          if (error?.code === 'P2021' || error?.code === 'P2022') {
            throw new Error('Sync requires database migration to be run.')
          }
          throw error
        }
      }
    }

    // Mark records not found in external data as inactive
    for (const [externalId, record] of existingMap.entries()) {
      if (!externalMap.has(externalId)) {
        try {
          await prisma.mappedRecord.update({
            where: { id: record.id },
            data: {
              isActive: false,
              syncedAt: new Date()
            }
          })
          deactivated++
        } catch (error: any) {
          if (error?.code === 'P2021' || error?.code === 'P2022') {
            throw new Error('Sync requires database migration to be run.')
          }
          throw error
        }
      }
    }

    return {
      success: true,
      inserted,
      updated,
      deactivated,
      totalExternal: externalData.length,
      totalMapped: existingRecords.length + inserted - deactivated
    }

  } finally {
    await connector.close()
  }
}

