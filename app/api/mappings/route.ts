import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createConnector } from '@/lib/db-connectors/factory'
import { decrypt } from '@/lib/encryption'
import { getUserIdFromRequest } from '@/lib/followup-auth-middleware'

const prisma = new PrismaClient()

interface MappingFields {
  status: string
  date: string
  contact: string
  pk?: string
  last_touch?: string
}

interface ValidationIssue {
  field: string
  code: string
  message: string
}

interface PreviewData {
  rows: Array<{
    pk: string
    status: string
    date: string
    contact: string
    last_touch?: string
  }>
  health: {
    resourceExists: boolean
    columnsMapped: boolean
    sampleRowsFound: number
    lastValidated: string
  }
  metrics: {
    rowCount: number
    contactNonNull: number
    dateParseSuccess: boolean
    statusValid: boolean
    warnings: string[]
  }
}

// Canonical field constants
const CANONICAL_FIELDS = ['status', 'date', 'contact', 'pk', 'last_touch'] as const
const REQUIRED_FIELDS = ['status', 'date', 'contact'] as const

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

    const mappings = await prisma.mapping.findMany({
      where: {
        userId: userId // Only get mappings for the authenticated user (filters out NULL userIds)
      },
      include: {
        connection: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      ok: true,
      mappings
    })
  } catch (error) {
    console.error('Error fetching mappings:', error)
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, resource, fields, validateOnly = false } = body

    // Get authenticated user ID
    // For validation-only requests, authentication is optional (setup flow)
    // For saving mappings, authentication is required
    const userId = await getUserIdFromRequest(request)
    
    // If saving (not just validating), require authentication
    if (!validateOnly && !userId) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'general',
          code: 'AUTH_REQUIRED',
          message: 'Authentication required to save mappings'
        }]
      }, { status: 401 })
    }

    // Validate request structure
    if (!connectionId || !resource || !fields) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'general',
          code: 'MISSING_FIELDS',
          message: 'Connection ID, resource, and fields are required'
        }]
      }, { status: 400 })
    }

    // Server-side validation using actual database connection
    const validationResult = await validateMappingWithDatabase(connectionId, resource, fields)
    
    if (validationResult.issues.length > 0) {
      return NextResponse.json({
        ok: false,
        issues: validationResult.issues
      }, { status: 400 })
    }

    // If validateOnly, return preview data
    if (validateOnly) {
      return NextResponse.json({
        ok: true,
        preview: validationResult.preview
      })
    }

    // Verify connection exists - handle backward compatibility
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
        issues: [{
          field: 'connection',
          code: 'CONNECTION_NOT_FOUND',
          message: 'Database connection not found'
        }]
      }, { status: 400 })
    }

    // Save mapping - userId is guaranteed to exist here (we checked above)
    console.log('Saving mapping with:', { connectionId, resource, fields, userId })
    
    // Try to find existing mapping first (for this user)
    let mapping = await prisma.mapping.findFirst({
      where: {
        userId: userId!, // Safe to assert here since we checked above
        connectionId,
        resource
      }
    })

    if (mapping) {
      // Update existing mapping
      mapping = await prisma.mapping.update({
        where: { id: mapping.id },
        data: {
          fields,
          validatedAt: new Date(),
          updatedAt: new Date()
        }
      })
    } else {
      // Create new mapping
      mapping = await prisma.mapping.create({
        data: {
          userId: userId!, // Safe to assert - we checked authentication above
          connectionId,
          resource,
          fields,
          validatedAt: new Date()
        }
      })
    }

    console.log('Mapping saved:', mapping.id)

    // Store validation results
    try {
      await prisma.mappingValidation.create({
        data: {
          mappingId: mapping.id,
          valid: true,
          details: validationResult.metrics
        }
      })
      console.log('Validation results stored')
    } catch (validationError) {
      console.error('Failed to store validation results:', validationError)
      // Don't fail the entire operation if validation storage fails
    }

    return NextResponse.json({
      ok: true,
      mappingId: mapping.id,
      summary: {
        resource: mapping.resource,
        fields: mapping.fields,
        metrics: validationResult.metrics
      }
    })

  } catch (error) {
    console.error('Mapping API error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    return NextResponse.json({
      ok: false,
      issues: [{
        field: 'general',
        code: 'SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error'
      }]
    }, { status: 500 })
  }
}

async function validateMappingWithDatabase(connectionId: string, resource: string, fields: MappingFields): Promise<{issues: ValidationIssue[], preview?: PreviewData, metrics?: any}> {
  const issues: ValidationIssue[] = []

  try {
    // Get connection details - handle backward compatibility
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
      issues.push({
        field: 'connection',
        code: 'CONNECTION_NOT_FOUND',
        message: 'Database connection not found'
      })
      return { issues }
    }

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
        issues.push({
          field: 'connection',
          code: 'CONNECTION_FAILED',
          message: 'Database connection is not available'
        })
        return { issues }
      }

      // Get table columns
      const tableColumns = await connector.listColumns(resource)
      
      // Validate required fields
      for (const field of REQUIRED_FIELDS) {
        if (!fields[field as keyof MappingFields]) {
          issues.push({
            field,
            code: 'REQUIRED_FIELD',
            message: `${field} field is required`
          })
        }
      }

      // Validate field mappings against actual table columns
      for (const [canonicalField, actualField] of Object.entries(fields)) {
        if (!actualField) continue

        // Check if column exists in the actual table
        if (!tableColumns.some(col => col.name === actualField)) {
          issues.push({
            field: canonicalField,
            code: 'INVALID_COLUMN',
            message: `'${actualField}' is not a column in '${resource}' table`
          })
        }
      }

      // Generate preview data if no issues
      let preview: PreviewData | undefined
      let metrics: any = {}

      if (issues.length === 0) {
        try {
          // Get sample data from the actual table
          const fieldNames = Object.values(fields).filter(Boolean)
          const rawSampleData = await connector.sampleData(resource, fieldNames)
          
          // Transform the sample data to match our PreviewData format
          const sampleData = rawSampleData.map((row, index) => ({
            pk: (fields.pk && row[fields.pk]) || (index + 1).toString(),
            status: fields.status ? (row[fields.status] || '') : '',
            date: fields.date ? (row[fields.date] || '') : '',
            contact: fields.contact ? (row[fields.contact] || '') : '',
            last_touch: fields.last_touch ? (row[fields.last_touch] || '') : ''
          }))
          
          preview = {
            rows: sampleData,
            health: {
              resourceExists: true,
              columnsMapped: true,
              sampleRowsFound: sampleData.length,
              lastValidated: new Date().toISOString()
            },
            metrics: {
              rowCount: sampleData.length,
              contactNonNull: sampleData.filter(row => row.contact).length,
              dateParseSuccess: sampleData.every(row => row.date),
              statusValid: sampleData.every(row => row.status),
              warnings: []
            }
          }
          metrics = preview.metrics
        } catch (error) {
          console.error('Preview generation error:', error)
          issues.push({
            field: 'general',
            code: 'PREVIEW_ERROR',
            message: 'Failed to generate preview data'
          })
        }
      }

      return { issues, preview, metrics }

    } finally {
      await connector.close()
    }

  } catch (error) {
    console.error('Validation error:', error)
    issues.push({
      field: 'general',
      code: 'VALIDATION_ERROR',
      message: 'Failed to validate mapping'
    })
    return { issues }
  }
}