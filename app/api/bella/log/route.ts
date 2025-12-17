import { NextRequest, NextResponse } from 'next/server'

// Mock database for now - would be replaced with actual Postgres connection
const mockDatabase = {
  interactions: [] as any[],
  tickets: [] as any[],
  analytics: {
    totalInteractions: 0,
    automatedResolutions: 0,
    escalations: 0,
    avgResolutionTime: 0
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, channel, message, intent, confidence, actionTaken, resolutionStatus } = await request.json()

    if (!userId || !message) {
      return NextResponse.json(
        { error: 'userId and message are required' },
        { status: 400 }
      )
    }

    const interaction = {
      id: Date.now().toString(),
      userId,
      channel: channel || 'chat',
      message,
      intent: intent || 'unknown',
      confidence: confidence || 0,
      actionTaken: actionTaken || 'none',
      resolutionStatus: resolutionStatus || 'pending',
      timestamp: new Date().toISOString(),
      processingTime: Math.random() * 2000 + 500 // Mock processing time
    }

    // Save to mock database
    mockDatabase.interactions.push(interaction)
    mockDatabase.analytics.totalInteractions++

    // Update analytics
    if (resolutionStatus === 'resolved') {
      mockDatabase.analytics.automatedResolutions++
    } else if (actionTaken === 'human_escalation') {
      mockDatabase.analytics.escalations++
    }

    // Calculate average resolution time
    const resolvedInteractions = mockDatabase.interactions.filter(i => i.resolutionStatus === 'resolved')
    if (resolvedInteractions.length > 0) {
      mockDatabase.analytics.avgResolutionTime = resolvedInteractions.reduce((acc, curr) => acc + curr.processingTime, 0) / resolvedInteractions.length
    }

    return NextResponse.json({
      success: true,
      data: {
        interactionId: interaction.id,
        timestamp: interaction.timestamp
      }
    })

  } catch (error) {
    console.error('Logging error:', error)
    return NextResponse.json(
      { error: 'Logging failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let interactions = mockDatabase.interactions

    // Filter by userId if provided
    if (userId) {
      interactions = interactions.filter(i => i.userId === userId)
    }

    // Apply pagination
    const paginatedInteractions = interactions.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: {
        interactions: paginatedInteractions,
        total: interactions.length,
        analytics: mockDatabase.analytics
      }
    })

  } catch (error) {
    console.error('Log retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve logs' },
      { status: 500 }
    )
  }
}

