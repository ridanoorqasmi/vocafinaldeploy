import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createConnector } from '@/lib/db-connectors/factory'
import { decrypt } from '@/lib/encryption'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    const table = searchParams.get('table')

    if (!connectionId || !table) {
      return NextResponse.json({
        ok: false,
        error: 'Missing connectionId or table parameter'
      }, { status: 400 })
    }

    // Get connection details - use raw query for backward compatibility
    // This handles cases where sync columns don't exist yet
    let connection: any
    try {
      connection = await prisma.connection.findUnique({
        where: { id: connectionId }
      })
    } catch (error: any) {
      // If P2022 error (column doesn't exist), use raw query
      if (error?.code === 'P2022') {
        const result = await prisma.$queryRaw<Array<{
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
        connection = result[0]
      } else {
        throw error
      }
    }

    if (!connection) {
      return NextResponse.json({
        ok: false,
        error: 'Connection not found'
      }, { status: 404 })
    }

    // Decrypt credentials with error handling
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
      // Test connection first
      const isConnected = await connector.testConnection()
      if (!isConnected) {
        // Update connection status - use raw query for backward compatibility
        try {
          await prisma.connection.update({
            where: { id: connectionId },
            data: { status: 'UNREACHABLE' }
          })
        } catch (updateError: any) {
          // If update fails due to missing columns, use raw SQL
          if (updateError?.code === 'P2022') {
            await prisma.$executeRaw`
              UPDATE external_connections
              SET status = 'UNREACHABLE'::"ConnectionStatus", "updatedAt" = NOW()
              WHERE id = ${connectionId}
            `
          }
        }

        return NextResponse.json({
          ok: false,
          error: 'Database connection is no longer available'
        }, { status: 400 })
      }

      // Get columns for the table
      const columns = await connector.listColumns(table)

      // Update last tested timestamp - use raw query for backward compatibility
      try {
        await prisma.connection.update({
          where: { id: connectionId },
          data: { lastTested: new Date(), status: 'ACTIVE' }
        })
      } catch (updateError: any) {
        // If update fails due to missing columns, use raw SQL
        if (updateError?.code === 'P2022') {
          await prisma.$executeRaw`
            UPDATE external_connections
            SET "lastTested" = NOW(), status = 'ACTIVE'::"ConnectionStatus", "updatedAt" = NOW()
            WHERE id = ${connectionId}
          `
        }
      }

      return NextResponse.json({
        ok: true,
        table,
        columns
      })

    } finally {
      await connector.close()
    }

  } catch (error) {
    console.error('Column introspection error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to introspect table columns'
    }, { status: 500 })
  }
}
