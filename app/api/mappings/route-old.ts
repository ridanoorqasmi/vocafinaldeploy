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

async function validateMapping(resource: string, fields: MappingFields): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  // Check if resource exists
  if (!RESOURCE_SCHEMAS[resource as keyof typeof RESOURCE_SCHEMAS]) {
    issues.push({
      field: 'resource',
      code: 'RESOURCE_NOT_FOUND',
      message: `We couldn't find the '${resource}' table. Check the name or pick from the list.`
    })
    return issues
  }

  const schema = RESOURCE_SCHEMAS[resource as keyof typeof RESOURCE_SCHEMAS]

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

  // Validate field mappings
  for (const [canonicalField, actualField] of Object.entries(fields)) {
    if (!actualField) continue

    // Check if column exists
    if (!schema.columns.includes(actualField)) {
      issues.push({
        field: canonicalField,
        code: 'INVALID_COLUMN',
        message: `'${actualField}' isn't a column in '${resource}'. Choose a valid column.`
      })
    }

    // Type-specific validation
    if (canonicalField === 'date' && actualField) {
      if (!schema.datetimeColumns.includes(actualField)) {
        issues.push({
          field: 'date',
          code: 'TYPE_MISMATCH',
          message: `'${actualField}' doesn't look like a date/time column.`
        })
      }
    }

    if (canonicalField === 'contact' && actualField) {
      if (!schema.contactColumns.includes(actualField)) {
        issues.push({
          field: 'contact',
          code: 'TYPE_MISMATCH',
          message: `'${actualField}' doesn't look like a contact column.`
        })
      }
    }
  }

  // Validate data quality
  if (resource === 'Lead') {
    const dataQualityIssues = await validateDataQuality(fields)
    issues.push(...dataQualityIssues)
  }

  return issues
}

async function validateDataQuality(fields: MappingFields): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  try {
    // Sample a few rows to check data quality
    const sampleRows = await prisma.lead.findMany({
      take: 10,
      select: {
        id: true,
        [fields.status]: true,
        [fields.date]: true,
        [fields.contact]: true,
        [fields.last_touch || '']: true
      }
    })

    // Check contact field quality
    if (fields.contact && sampleRows.length > 0) {
      const nonNullContacts = sampleRows.filter(row => 
        row[fields.contact as keyof typeof row] && 
        String(row[fields.contact as keyof typeof row]).trim() !== ''
      )
      
      if (nonNullContacts.length < sampleRows.length * 0.5) {
        issues.push({
          field: 'contact',
          code: 'POOR_DATA_QUALITY',
          message: `Most rows in '${fields.contact}' are empty. Map a column with usable contacts.`
        })
      }
    }

    // Check date field quality
    if (fields.date && sampleRows.length > 0) {
      const validDates = sampleRows.filter(row => {
        const dateValue = row[fields.date as keyof typeof row]
        return dateValue && !isNaN(new Date(dateValue as string).getTime())
      })
      
      if (validDates.length < sampleRows.length * 0.5) {
        issues.push({
          field: 'date',
          code: 'POOR_DATA_QUALITY',
          message: `Most rows in '${fields.date}' don't contain valid dates.`
        })
      }
    }

  } catch (error) {
    console.error('Data quality validation error:', error)
    issues.push({
      field: 'general',
      code: 'VALIDATION_ERROR',
      message: 'Failed to validate data quality'
    })
  }

  return issues
}

async function generatePreviewData(resource: string, fields: MappingFields): Promise<PreviewData> {
  try {
    let rows: any[] = []
    let sampleRowsFound = 0

    if (resource === 'Lead') {
      const leadRows = await prisma.lead.findMany({
        take: 10,
        select: {
          id: true,
          [fields.status]: true,
          [fields.date]: true,
          [fields.contact]: true,
          [fields.last_touch || '']: true
        }
      })

      rows = leadRows.map(row => ({
        pk: String(row.id),
        status: String(row[fields.status as keyof typeof row] || ''),
        date: row[fields.date as keyof typeof row] ? 
          new Date(row[fields.date as keyof typeof row] as Date).toISOString() : '',
        contact: String(row[fields.contact as keyof typeof row] || ''),
        last_touch: fields.last_touch && row[fields.last_touch as keyof typeof row] ? 
          new Date(row[fields.last_touch as keyof typeof row] as Date).toISOString() : undefined
      }))

      sampleRowsFound = await prisma.lead.count()
    }

    return {
      rows,
      health: {
        resourceExists: true,
        columnsMapped: true,
        sampleRowsFound,
        lastValidated: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Preview generation error:', error)
    return {
      rows: [],
      health: {
        resourceExists: false,
        columnsMapped: false,
        sampleRowsFound: 0,
        lastValidated: new Date().toISOString()
      }
    }
  }
}
