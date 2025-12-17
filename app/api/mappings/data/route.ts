import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createConnector } from '@/lib/db-connectors/factory'
import { decrypt } from '@/lib/encryption'
import { getUserIdFromRequest } from '@/lib/followup-auth-middleware'

const prisma = new PrismaClient()

interface SyncInfo {
  syncFrequencyMinutes: number | null
  isAutoSyncEnabled: boolean
  lastSyncedAt: string | null
  nextSyncAt: string | null
  isSyncing: boolean
}

interface MappingData {
  mappingId: string
  resource: string
  connectionName: string
  connectionType: string
  connectionId: string | null
  fields: {
    canonical: string
    actual: string
  }[]
  columns: string[]
  data: Array<Record<string, any>>
  rowCount: number
  error?: string
  syncInfo: SyncInfo | null
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({
        ok: false,
        message: 'Authentication required'
      }, { status: 401 })
    }

    // Get all mappings for the user
    // First try with sync fields, fallback to basic fields if they don't exist
    let mappings: any[]
    try {
      mappings = await prisma.mapping.findMany({
        where: {
          userId: userId
        },
        include: {
          connection: {
            select: {
              id: true,
              name: true,
              type: true,
              host: true,
              port: true,
              database: true,
              username: true,
              password: true,
              config: true,
              syncFrequencyMinutes: true,
              isAutoSyncEnabled: true,
              lastSyncedAt: true,
              nextSyncAt: true,
              isSyncing: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    } catch (error: any) {
      // If sync columns don't exist, fetch without them
      if (error?.code === 'P2022' || error?.message?.includes('does not exist')) {
        mappings = await prisma.mapping.findMany({
          where: {
            userId: userId
          },
          include: {
            connection: {
              select: {
                id: true,
                name: true,
                type: true,
                host: true,
                port: true,
                database: true,
                username: true,
                password: true,
                config: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
        // Add default sync values
        mappings = mappings.map(m => ({
          ...m,
          connection: m.connection ? {
            ...m.connection,
            syncFrequencyMinutes: null,
            isAutoSyncEnabled: true,
            lastSyncedAt: null,
            nextSyncAt: null,
            isSyncing: false
          } : null
        }))
      } else {
        throw error
      }
    }

    // Fetch actual data for each mapping
    const mappingData: MappingData[] = []

    for (const mapping of mappings) {
      if (!mapping.connection) {
        mappingData.push({
          mappingId: mapping.id,
          resource: mapping.resource,
          connectionName: 'Unknown',
          connectionType: 'Unknown',
          connectionId: null,
          fields: [],
          columns: [],
          data: [],
          rowCount: 0,
          error: 'No connection found',
          syncInfo: null
        })
        continue
      }

      try {
        // Decrypt credentials
        const decryptedPassword = mapping.connection.password ? decrypt(mapping.connection.password) : ''
        const decryptedServiceKey = mapping.connection.config && (mapping.connection.config as any).serviceKey 
          ? decrypt((mapping.connection.config as any).serviceKey) 
          : undefined

        // Create connector
        const config = {
          host: mapping.connection.host,
          port: mapping.connection.port || undefined,
          database: mapping.connection.database,
          username: mapping.connection.username,
          password: decryptedPassword,
          ssl: (mapping.connection.config as any)?.ssl || false,
          serviceKey: decryptedServiceKey
        }

        const connector = createConnector(mapping.connection.type, config)

        try {
          // Test connection
          const isConnected = await connector.testConnection()
          if (!isConnected) {
            mappingData.push({
              mappingId: mapping.id,
              resource: mapping.resource,
              connectionName: mapping.connection.name,
              connectionType: mapping.connection.type,
              connectionId: mapping.connection.id,
              fields: [],
              columns: [],
              data: [],
              rowCount: 0,
              error: 'Database connection failed',
              syncInfo: {
                syncFrequencyMinutes: mapping.connection.syncFrequencyMinutes ?? null,
                isAutoSyncEnabled: mapping.connection.isAutoSyncEnabled ?? true,
                lastSyncedAt: mapping.connection.lastSyncedAt ? mapping.connection.lastSyncedAt.toISOString() : null,
                nextSyncAt: mapping.connection.nextSyncAt ? mapping.connection.nextSyncAt.toISOString() : null,
                isSyncing: mapping.connection.isSyncing ?? false
              }
            })
            continue
          }

          // Get all columns from the table
          const tableColumns = await connector.listColumns(mapping.resource)
          const columnNames = tableColumns.map(col => col.name)

          // Extract field mappings
          const fields = mapping.fields as Record<string, string>
          const fieldMappings = Object.entries(fields)
            .filter(([_, actual]) => actual)
            .map(([canonical, actual]) => ({
              canonical,
              actual
            }))

          // Get all columns to display (both mapped and unmapped)
          const allColumns = [...new Set([...columnNames, ...Object.values(fields).filter(Boolean)])]

          // Fetch sample data
          const sampleData = await connector.sampleData(mapping.resource, allColumns)
          
          // Get row count from sample data
          const rowCount = sampleData.length

          mappingData.push({
            mappingId: mapping.id,
            resource: mapping.resource,
            connectionName: mapping.connection.name,
            connectionType: mapping.connection.type,
            connectionId: mapping.connection.id,
            fields: fieldMappings,
            columns: allColumns,
            data: sampleData,
            rowCount,
            syncInfo: {
              syncFrequencyMinutes: mapping.connection.syncFrequencyMinutes ?? null,
              isAutoSyncEnabled: mapping.connection.isAutoSyncEnabled ?? true,
              lastSyncedAt: mapping.connection.lastSyncedAt ? mapping.connection.lastSyncedAt.toISOString() : null,
              nextSyncAt: mapping.connection.nextSyncAt ? mapping.connection.nextSyncAt.toISOString() : null,
              isSyncing: mapping.connection.isSyncing ?? false
            }
          })

        } finally {
          await connector.close()
        }

      } catch (error) {
        console.error(`Error fetching data for mapping ${mapping.id}:`, error)
        mappingData.push({
          mappingId: mapping.id,
          resource: mapping.resource,
          connectionName: mapping.connection?.name || 'Unknown',
          connectionType: mapping.connection?.type || 'Unknown',
          connectionId: mapping.connection?.id || null,
          fields: [],
          columns: [],
          data: [],
          rowCount: 0,
          error: error instanceof Error ? error.message : 'Failed to fetch data',
          syncInfo: mapping.connection ? {
            syncFrequencyMinutes: mapping.connection.syncFrequencyMinutes ?? null,
            isAutoSyncEnabled: mapping.connection.isAutoSyncEnabled ?? true,
            lastSyncedAt: mapping.connection.lastSyncedAt ? mapping.connection.lastSyncedAt.toISOString() : null,
            nextSyncAt: mapping.connection.nextSyncAt ? mapping.connection.nextSyncAt.toISOString() : null,
            isSyncing: mapping.connection.isSyncing ?? false
          } : null
        })
      }
    }

    return NextResponse.json({
      ok: true,
      mappings: mappingData
    })

  } catch (error) {
    console.error('Error fetching mapped database data:', error)
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
