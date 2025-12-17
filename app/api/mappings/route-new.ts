import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createConnector } from '@/lib/db-connectors/factory'
import { decrypt } from '@/lib/encryption'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connectionId, resource, fields, validateOnly = false } = body

    // Validate request structure
    if (!resource || !fields) {
      return NextResponse.json({
        ok: false,
        issues: [{
          field: 'general',
          code: 'MISSING_FIELDS',
          message: 'Resource and fields are required'
        }]
      }, { status: 400 })
    }

    // Server-side validation
    const validationResult = await validateMapping(connectionId, resource, fields)
    
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

    // Save mapping
    const mapping = await prisma.mapping.upsert({
      where: { 
        connectionId_resource: connectionId ? {
          connectionId,
          resource
        } : undefined
      },
      update: {
        fields,
        validatedAt: new Date(),
        updatedAt: new Date()
      },
      create: {
        connectionId,
        resource,
        fields,
        validatedAt: new Date()
      }
    })

    // Store validation results
    await prisma.mappingValidation.create({
      data: {
        mappingId: mapping.id,
        valid: true,
        details: validationResult.metrics
      }
    })

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
    return NextResponse.json({
      ok: false,
      issues: [{
        field: 'general',
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }]
    }, { status: 500 })
  }
}

async function validateMapping(connectionId: string | null, resource: string, fields: MappingFields): Promise<{
  issues: ValidationIssue[]
  preview?: PreviewData
  metrics?: any
}> {
  const issues: ValidationIssue[] = []

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

  if (issues.length > 0) {
    return { issues }
  }

  // If no connection ID, use internal Lead table
  if (!connectionId) {
    return await validateInternalMapping(resource, fields)
  }

  // Validate external connection
  try {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    })

    if (!connection) {
      issues.push({
        field: 'connectionId',
        code: 'CONNECTION_NOT_FOUND',
        message: 'Database connection not found'
      })
      return { issues }
    }

    // Decrypt credentials and create connector
    const decryptedPassword = decrypt(connection.password)
    const decryptedServiceKey = connection.config && (connection.config as any).serviceKey 
      ? decrypt((connection.config as any).serviceKey) 
      : undefined

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
          field: 'connectionId',
          code: 'CONNECTION_FAILED',
          message: 'Database connection is no longer available'
        })
        return { issues }
      }

      // Get table columns
      const columns = await connector.listColumns(resource)
      const columnNames = columns.map(col => col.name)

      // Validate field mappings
      for (const [canonicalField, actualField] of Object.entries(fields)) {
        if (!actualField) continue

        if (!columnNames.includes(actualField)) {
          issues.push({
            field: canonicalField,
            code: 'INVALID_COLUMN',
            message: `'${actualField}' isn't a column in '${resource}'. Choose a valid column.`
          })
        }
      }

      if (issues.length > 0) {
        return { issues }
      }

      // Sample data and validate quality
      const sampleData = await connector.sampleData(resource, Object.values(fields).filter(Boolean) as string[])
      const metrics = await validateDataQuality(fields, sampleData)
      
      // Generate preview
      const preview: PreviewData = {
        rows: sampleData.map((row, index) => ({
          pk: String(row[fields.pk || 'id'] || index),
          status: String(row[fields.status] || ''),
          date: row[fields.date] ? new Date(row[fields.date] as Date).toISOString() : '',
          contact: String(row[fields.contact] || ''),
          last_touch: fields.last_touch && row[fields.last_touch] ? 
            new Date(row[fields.last_touch] as Date).toISOString() : undefined
        })),
        health: {
          resourceExists: true,
          columnsMapped: true,
          sampleRowsFound: sampleData.length,
          lastValidated: new Date().toISOString()
        },
        metrics
      }

      return { issues, preview, metrics }

    } finally {
      await connector.close()
    }

  } catch (error) {
    console.error('External validation error:', error)
    issues.push({
      field: 'general',
      code: 'VALIDATION_ERROR',
      message: 'Failed to validate external database'
    })
    return { issues }
  }
}

async function validateInternalMapping(resource: string, fields: MappingFields): Promise<{
  issues: ValidationIssue[]
  preview?: PreviewData
  metrics?: any
}> {
  const issues: ValidationIssue[] = []

  // For internal Lead table
  if (resource === 'Lead') {
    try {
      const sampleData = await prisma.lead.findMany({
        take: 10,
        select: {
          id: true,
          [fields.status]: true,
          [fields.date]: true,
          [fields.contact]: true,
          [fields.last_touch || '']: true
        }
      })

      const metrics = await validateDataQuality(fields, sampleData)
      
      const preview: PreviewData = {
        rows: sampleData.map(row => ({
          pk: String(row.id),
          status: String(row[fields.status as keyof typeof row] || ''),
          date: row[fields.date as keyof typeof row] ? 
            new Date(row[fields.date as keyof typeof row] as Date).toISOString() : '',
          contact: String(row[fields.contact as keyof typeof row] || ''),
          last_touch: fields.last_touch && row[fields.last_touch as keyof typeof row] ? 
            new Date(row[fields.last_touch as keyof typeof row] as Date).toISOString() : undefined
        })),
        health: {
          resourceExists: true,
          columnsMapped: true,
          sampleRowsFound: sampleData.length,
          lastValidated: new Date().toISOString()
        },
        metrics
      }

      return { issues, preview, metrics }
    } catch (error) {
      issues.push({
        field: 'general',
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate internal database'
      })
      return { issues }
    }
  }

  issues.push({
    field: 'resource',
    code: 'RESOURCE_NOT_FOUND',
    message: `We couldn't find the '${resource}' table. Check the name or pick from the list.`
  })

  return { issues }
}

async function validateDataQuality(fields: MappingFields, sampleData: any[]): Promise<{
  rowCount: number
  contactNonNull: number
  dateParseSuccess: boolean
  statusValid: boolean
  warnings: string[]
}> {
  const warnings: string[] = []
  let contactNonNull = 0
  let dateParseSuccess = 0
  let statusValid = 0

  for (const row of sampleData) {
    // Check contact field
    if (fields.contact && row[fields.contact]) {
      const contactValue = String(row[fields.contact]).trim()
      if (contactValue && contactValue !== '') {
        contactNonNull++
      }
    }

    // Check date field
    if (fields.date && row[fields.date]) {
      try {
        new Date(row[fields.date])
        dateParseSuccess++
      } catch (error) {
        // Invalid date
      }
    }

    // Check status field
    if (fields.status && row[fields.status]) {
      const statusValue = String(row[fields.status]).trim()
      if (statusValue && statusValue !== '') {
        statusValid++
      }
    }
  }

  const totalRows = sampleData.length
  const contactRatio = totalRows > 0 ? contactNonNull / totalRows : 0
  const dateRatio = totalRows > 0 ? dateParseSuccess / totalRows : 0
  const statusRatio = totalRows > 0 ? statusValid / totalRows : 0

  if (contactRatio < 0.3) {
    warnings.push(`Contact field has only ${Math.round(contactRatio * 100)}% valid values`)
  }

  if (dateRatio < 0.3) {
    warnings.push(`Date field has only ${Math.round(dateRatio * 100)}% valid values`)
  }

  if (statusRatio < 0.3) {
    warnings.push(`Status field has only ${Math.round(statusRatio * 100)}% valid values`)
  }

  return {
    rowCount: totalRows,
    contactNonNull: contactRatio,
    dateParseSuccess: dateRatio > 0.5,
    statusValid: statusRatio > 0.5,
    warnings
  }
}
