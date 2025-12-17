import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { getIntentManager, BotIntent } from '../../../lib/intent-manager';
import { billingTracker } from '../../../lib/billing-tracker';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Note: Using App Router (Next.js). We'll read FormData directly from the Request

// Helper function to process chat message (reuse existing logic)
async function processChatMessage(userText: string, businessId: string, sessionId?: string) {
  try {
    // Initialize intent manager
    const intentManager = getIntentManager(prisma);
    
    // Get current intent context
    const intentContext = sessionId ? await intentManager.getIntentContext(businessId, sessionId) : null;
    
    // Detect intent from user message
    const intentResult = intentManager.detectIntent(userText, intentContext || undefined);
    console.log('Intent detection result:', intentResult);

    // Update intent context if needed
    if (intentResult.shouldPersist && sessionId) {
      await intentManager.updateIntentContext(businessId, sessionId, intentResult.intent);
    }

    // Get business with agent configuration
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        orderTakingAgents: {
          include: {
            menuItems: true,
            operatingHours: true,
            policies: true,
            locations: true
          }
        }
      }
    });

    if (!business) {
      throw new Error('Business not found');
    }

    const agent = business.orderTakingAgents[0];
    if (!agent) {
      throw new Error('No agent found for this business');
    }

    // Prepare business context for AI
    const businessContext = {
      businessName: business.name,
      agentName: agent.name,
      agentDescription: agent.description,
      menuItems: agent.menuItems.map(item => ({
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category
      })),
      operatingHours: agent.operatingHours.map(hours => ({
        day: hours.day,
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        isClosed: hours.isClosed
      })),
      policies: agent.policies.map(policy => ({
        type: policy.type,
        content: policy.content
      })),
      locations: agent.locations.map(location => ({
        name: location.name,
        address: location.address,
        phone: location.phone
      }))
    };

    // Create system prompt
    const systemPrompt = `You are ${agent.name}, an AI assistant for ${business.name}.

BUSINESS CONTEXT:
- Business: ${business.name}
- Agent: ${agent.name}
- Description: ${agent.description}

MENU ITEMS:
${businessContext.menuItems.map(item => `- ${item.name}: ${item.description} - $${item.price}`).join('\n')}

OPERATING HOURS:
${businessContext.operatingHours.map(hours => 
  hours.isClosed ? `- ${hours.day}: Closed` : `- ${hours.day}: ${hours.openTime} - ${hours.closeTime}`
).join('\n')}

POLICIES:
${businessContext.policies.map(policy => `- ${policy.type}: ${policy.content}`).join('\n')}

LOCATIONS:
${businessContext.locations.map(location => `- ${location.name}: ${location.address} (${location.phone})`).join('\n')}

CURRENT INTENT: ${intentResult.intent}

INSTRUCTIONS:
1. Be conversational, helpful, and friendly
2. Understand context from the user's message
3. Provide specific information when asked
4. Be proactive in offering related information
5. If asked about something not in the context, politely say you don't have that information
6. Use natural language, not bullet points unless specifically requested
7. Be patient and understanding with unclear messages
8. Show enthusiasm about the business and its offerings
9. Always be helpful and try to provide value in every response

Respond naturally and helpfully to the customer's query.`;

    // Generate AI response using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const botReply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request right now.";
    
    // Sanitize botReply for TTS (remove HTML tags, limit length)
    const sanitizedReply = botReply
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\s.,!?]/g, '') // Remove special characters except basic punctuation
      .substring(0, 300); // Limit to 300 characters for smoother audio
    
    return { botReply, sanitizedReply };

  } catch (error) {
    console.error('Error processing chat message:', error);
    return { 
      botReply: "I'm sorry, there was an issue processing your request. Please try again.",
      sanitizedReply: "I'm sorry, there was an issue processing your request. Please try again."
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Voice-to-text endpoint called');
    
    // Read multipart form data directly
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const businessId = (formData.get('businessId') as string) || 'default';
    const sessionId = (formData.get('sessionId') as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    
    // Validate file type
    if (!file.type?.includes('audio/') && !file.name?.endsWith?.('.webm')) {
      return NextResponse.json(
        { error: 'Invalid file type. Expected audio file.' },
        { status: 400 }
      );
    }
    
    // Validate file size (max 1MB for 5 seconds of audio)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if ((file as any).size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 1MB.' },
        { status: 400 }
      );
    }
    
    console.log('Audio file received:', {
      name: (file as any).name || 'user_input.webm',
      type: file.type,
      size: (file as any).size
    });
    
    // Persist the uploaded File to a temporary path so we can stream it to OpenAI
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempDir = path.join(process.cwd(), 'tmp');
    try {
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    } catch {}
    const tempPath = path.join(
      tempDir,
      `${Date.now()}-${((file as any).name || 'user_input.webm').replace(/[^a-zA-Z0-9._-]/g, '')}`
    );
    fs.writeFileSync(tempPath, buffer);

    // 1️⃣ Transcribe with Whisper
    console.log('Starting Whisper transcription...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'en'
    });
    
    const userText = transcription.text.trim();
    console.log('Transcription result:', userText);
    
    if (!userText) {
      return NextResponse.json({
        success: false,
        error: 'No speech detected in audio'
      });
    }
    
    // 2️⃣ Pass to chatbot logic
    console.log('Processing with chatbot logic...');
    const chatResult = await processChatMessage(userText, businessId, sessionId);
    const { botReply, sanitizedReply } = chatResult;
    console.log('Bot reply generated:', botReply);
    
    // 3️⃣ Generate TTS audio
    let audioBase64 = null;
    try {
      console.log('Generating TTS audio...');
      const speech = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy", // Options: alloy, echo, fable, onyx, nova, shimmer
        input: sanitizedReply
      });
      
      const buffer = Buffer.from(await speech.arrayBuffer());
      audioBase64 = buffer.toString('base64');
      console.log('TTS audio generated successfully');
    } catch (ttsError) {
      console.warn('TTS generation failed, continuing with text only:', ttsError);
      // Continue without audio - text reply is still available
    }
    
    // 4️⃣ Clean up temporary file
    try {
      fs.unlinkSync(tempPath);
    } catch (cleanupError) {
      console.warn('Failed to delete temporary file:', cleanupError);
    }
    
    // 5️⃣ Track voice usage for billing
    try {
      // Estimate voice minutes based on audio duration (rough estimate)
      const estimatedMinutes = Math.max(0.1, (audioBlob.size / 1000) * 0.1); // Rough estimate
      await billingTracker.recordVoiceMinutes(businessId, estimatedMinutes, {
        operation: 'voice_to_text',
        audioSize: audioBlob.size,
        transcriptionLength: userText.length,
        sessionId: sessionId
      });
    } catch (error) {
      console.error('Failed to record voice usage:', error);
      // Don't throw - billing tracking should not break the main flow
    }

    // 6️⃣ Return structured response with audio
    return NextResponse.json({
      success: true,
      userText,
      botReply,
      audio: audioBase64
    });
    
  } catch (error) {
    console.error('Voice-to-text error:', error);
    
    // Clean up temporary file on error
    try {
      if (error && typeof error === 'object' && 'filepath' in error) {
        fs.unlinkSync((error as any).filepath);
      }
    } catch (cleanupError) {
      console.warn('Failed to delete temporary file on error:', cleanupError);
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process audio file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
