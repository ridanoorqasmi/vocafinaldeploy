import { NextRequest, NextResponse } from 'next/server';
import { WebhookHandler } from '@/lib/webhook-handler';

const webhookHandler = new WebhookHandler();

export async function POST(request: NextRequest) {
  try {
    // Get the raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Process the webhook
    const result = await webhookHandler.processWebhook(body, signature);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
