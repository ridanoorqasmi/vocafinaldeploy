import { NextRequest, NextResponse } from 'next/server';

// Simple test endpoint to verify API is working
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasBcryptRounds: !!process.env.BCRYPT_ROUNDS
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      message: 'POST request received',
      data: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }
}
