import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { message, userId, channel = 'chat' } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Intent classification prompt
    const systemPrompt = `You are Bella, an AI Customer Service Agent. Classify the user's intent into one of these categories:

1. faq - General questions, product information, how-to guides
2. task - Specific actions like password reset, billing inquiries, account changes
3. escalation - Complex issues requiring human intervention, complaints, technical problems

Respond with JSON format:
{
  "intent": "faq|task|escalation",
  "confidence": 0.95,
  "reasoning": "Brief explanation of classification"
}

Be accurate and consider context. High confidence (>0.8) for clear intents, lower for ambiguous cases.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.1,
      max_tokens: 200,
    })

    const response = completion.choices[0]?.message?.content
    let intentData

    try {
      intentData = JSON.parse(response || '{}')
    } catch (error) {
      // Fallback classification if JSON parsing fails
      intentData = {
        intent: 'faq',
        confidence: 0.7,
        reasoning: 'Fallback classification due to parsing error'
      }
    }

    // Log the interaction
    await logInteraction({
      userId,
      channel,
      message,
      intent: intentData.intent,
      confidence: intentData.confidence,
      actionTaken: 'intent_detection',
      resolutionStatus: 'pending'
    })

    return NextResponse.json({
      success: true,
      data: {
        intent: intentData.intent,
        confidence: intentData.confidence,
        reasoning: intentData.reasoning,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Intent detection error:', error)
    return NextResponse.json(
      { error: 'Intent detection failed' },
      { status: 500 }
    )
  }
}

// Helper function to log interactions
async function logInteraction(data: {
  userId: string
  channel: string
  message: string
  intent: string
  confidence: number
  actionTaken: string
  resolutionStatus: string
}) {
  try {
    // This would normally save to Postgres
    // For now, we'll just console.log
    console.log('Interaction logged:', {
      ...data,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Logging error:', error)
  }
}

