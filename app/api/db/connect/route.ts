import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createConnector, DatabaseType } from '@/lib/db-connectors/factory'
import { encrypt, maskCredentials } from '@/lib/encryption'

const prisma = new PrismaClient()

interface ConnectRequest {
  dbType: DatabaseType
  name: string
  config: {
    host: string
    port?: number
    database: string
    username: string
    password: string
    ssl?: boolean
    serviceKey?: string
  }
  syncFrequencyMinutes?: number
  isAutoSyncEnabled?: boolean
}

export async function POST(request: NextRequest) {
  try {
    console.log('Database connection request received')
    const body: ConnectRequest = await request.json()
    console.log('Request body:', { dbType: body.dbType, name: body.name, config: { ...body.config, password: '***' } })
    const { dbType, name, config, syncFrequencyMinutes = 60, isAutoSyncEnabled = true } = body

    // Validate required fields
    if (!dbType || !name || !config.host || !config.database || !config.username || !config.password) {
      console.log('Validation failed - missing required fields')
      return NextResponse.json({
        ok: false,
        error: 'Missing required fields: dbType, name, host, database, username, password'
      }, { status: 400 })
    }

    // Firebase requires service key
    if (dbType === 'FIREBASE' && !config.serviceKey) {
      return NextResponse.json({
        ok: false,
        error: 'Firebase requires service key'
      }, { status: 400 })
    }

    // Test connection
    console.log('Creating connector for:', dbType)
    const connector = createConnector(dbType, config)
    console.log('Testing connection...')
    
    let connectionError: string | null = null
    let isConnected = false
    
    try {
      isConnected = await connector.testConnection()
      console.log('Connection test result:', isConnected)
    } catch (error) {
      console.error('Connection test error:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      })
      connectionError = error instanceof Error ? error.message : 'Unknown connection error'
      isConnected = false
    }

    if (!isConnected) {
      console.log('Connection failed, closing connector')
      await connector.close()
      
      // Provide more specific error messages based on the actual error
      let errorMessage = 'Failed to connect to database. Please check your credentials and network connectivity.'
      
      if (connectionError) {
        // Use the actual error message if available
        if (connectionError.includes('ECONNREFUSED') || connectionError.includes('connection refused')) {
          errorMessage = 'Connection refused. Please ensure the database server is running and accessible.'
        } else if (connectionError.includes('ENOTFOUND') || connectionError.includes('getaddrinfo ENOTFOUND')) {
          errorMessage = 'Host not found. Please verify the host address is correct.'
        } else if (connectionError.includes('authentication failed') || connectionError.includes('password authentication failed')) {
          errorMessage = 'Authentication failed. Please check your username and password.'
        } else if (connectionError.includes('database') && connectionError.includes('does not exist')) {
          errorMessage = 'Database does not exist. Please verify the database name is correct.'
        } else if (connectionError.includes('timeout')) {
          errorMessage = 'Connection timeout. Please check your network connection and firewall settings.'
        } else if (connectionError.includes('relation') && connectionError.includes('does not exist')) {
          // This is a table/relation error, not a database error
          errorMessage = 'Connection successful, but some tables may not exist. This is normal for new databases.'
        } else {
          // Show the actual error message for debugging
          errorMessage = `Connection failed: ${connectionError}`
        }
      } else {
        // Fallback to generic message based on host type
        if (config.host === 'localhost' || config.host === '127.0.0.1') {
          errorMessage += ' For local connections, ensure PostgreSQL is running and accessible.'
        } else {
          errorMessage += ' For external connections, verify the host address, port, and firewall settings.'
        }
      }
      
      return NextResponse.json({
        ok: false,
        error: errorMessage
      }, { status: 400 })
    }

    // Get available tables
    let tables: string[] = []
    try {
      console.log('Attempting to list tables...')
      tables = await connector.listTables()
      console.log('Tables found:', tables)
    } catch (tableError) {
      console.error('Error listing tables:', tableError)
      console.error('Table error details:', {
        message: tableError instanceof Error ? tableError.message : 'Unknown error',
        stack: tableError instanceof Error ? tableError.stack : undefined
      })
      // If we can't list tables, that's okay - the connection still works
      // We'll just return an empty table list
      tables = []
    }
    await connector.close()

    // Store connection securely
    const encryptedPassword = encrypt(config.password)
    const encryptedServiceKey = config.serviceKey ? encrypt(config.serviceKey) : null

    // Prepare base connection data
    const baseConnectionData: any = {
      tenantId: 'default', // TODO: Get from auth context
      type: dbType,
      name,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: encryptedPassword,
      config: {
        ssl: config.ssl,
        serviceKey: encryptedServiceKey
      },
      status: 'ACTIVE',
      lastTested: new Date()
    }

    // Try to create connection with sync fields first (if migration has been run)
    // If that fails with P2022 (column doesn't exist), fall back to creating without sync fields
    let connection
    try {
      // Calculate next sync time if auto-sync is enabled
      const now = new Date()
      const nextSyncAt = isAutoSyncEnabled && syncFrequencyMinutes
        ? new Date(now.getTime() + (syncFrequencyMinutes * 60 * 1000))
        : null

      connection = await prisma.connection.create({
        data: {
          ...baseConnectionData,
          syncFrequencyMinutes,
          isAutoSyncEnabled,
          nextSyncAt
        }
      })
    } catch (error: any) {
      // Check if error is P2022 (column doesn't exist) - means migration hasn't been run
      if (error?.code === 'P2022' && error?.meta?.column) {
        console.log(`Column '${error.meta.column}' does not exist in database. Creating connection without sync fields (backward compatibility mode).`)
        
        // Use Prisma's raw SQL to insert without the new columns
        // This bypasses Prisma Client's schema validation
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
          createdAt: Date
          updatedAt: Date
        }>>`
          INSERT INTO external_connections (
            id, "tenantId", type, name, host, port, database, username, password, config, status, "lastTested", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            ${baseConnectionData.tenantId || 'default'},
            ${baseConnectionData.type}::"DatabaseType",
            ${baseConnectionData.name},
            ${baseConnectionData.host},
            ${baseConnectionData.port || null},
            ${baseConnectionData.database},
            ${baseConnectionData.username},
            ${baseConnectionData.password},
            ${JSON.stringify(baseConnectionData.config)}::jsonb,
            ${baseConnectionData.status}::"ConnectionStatus",
            ${baseConnectionData.lastTested},
            NOW(),
            NOW()
          )
          RETURNING *
        `
        
        const rawConnection = result[0]
        if (!rawConnection) {
          throw new Error('Failed to create connection in backward compatibility mode')
        }
        
        // Map raw result to match Prisma's Connection type structure
        connection = {
          id: rawConnection.id,
          tenantId: rawConnection.tenantId,
          type: rawConnection.type as any,
          name: rawConnection.name,
          host: rawConnection.host,
          port: rawConnection.port,
          database: rawConnection.database,
          username: rawConnection.username,
          password: rawConnection.password,
          config: rawConnection.config,
          status: rawConnection.status as any,
          lastTested: rawConnection.lastTested,
          createdAt: rawConnection.createdAt,
          updatedAt: rawConnection.updatedAt
        } as any
      } else {
        // For any other error, throw it
        throw error
      }
    }

    // Log connection attempt (masked credentials)
    console.log('Database connection created:', {
      id: connection.id,
      type: dbType,
      name,
      config: maskCredentials(config)
    })

    return NextResponse.json({
      ok: true,
      dbId: connection.id,
      tables,
      connection: {
        id: connection.id,
        name: connection.name,
        type: dbType,
        status: connection.status
      }
    })

  } catch (error) {
    console.error('Database connection error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
