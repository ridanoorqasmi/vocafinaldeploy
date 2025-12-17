import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getIntentManager, BotIntent } from '../../../../../lib/intent-manager';
import { conversationState } from '../../../../../lib/conversation-state';
import { billingTracker } from '../../../../../lib/billing-tracker';

const prisma = new PrismaClient();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Detect and process partial item cancellation like "remove pizza from my order"
async function handlePartialItemCancellation(params: {
  businessId: string;
  query: string;
}) {
  const { businessId, query } = params;
  const text = query.toLowerCase();

  // Quick intent detection - but only for item removal, not full order cancellation
  const intentRegex = /(remove|don'?t\s+want|drop|cancel|delete|stop)\s+([^\n\r]+?)(?:\s+from\s+my\s+order|\s+from\s+order|\s+from\s+my\s+order\s+item|\.|$)/i;
  const intentMatch = query.match(intentRegex);
  if (!intentMatch) {
    return { handled: false };
  }

  const rawItem = intentMatch[2].trim();

  // Extract potential order id token (full or suffix) - more flexible patterns
  const orderIdPatterns = [
    /(?:order\s+id\s*:?\s*)([a-zA-Z0-9]{6,12})/i,  // "order id: 3zkrj6oi" pattern
    /(?:order\s+)([a-zA-Z0-9]{6,12})/i,  // "order 3zkrj6oi" pattern
    /(?:id\s*:?\s*)([a-zA-Z0-9]{6,12})/i,  // "id: 3zkrj6oi" pattern
    /\b([a-zA-Z0-9]{6,12})\b/  // Just find any 6-12 character alphanumeric
  ];
  
  let idTokens: string[] = [];
  for (const pattern of orderIdPatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      idTokens.push(match[1]);
    }
  }
  
  // Remove duplicates while preserving order
  idTokens = Array.from(new Set(idTokens));

  if (idTokens.length === 0) {
    return {
      handled: true,
      message: 'Please provide your Order ID to remove that item. For example: "Remove pizza from order ab12cd34" or "Cancel salad from order 3zkrj6oi"',
    };
  }

  // Try each token as full id first, then as suffix within this business
  for (const token of idTokens) {
    let order = await prisma.order.findUnique({
      where: { id: token },
      include: { items: true },
    });

    if (!order) {
      order = await prisma.order.findFirst({
        where: { businessId, id: { endsWith: token } },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!order) continue;

    // Find item by fuzzy includes match - more flexible matching
    let itemIndex = order.items.findIndex((i: any) =>
      i.name.toLowerCase().includes(rawItem.toLowerCase())
    );
    
    // If no exact match, try partial matching
    if (itemIndex === -1) {
      itemIndex = order.items.findIndex((i: any) => {
        const itemName = i.name.toLowerCase();
        const searchTerm = rawItem.toLowerCase();
        // Check if any word in the item name matches the search term
        return itemName.split(' ').some(word => 
          word.includes(searchTerm) || searchTerm.includes(word)
        );
      });
    }
    
    // If still no match, try reverse matching (search term contains item name)
    if (itemIndex === -1) {
      itemIndex = order.items.findIndex((i: any) => {
        const itemName = i.name.toLowerCase();
        const searchTerm = rawItem.toLowerCase();
        return searchTerm.includes(itemName);
      });
    }

    if (itemIndex === -1) {
      return {
        handled: true,
        message: `I couldn't find "${rawItem}" in your order ${String(order.id).slice(-8)}. Available items: ${order.items
          .map((i: any) => i.name)
          .join(', ')}`,
      };
    }

    const itemToRemove = order.items[itemIndex];

    // Remove the order item row
    await prisma.orderItem.delete({ where: { id: itemToRemove.id } as any });

    // Recompute totals and possibly cancel if no items remain
    const remainingItems = order.items.filter((i: any) => i.id !== itemToRemove.id);
    const newTotal = remainingItems.reduce(
      (sum: number, i: any) => sum + Number(i.price) * Number(i.quantity),
      0
    );

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        totalPrice: newTotal,
        status: remainingItems.length === 0 ? 'CANCELLED' : order.status,
        updatedAt: new Date(),
      },
      include: { items: true },
    });

    const shortId = String(updated.id).slice(-8);
    const itemsStr = updated.items
      .map((i: any) => `${i.quantity}x ${i.name}${i.price ? ` - $${i.price}` : ''}`)
      .join(', ');

    const summary =
      updated.items.length > 0
        ? `Remaining items: ${itemsStr}. Total: $${updated.totalPrice}.`
        : `No items remain. Order ${shortId} is now cancelled.`;

    return {
      handled: true,
      message: `✅ ${itemToRemove.name} has been removed from your order ${shortId}. ${summary}`,
    };
  }

  return { handled: true, message: "I couldn't find that order. Please share a valid Order ID." };
}

// Handles intelligent order inquiries based on free-form user text
async function handleOrderInquiry(params: {
  businessId: string;
  query: string;
  conversationHistory: any[];
}) {
  const { businessId, query, conversationHistory } = params;

  const lower = query.toLowerCase();

  const isRecentOrderRequest =
    lower.includes('recent order') || lower.includes('last order') || lower.includes('my last order') || lower.includes('my recent order') ||
    lower.includes('what did i order') || lower.includes('what i ordered') ||
    lower.includes('yesterday') || lower.includes('today') || lower.includes('previous order') ||
    lower.includes('past order') || lower.includes('order history') || lower.includes('order details') ||
    // More specific patterns to avoid conflicts with new order intent
    lower.includes('check my order') || lower.includes('look up my order') || lower.includes('find my order') ||
    lower.includes('track my order') || lower.includes('where is my order') || lower.includes('order status');

  // Helper: format order details
  const formatOrder = (order: any, shortId: string) => {
    const orderItems = (order.items || [])
      .map((item: any) => `${item.quantity}x ${item.name}${item.price ? ` - $${item.price}` : ''}`)
      .join(', ')
      || 'No items found';

    const orderDate = new Date(order.createdAt);
    const dateStr = `${orderDate.toLocaleDateString()} at ${orderDate.toLocaleTimeString()}`;
    return (
      `Here are the details for your order ${shortId}:\n\n` +
      `📋 **Order Summary:**\n` +
      `• Customer: ${order.customerName}\n` +
      `• Contact: ${order.customerContact}\n` +
      `• Items: ${orderItems}\n` +
      `• Total: $${order.totalPrice}\n` +
      `• Status: ${String(order.status || '').toUpperCase()}\n` +
      `• Date: ${dateStr}\n\n` +
      `Let me know if you’d like to cancel or order new items.`
    );
  };

  // 1) Handle recent/last order with name confirmation
  if (isRecentOrderRequest) {
    // Try to reuse existing extraction to get name from conversation
    const validation = validateOrderDetails(conversationHistory, query);
    const name = validation?.orderContext?.name;

    if (!name) {
      return {
        handled: true,
        message:
          "I'd be happy to help you check your order! To look up your recent orders, could you please provide the name that was used when placing the order?",
      };
    }

    const recent = await prisma.order.findFirst({
      where: {
        businessId,
        customerName: { contains: name, mode: 'insensitive' },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Order inquiry request (recent):', name, recent?.id);

    if (!recent) {
      return {
        handled: true,
        message: `I couldn't find any recent orders under the name "${name}". If you've placed an order recently, please double-check the name or share your order ID so I can look it up for you.`,
      };
    }

    const shortId = String(recent.id).slice(-8);
    return { handled: true, message: formatOrder(recent, shortId) };
  }

  // 2) Specific order-id extraction and lookup
  // Accept patterns like "ORD-1245", "#1245", "order 1245", "wi1ge1b2"
  const genericIdPattern = /(order\s*id|order|id|#)?\s*[:#-]?\s*([a-z0-9-]{4,24})/i;
  const match = query.match(genericIdPattern);

  // Additionally, search for an 8-char token (our UI shows last 8 chars)
  const shortTokenMatch = query.match(/\b[a-z0-9]{6,12}\b/gi);

  let candidateTokens: string[] = [];
  if (match && match[2]) candidateTokens.push(match[2]);
  if (shortTokenMatch) candidateTokens.push(...shortTokenMatch);

  // Normalize tokens: drop punctuation, take last segment after '-'
  candidateTokens = candidateTokens
    .map((t) => t.trim())
    .map((t) => (t.includes('-') ? t.split('-').pop() || t : t))
    .map((t) => t.replace(/[^a-z0-9]/gi, ''))
    .filter((t) => t.length >= 4);

  // Deduplicate while preserving order
  candidateTokens = Array.from(new Set(candidateTokens));

  for (const token of candidateTokens) {
    try {
      // Try exact match first (if user pasted full cuid)
      let order = await prisma.order.findUnique({
        where: { id: token },
        include: { items: true },
      });

      // If not found, try suffix match (since UI shows last 8 characters)
      if (!order) {
        order = await prisma.order.findFirst({
          where: { businessId, id: { endsWith: token } },
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        });
      }

      console.log('Order inquiry request (by id):', token, order?.id);

      if (order) {
        const shortId = String(order.id).slice(-8);
        return { handled: true, message: formatOrder(order, shortId) };
      }
    } catch (e) {
      console.error('Order inquiry lookup error:', e);
    }
  }

  return { handled: false };
}

// Order validation function
function validateOrderDetails(conversationHistory: any[], currentQuery: string) {
  const orderContext = {
    items: [],
    name: null,
    phone: null,
    deliveryMethod: null,
    isConfirmed: false
  };

  // Combine all user messages for better extraction
  const allUserMessages = [...conversationHistory.filter(msg => msg.sender === 'user'), { text: currentQuery, sender: 'user' }];
  const combinedText = allUserMessages.map(msg => msg.text).join(' ').toLowerCase();

  console.log('Analyzing combined user messages:', combinedText);
  
  // Test with the exact message from the user's example
  if (combinedText.includes('rida') && combinedText.includes('1234567') && combinedText.includes('burger')) {
    console.log('Detected test case: rida, 1234567, 2 burgers');
  }

  // Much more comprehensive name extraction
  const namePatterns = [
    /my name is ([a-zA-Z\s]+?)(?:\s|$|,|and|phone|contact|order)/i,
    /name is ([a-zA-Z\s]+?)(?:\s|$|,|and|phone|contact|order)/i,
    /i'm ([a-zA-Z\s]+?)(?:\s|$|,|and|phone|contact|order)/i,
    /i am ([a-zA-Z\s]+?)(?:\s|$|,|and|phone|contact|order)/i,
    /call me ([a-zA-Z\s]+?)(?:\s|$|,|and|phone|contact|order)/i,
    /name[:\s]+([a-zA-Z\s]+?)(?:\s|$|,|and|phone|contact|order)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = combinedText.match(pattern);
    if (match && match[1] && match[1].trim().length > 0) {
      orderContext.name = match[1].trim();
      console.log('Extracted name:', orderContext.name);
      break;
    }
  }

  // Much more comprehensive phone extraction
  const phonePatterns = [
    /contact number is ([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /my contact number is ([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /contact no\.? is ([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /phone number is ([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /phone is ([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /contact is ([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /number is ([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /my phone ([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /phone[:\s]+([0-9\s\-\(\)\.]+?)(?:\s|$|,|and|order|name)/i,
    /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,
    /(\d{7,})/,
    /(\d{10})/,
    /(\d{3}[-.\s]?\d{4}[-.\s]?\d{3})/,
    /(\d{4}[-.\s]?\d{3}[-.\s]?\d{3})/
  ];
  
  for (const pattern of phonePatterns) {
    const match = combinedText.match(pattern);
    const raw = match && (match[1] || match[0]);
    if (raw && raw.trim().length > 0) {
      // Normalize: keep digits and plus
      const normalized = raw.replace(/[^\d+]/g, '');
      if (normalized.length >= 7) {
        orderContext.phone = normalized;
        console.log('Extracted phone:', orderContext.phone);
        break;
      }
    }
  }

  // Much more comprehensive menu item extraction
  const menuItems = ['pizza', 'burger', 'pasta', 'salad', 'sandwich', 'drink', 'coffee', 'tea', 'soup', 'chicken', 'beef', 'fish', 'rice', 'noodles'];
  
  for (const item of menuItems) {
    if (combinedText.includes(item)) {
      // Look for quantity patterns - much more flexible
      const quantityPatterns = [
        new RegExp(`(\\d+)\\s*${item}s?`, 'i'),
        new RegExp(`${item}s?\\s*(\\d+)`, 'i'),
        new RegExp(`(\\d+)\\s*${item}`, 'i'),
        new RegExp(`order is (\\d+)\\s*${item}s?`, 'i'),
        new RegExp(`my order is (\\d+)\\s*${item}s?`, 'i'),
        new RegExp(`want (\\d+)\\s*${item}s?`, 'i'),
        new RegExp(`like (\\d+)\\s*${item}s?`, 'i')
      ];
      
      let quantity = 1;
      for (const qPattern of quantityPatterns) {
        const qMatch = combinedText.match(qPattern);
        if (qMatch && qMatch[1]) {
          quantity = Math.min(parseInt(qMatch[1]), 10);
          break;
        }
      }
      
      orderContext.items.push({
        name: item.charAt(0).toUpperCase() + item.slice(1),
        quantity: quantity
      });
      console.log('Extracted item:', item, 'quantity:', quantity);
    }
  }

  // If no specific items found, but user mentioned "order" or "confirm", create a default item
  if (orderContext.items.length === 0 && (combinedText.includes('order') || combinedText.includes('confirm'))) {
    orderContext.items.push({
      name: 'Order',
      quantity: 1
    });
  }

  console.log('Extracted order context:', orderContext);

  // Check what's missing and return appropriate message
  const missingFields = [];
  
  // Validate name - must be at least 2 characters and not a placeholder
  const validName = orderContext.name && 
                   orderContext.name.trim().length >= 2 && 
                   !orderContext.name.toLowerCase().includes('customer') &&
                   !orderContext.name.toLowerCase().includes('user') &&
                   !orderContext.name.toLowerCase().includes('name');
  
  // Validate phone number format - more flexible for different formats
  const phoneRegex = /^[\d\s\-\(\)\.]{7,}$/;
  const validPhone = orderContext.phone && 
                    phoneRegex.test(orderContext.phone) && 
                    orderContext.phone.replace(/\D/g, '').length >= 7;
  
  console.log('Validating order details:');
  console.log('- Items:', orderContext.items.length, orderContext.items);
  console.log('- Name:', orderContext.name, 'Valid:', validName);
  console.log('- Phone:', orderContext.phone, 'Valid:', validPhone);
  
  if (orderContext.items.length === 0) {
    missingFields.push('menu items');
  }
  
  if (!validName) {
    missingFields.push('your name');
  }
  
  if (!validPhone) {
    missingFields.push('your phone number');
  }

  if (missingFields.length > 0) {
    // Always require proper customer details for order confirmation
    const missingText = missingFields.join(', ');
    return {
      isValid: false,
      message: `I'd be happy to help you place an order! However, I need a few more details first. Could you please provide ${missingText}? For example, you could say "I'd like 2 pizzas, my name is John, and my phone is 123-456-7890."`
    };
  }

  return {
    isValid: true,
    orderContext
  };
}

// Helper function to get intent-specific instructions
function getIntentSpecificInstructions(intent: BotIntent, step: number): string {
  switch (intent) {
    case 'lookup_order':
      return `CURRENT TASK: Help customer look up their order
- Ask for name, phone number, or order ID if not provided
- Search for the order and provide details
- If order not found, ask them to double-check the information
- Stay focused on order lookup until completed`;

    case 'new_order':
      return `CURRENT TASK: Help customer place a new order
- Show menu items and help with selection
- Collect customer details (name, phone) when ready
- Calculate total and confirm order
- Process the order when all details are available
- Stay focused on order placement until completed`;

    case 'cancel_order':
      return `CURRENT TASK: Help customer cancel their order
- Ask for order ID if not provided
- Confirm cancellation details
- Process the cancellation
- Stay focused on cancellation until completed`;

    case 'modify_order':
      return `CURRENT TASK: Help customer modify their existing order
- Ask for order ID and what they want to change
- Confirm the modifications
- Process the changes
- Stay focused on order modification until completed`;

    case 'support':
      return `CURRENT TASK: Provide customer support
- Listen to their concerns
- Offer appropriate solutions
- Escalate to human support if needed
- Stay focused on resolving their issue`;

    default:
      return `CURRENT TASK: General assistance
- Help with any questions or requests
- Guide them to the appropriate service
- Be helpful and friendly`;
  }
}

// Helper function to extract order ID from conversation history
function extractOrderIdFromHistory(conversationHistory: any[]): string | null {
  // Look for order IDs in recent messages
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const message = conversationHistory[i];
    if (message && message.text) {
      // Look for order ID patterns in the message
      const orderIdPatterns = [
        /(?:order\s+id\s*:?\s*)([a-zA-Z0-9]{6,12})/i,
        /(?:order\s+)([a-zA-Z0-9]{6,12})/i,
        /\b([a-zA-Z0-9]{6,12})\b/
      ];
      
      for (const pattern of orderIdPatterns) {
        const match = message.text.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  }
  return null;
}

// Helper function to determine if intent should be cleared
function shouldClearIntent(response: string, intent: BotIntent): boolean {
  const responseText = response.toLowerCase();
  
  // Check for completion indicators
  const completionIndicators = [
    'successfully',
    'completed',
    'confirmed',
    'cancelled',
    'processed',
    'thank you',
    'order id:',
    'order has been',
    'we\'ll contact you'
  ];
  
  const hasCompletionIndicator = completionIndicators.some(indicator => 
    responseText.includes(indicator)
  );
  
  // Check for error indicators that suggest task completion
  const errorIndicators = [
    'couldn\'t find',
    'not found',
    'cannot be cancelled',
    'already',
    'check your order id'
  ];
  
  const hasErrorIndicator = errorIndicators.some(indicator => 
    responseText.includes(indicator)
  );
  
  // Clear intent if we have completion or error indicators
  return hasCompletionIndicator || hasErrorIndicator;
}

// POST /api/agents/order-taking/chat - Process chat queries with AI reasoning
export async function POST(request: NextRequest) {
  try {
    console.log('Intelligent chat query endpoint called');
    
    const body = await request.json();
    const { businessId, conversationHistory = [], sessionId } = body;
    let { query } = body;

    if (!businessId || !query) {
      return NextResponse.json({
        success: false,
        error: 'Business ID and query are required'
      }, { status: 400 });
    }

    // Initialize intent manager
    const intentManager = getIntentManager(prisma);
    
    // Check conversation state for slot handling
    let conversationResponse: string | null = null;
    let shouldSkipNormalFlow = false;
    
    if (sessionId) {
      // First check if this is an order confirmation - if so, bypass conversation state
      if (conversationState.isOrderConfirmation(query)) {
        console.log('Order confirmation detected, bypassing conversation state');
        // Check if we have all the data needed for order processing
        if (conversationState.hasAllOrderData(sessionId)) {
          console.log('All order data available, proceeding with order processing');
          // Inject the collected data into the query for normal processing
          const orderData = conversationState.getOrderData(sessionId);
          if (orderData) {
            // Modify the query to include the collected order data
            query = `I want to place an order for ${orderData.items.join(', ')}. My name is ${orderData.name} and my phone number is ${orderData.phone}. Please process this order.`;
            console.log('Injected order data into query:', query);
          }
          conversationState.handleOrderConfirmation(sessionId);
          // Continue with normal flow to process the order
        } else {
          console.log('Order confirmation but missing data, continuing with conversation state');
          // Continue with conversation state handling
        }
      } else if (conversationState.isAwaitingSlot(sessionId)) {
        // Check if the message is relevant to the current slot
        if (conversationState.isRelevantToSlot(sessionId, query)) {
          const slotResult = conversationState.handleSlotInput(sessionId, query);
          if (!slotResult.shouldContinue) {
            conversationResponse = slotResult.response!;
            shouldSkipNormalFlow = true;
            console.log('Handled slot input:', slotResult);
          }
        } else {
          // Handle irrelevant input
          const irrelevantResult = conversationState.handleIrrelevantInput(sessionId, query);
          if (!irrelevantResult.shouldContinue) {
            conversationResponse = irrelevantResult.response!;
            shouldSkipNormalFlow = true;
            if (irrelevantResult.shouldReset) {
              console.log('Session reset due to irrelevant input');
            }
          }
        }
      }
    }
    
    // If we handled the conversation state, return early
    if (shouldSkipNormalFlow && conversationResponse) {
      return NextResponse.json({
        success: true,
        data: {
          response: conversationResponse,
          orderData: null
        }
      });
    }
    
    // Get current intent context
    const intentContext = sessionId ? await intentManager.getIntentContext(businessId, sessionId) : null;
    
    // Detect intent from user message
    const intentResult = intentManager.detectIntent(query, intentContext || undefined);
    console.log('Intent detection result:', intentResult);

    // Update intent context if needed
    if (intentResult.shouldPersist && sessionId) {
      await intentManager.updateIntentContext(businessId, sessionId, intentResult.intent);
      
      // Start conversation flow for specific intents
      if (intentResult.intent === 'new_order' && !conversationState.isAwaitingSlot(sessionId)) {
        // Check if user has provided complete order information
        const completeInfo = conversationState.hasCompleteOrderInfo(query);
        if (completeInfo.hasName && completeInfo.hasPhone && completeInfo.hasItems) {
          console.log('User provided complete order information, skipping conversation flow');
          // Don't start conversation flow, let the normal order processing handle it
        } else {
          conversationState.startFlow(sessionId, 'take_order', businessId);
          console.log('Started take_order flow');
        }
      } else if (intentResult.intent === 'cancel_order' && !conversationState.isAwaitingSlot(sessionId)) {
        conversationState.startFlow(sessionId, 'cancel_order', businessId);
        console.log('Started cancel_order flow');
      } else if (intentResult.intent === 'lookup_order' && !conversationState.isAwaitingSlot(sessionId)) {
        conversationState.startFlow(sessionId, 'lookup_order', businessId);
        console.log('Started lookup_order flow');
      }
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
      return NextResponse.json({
        success: false,
        error: 'Business not found'
      }, { status: 404 });
    }

    const agent = business.orderTakingAgents[0];
    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'No agent found for this business'
      }, { status: 404 });
    }

    // Prepare business context for AI
    const businessContext = {
      businessName: business.name,
      agentName: agent.name,
      agentDescription: agent.description,
      menuItems: agent.menuItems || [],
      operatingHours: agent.operatingHours || [],
      policies: agent.policies || [],
      locations: agent.locations || []
    };

    // Build conversation context
    const conversationContext = conversationHistory.map((msg: { sender: string; text: string }) => 
      `${msg.sender}: ${msg.text}`
    ).join('\n');

    // Get intent-specific guidance
    const currentIntent = intentResult.intent;
    const intentStep = intentContext?.conversationStep || 1;
    const intentGuidance = intentManager.getIntentGuidance(currentIntent, intentStep);
    
    // Create comprehensive system prompt with intent awareness
    const systemPrompt = `You are ${agent.name}, an AI assistant for ${business.name}.

CURRENT INTENT: ${currentIntent.toUpperCase()}
INTENT GUIDANCE: ${intentGuidance}

BUSINESS CONTEXT:
${businessContext.agentDescription}

MENU ITEMS:
${businessContext.menuItems.map(item => `- ${item.name}: ${item.description || 'Available'} - $${item.price || 'Price varies'}`).join('\n')}

OPERATING HOURS:
${businessContext.operatingHours.map(hours => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[hours.dayOfWeek] || `Day ${hours.dayOfWeek}`;
  return hours.isClosed ? `- ${dayName}: Closed` : `- ${dayName}: ${hours.openTime} - ${hours.closeTime}`;
}).join('\n')}

POLICIES:
${businessContext.policies.map(policy => `- ${policy.title}: ${policy.content}`).join('\n')}

LOCATIONS:
${businessContext.locations.map(location => {
  let locationInfo = `- ${location.name}`;
  if (location.address) locationInfo += ` (${location.address})`;
  if (location.phone) locationInfo += ` - Phone: ${location.phone}`;
  return locationInfo;
}).join('\n')}

CONVERSATION HISTORY:
${conversationContext}

ORDER PROCESSING:
When a customer wants to place an order, you should:
1. Be proactive in collecting their name and phone number
2. Confirm the items they want to order
3. Calculate the total price
4. Process the order immediately when all details are available

When a customer confirms an order (says "yes", "confirm", "take my order", "process my order", etc.), the system will automatically process the order if all required details are present. You should:
1. Be friendly and helpful
2. Provide clear confirmation messages with the correct Order ID (last 8 characters)
3. Let the system handle the technical order processing
4. If details are missing, ask for them in a single, clear message

ORDER INQUIRIES:
When a customer asks about a specific order using an order ID:
1. The system will automatically look up the order details
2. Provide a comprehensive summary including items, total, status, and date
3. Be helpful and offer to answer specific questions about the order
4. If the order is not found, politely ask them to double-check the order ID
5. If there are technical issues, suggest they contact support

ORDER CANCELLATION:
If a customer wants to cancel their order, they can say "cancel order ID: [order-id]" and the system will handle the cancellation. You should:
1. Be understanding and helpful
2. Confirm the cancellation if successful
3. Explain if the order cannot be cancelled (already confirmed/completed)

POLICY INQUIRIES & CUSTOMER SERVICE:
When customers ask about policies, refunds, complaints, or special requests:
1. REFUNDS: If customer asks about refunds, say: "I understand you'd like to discuss a refund. Our team will contact you shortly to assist with your request. Please provide your order details and we'll get back to you within 24 hours."
2. COMPLAINTS: If customer has complaints, say: "I'm sorry to hear about your experience. Our team will contact you shortly to resolve this matter. We appreciate your feedback and will make sure to address your concerns."
3. SPECIAL REQUESTS: If customer has special dietary requirements or modifications, say: "Thank you for letting us know about your special requirements. Our team will contact you shortly to discuss how we can accommodate your needs."
4. POLICY QUESTIONS: For general policy questions, provide the information from the policies section, but for complex issues, say: "Our team will contact you shortly to provide detailed information about this policy."
5. LOCATION INQUIRIES: Provide location information from the locations section, but for delivery questions, say: "Our team will contact you shortly to confirm delivery details and timing."

PROFESSIONAL RESPONSES:
- Always be empathetic and understanding
- Use phrases like "I understand", "I'm sorry to hear", "Thank you for bringing this to our attention"
- For complex issues, always offer to have the team contact them
- Be reassuring that their concerns will be addressed
- Provide clear next steps when possible

INTENT-SPECIFIC INSTRUCTIONS:
${getIntentSpecificInstructions(currentIntent, intentStep)}

GENERAL INSTRUCTIONS:
1. Be conversational, helpful, and friendly - like a knowledgeable staff member
2. Understand context from previous messages and build on the conversation
3. Provide specific information when asked, with relevant details
4. If asked about something not in the context, politely say you don't have that information but offer alternatives
5. Use natural language, not bullet points unless specifically requested
6. Be proactive in offering related information and suggestions
7. Remember what the customer has asked about before and reference it
8. If the customer seems confused or asks unclear questions, ask clarifying questions
9. Show enthusiasm about the business and its offerings
10. Be patient and understanding with typos or unclear messages
11. If you make a mistake or don't understand, acknowledge it and ask for clarification
12. Always be helpful and try to provide value in every response
13. When processing orders, use the ORDER_INTENT format exactly as specified
14. For policy-related inquiries, always offer team follow-up for complex issues
15. MAINTAIN INTENT CONTEXT: Stay focused on the current intent (${currentIntent}) and guide the conversation accordingly

Respond naturally and helpfully to the customer's query.`;

    // Generate intelligent response using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request right now.";

    // Track billing usage
    try {
      await billingTracker.recordApiCall(businessId, {
        operation: 'chat_completion',
        model: 'gpt-4o-mini',
        tokens: completion.usage?.total_tokens || 0,
        intent: intentResult.intent,
        sessionId: sessionId
      });
    } catch (error) {
      console.error('Failed to record billing usage:', error);
      // Don't throw - billing tracking should not break the main flow
    }

    // Check if this is an order intent
    let processedResponse = aiResponse;
    let orderData = null;
    let shouldUseAIResponse = true; // Flag to control whether to use AI response

    // 0) Partial item cancellation (remove fries, cancel pizza from my order)
    const partial = await handlePartialItemCancellation({ businessId, query });
    if (partial.handled) {
      // Short-circuit to avoid triggering generic cancellation/confirmation handlers
      return NextResponse.json({
        success: true,
        data: {
          response: partial.message,
          agent: { name: agent.name, isActive: agent.isActive }
        }
      });
    }

    // Unified order inquiry handler (specific ID, numeric tokens, recent order)
    // Only run inquiry handler if current intent is lookup_order or general
    if (intentResult.intent === 'lookup_order' || intentResult.intent === 'general') {
      const inquiry = await handleOrderInquiry({ businessId, query, conversationHistory });
      if (inquiry.handled) {
        // Short-circuit on inquiry responses as well
        return NextResponse.json({
          success: true,
          data: {
            response: inquiry.message,
            agent: { name: agent.name, isActive: agent.isActive }
          }
        });
      }
    }

    // Enhanced order confirmation detection
    const isOrderConfirmation = query.toLowerCase().includes('yes') || 
                               query.toLowerCase().includes('confirm') || 
                               query.toLowerCase().includes('take my order') ||
                               query.toLowerCase().includes('place order') ||
                               query.toLowerCase().includes('process my order') ||
                               query.toLowerCase().includes('proceed') ||
                               query.toLowerCase().includes('finalize') ||
                               query.toLowerCase().includes('complete') ||
                               query.toLowerCase().includes('submit');

    // Order cancellation detection - more comprehensive patterns
    const isOrderCancellation = query.toLowerCase().includes('cancel my order') ||
                               query.toLowerCase().includes('cancel order') ||
                               query.toLowerCase().includes('cancel this order') ||
                               query.toLowerCase().includes('i\'d like to cancel') ||
                               query.toLowerCase().includes('i;d like to cancel') || // Handle semicolon typo
                               query.toLowerCase().includes('i would like to cancel') ||
                               query.toLowerCase().includes('yes, i\'d like to cancel') ||
                               query.toLowerCase().includes('yes, i;d like to cancel') || // Handle semicolon typo
                               query.toLowerCase().includes('yes, i would like to cancel') ||
                               query.toLowerCase().includes('remove my order') ||
                               query.toLowerCase().includes('delete my order') ||
                               query.toLowerCase().includes('stop my order') ||
                               query.toLowerCase().includes('don\'t want this order') ||
                               query.toLowerCase().includes('don\'t want the order') ||
                               query.toLowerCase().includes('no longer want') ||
                               query.toLowerCase().includes('change my mind') ||
                               query.toLowerCase().includes('cancel it') ||
                               query.toLowerCase().includes('cancel that') ||
                               query.toLowerCase().includes('cancel this') ||
                               query.toLowerCase().includes('remove it') ||
                               query.toLowerCase().includes('delete it') ||
                               query.toLowerCase().includes('stop it') ||
                               query.toLowerCase().includes('don\'t want it') ||
                               query.toLowerCase().includes('don\'t want that') ||
                               query.toLowerCase().includes('don\'t want this') ||
                               // Additional regex patterns for better detection
                               /i\s*[;']d\s+like\s+to\s+cancel/i.test(query) || // Handles both apostrophe and semicolon
                               /would\s+like\s+to\s+cancel/i.test(query) ||
                               /want\s+to\s+cancel/i.test(query) ||
                               /need\s+to\s+cancel/i.test(query) ||
                               /please\s+cancel/i.test(query) ||
                               /can\s+you\s+cancel/i.test(query) ||
                               /help\s+me\s+cancel/i.test(query);

    if (isOrderConfirmation) {
      console.log('Order confirmation detected for query:', query);
      console.log('Conversation history:', conversationHistory);
      
      // First, validate that we have all required order details
      const orderValidation = validateOrderDetails(conversationHistory, query);
      
      console.log('Order validation result:', orderValidation);
      
      if (!orderValidation.isValid) {
        console.log('Order validation failed, asking for missing details');
        // Return a friendly message asking for missing details
        return NextResponse.json({
          success: true,
          data: {
            response: orderValidation.message,
            agent: {
              name: agent.name,
              isActive: agent.isActive
            },
            context: {
              businessName: business.name,
              hasMenuItems: businessContext.menuItems.length > 0,
              hasOperatingHours: businessContext.operatingHours.length > 0,
              hasPolicies: businessContext.policies.length > 0,
              hasLocations: businessContext.locations.length > 0
            }
          }
        });
      }
      
      try {
        // Use the validated order context
        const { orderContext } = orderValidation;
        
        console.log('Processing validated order:', orderContext);
        
        // Create order items with proper structure, but ONLY allow items that exist in the active menu
        const menuItems = (businessContext.menuItems || []).map((m: any) => ({
          name: String(m.name || '').trim(),
          price: Number(m.price || 0)
        }));

        const normalize = (s: string) => s.toLowerCase().trim();
        const findMenuItem = (requestedName: string) => {
          const req = normalize(requestedName).replace(/s\b/, '');
          // Exact case-insensitive match
          let found = menuItems.find(m => normalize(m.name) === req);
          if (found) return found;
          // StartsWith or includes fallback
          found = menuItems.find(m => normalize(m.name).startsWith(req) || normalize(m.name).includes(req));
          return found || null;
        };

        const allowedOrderItems = [] as Array<{ name: string; quantity: number; price?: number }>;
        const rejectedItems = [] as string[];

        for (const it of orderContext.items) {
          const match = findMenuItem(it.name);
          if (match) {
            const priceNum = Number(match.price || 0);
            if (priceNum > 0) {
              allowedOrderItems.push({ name: match.name, quantity: it.quantity, price: priceNum });
            } else {
              // If menu has no positive price stored, omit price to satisfy validation schema
              allowedOrderItems.push({ name: match.name, quantity: it.quantity });
            }
          } else {
            rejectedItems.push(it.name);
          }
        }

        if (allowedOrderItems.length === 0) {
          const available = menuItems.map(m => m.name).join(', ');
          return NextResponse.json({
            success: true,
            data: {
              response: `I couldn't find those items on our menu. Available options are: ${available}. Please tell me what you'd like to order.`,
              agent: { name: agent.name, isActive: agent.isActive },
            }
          });
        }

        const orderJson = {
          items: allowedOrderItems,
          customer: {
            name: orderContext.name,
            phone: orderContext.phone
          }
        };

        console.log('Processing order with validated details:', orderJson);
        
        // Process the order through the orders API
        // Create the order directly using Prisma to avoid any networking issues between routes
        const computedTotal = allowedOrderItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);

        const createdOrder = await prisma.order.create({
          data: {
            businessId,
            customerName: orderContext.name!,
            customerContact: orderContext.phone!,
            status: 'PENDING',
            totalPrice: computedTotal,
            items: {
              create: allowedOrderItems.map((it) => ({
                name: it.name,
                quantity: it.quantity,
                price: Number(it.price || 0)
              }))
            }
          },
          include: { items: true }
        });

        orderData = { orderId: createdOrder.id, order: createdOrder };
        const shortOrderId = createdOrder.id.slice(-8);
        processedResponse = `✅ Your order has been placed successfully! Order ID: ${shortOrderId}\n\nWe'll contact you at ${orderJson.customer.phone} to confirm your order. Thank you for choosing ${business.name}!`;
        shouldUseAIResponse = false; // Use our clean response instead of AI response
        
        // Reset conversation state after successful order
        if (sessionId) {
          conversationState.resetSession(sessionId);
          console.log('Conversation state reset after successful order');
        }
      } catch (error) {
        console.error('Order processing error:', error);
        processedResponse = "I'm sorry, there was an issue processing your order. Please try again or contact us directly.";
        shouldUseAIResponse = false;
      }
    }

    // Handle order cancellation
    if (isOrderCancellation) {
      console.log('Order cancellation detected for query:', query);
      console.log('Business ID:', businessId);
      
      // Extract order ID from the message - more flexible pattern
      const orderIdPatterns = [
        /(?:order\s+id\s*:?\s*)([a-zA-Z0-9]{6,12})/i,  // "order id: Oxaul4un" pattern
        /(?:cancel\s+order\s+)([a-zA-Z0-9]{6,12})/i,  // "cancel order Oxaul4un" pattern
        /(?:cancel\s+)([a-zA-Z0-9]{6,12})/i,  // "cancel Oxaul4un" pattern
        /(?:id\s*:?\s*)([a-zA-Z0-9]{6,12})/i,  // "id: Oxaul4un" pattern
        // More specific patterns that avoid common words
        /\b([a-zA-Z0-9]{8,12})\b(?!\s*(?:my|this|that|it|order|please|help|want|like|need))/i,  // 8-12 chars, not followed by common words
        /\b([a-zA-Z0-9]{6,7})\b(?!\s*(?:my|this|that|it|order|please|help|want|like|need))/i   // 6-7 chars, not followed by common words
      ];
      
      let shortOrderId = null;
      for (const pattern of orderIdPatterns) {
        const match = query.match(pattern);
        if (match && match[1]) {
          shortOrderId = match[1];
          break;
        }
      }
      
      if (shortOrderId) {
        console.log('Attempting to cancel order with ID:', shortOrderId);
        
        try {
          // Find the full order ID by searching for orders with matching suffix
          const orders = await prisma.order.findMany({
            where: { businessId },
            select: { id: true, status: true, customerName: true }
          });
          
          console.log('Found orders for business:', orders.length);
          console.log('Looking for order ending with:', shortOrderId);
          console.log('Available order IDs:', orders.map(o => o.id));
          
          const matchingOrder = orders.find(order => order.id.endsWith(shortOrderId));
          
          if (matchingOrder) {
            if (matchingOrder.status === 'PENDING') {
              // Cancel the order
              await prisma.order.update({
                where: { id: matchingOrder.id },
                data: { status: 'CANCELLED' }
              });
              
              processedResponse = `✅ Your order ${shortOrderId} has been cancelled successfully. We're sorry for any inconvenience.`;
              shouldUseAIResponse = false; // Use our clean response instead of AI response
              
              // Reset conversation state after successful cancellation
              if (sessionId) {
                conversationState.resetSession(sessionId);
                console.log('Conversation state reset after successful cancellation');
              }
            } else {
              processedResponse = `❌ Sorry, order ${shortOrderId} cannot be cancelled as it's already ${matchingOrder.status.toLowerCase()}.`;
              shouldUseAIResponse = false;
            }
          } else {
            processedResponse = `❌ Sorry, we couldn't find an order with ID ${shortOrderId}. Please check your order ID and try again.`;
            shouldUseAIResponse = false;
          }
        } catch (error) {
          console.error('Order cancellation error:', error);
          processedResponse = "I'm sorry, there was an issue cancelling your order. Please try again or contact us directly.";
          shouldUseAIResponse = false;
        }
      } else {
        // Check if we have an order ID from conversation history
        const orderIdFromHistory = extractOrderIdFromHistory(conversationHistory);
        if (orderIdFromHistory) {
          console.log('Found order ID from conversation history:', orderIdFromHistory);
          // Process cancellation with the order ID from history
          try {
            const orders = await prisma.order.findMany({
              where: { businessId },
              select: { id: true, status: true, customerName: true }
            });
            
            const matchingOrder = orders.find(order => order.id.endsWith(orderIdFromHistory));
            
            if (matchingOrder) {
              if (matchingOrder.status === 'PENDING') {
                await prisma.order.update({
                  where: { id: matchingOrder.id },
                  data: { status: 'CANCELLED' }
                });
                
                processedResponse = `✅ Your order ${orderIdFromHistory} has been cancelled successfully. We're sorry for any inconvenience.`;
                shouldUseAIResponse = false;
                
                // Reset conversation state after successful cancellation
                if (sessionId) {
                  conversationState.resetSession(sessionId);
                  console.log('Conversation state reset after successful cancellation');
                }
              } else {
                processedResponse = `❌ Sorry, order ${orderIdFromHistory} cannot be cancelled as it's already ${matchingOrder.status.toLowerCase()}.`;
                shouldUseAIResponse = false;
              }
            } else {
              processedResponse = `❌ Sorry, we couldn't find an order with ID ${orderIdFromHistory}. Please check your order ID and try again.`;
              shouldUseAIResponse = false;
            }
          } catch (error) {
            console.error('Order cancellation error:', error);
            processedResponse = "I'm sorry, there was an issue cancelling your order. Please try again or contact us directly.";
            shouldUseAIResponse = false;
          }
        } else {
          // Try to find recent orders for the user to help them identify which order to cancel
          try {
            const recentOrders = await prisma.order.findMany({
              where: { 
                businessId,
                status: 'PENDING' // Only show pending orders that can be cancelled
              },
              select: { id: true, customerName: true, totalPrice: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 3 // Show last 3 pending orders
            });
            
            if (recentOrders.length > 0) {
              const orderList = recentOrders.map(order => {
                const shortId = String(order.id).slice(-8);
                const date = new Date(order.createdAt).toLocaleDateString();
                return `• Order ${shortId} (${order.customerName}) - $${order.totalPrice} - ${date}`;
              }).join('\n');
              
              processedResponse = `I'd be happy to help you cancel your order! I found these recent pending orders:\n\n${orderList}\n\nPlease let me know which order you'd like to cancel by providing the Order ID (like "Cancel ${String(recentOrders[0].id).slice(-8)}").`;
            } else {
              processedResponse = "I don't see any pending orders that can be cancelled. If you have an order ID, please provide it and I'll help you cancel it. For example: 'Cancel order ID: fk70zhad' or just 'Cancel Oxaul4un'";
            }
          } catch (error) {
            console.error('Error fetching recent orders:', error);
          processedResponse = "To cancel your order, please provide your Order ID. For example: 'Cancel order ID: fk70zhad' or just 'Cancel Oxaul4un'";
          }
          shouldUseAIResponse = false;
        }
      }
    }

    // Clear intent context if task is completed
    if (sessionId && shouldClearIntent(processedResponse, currentIntent)) {
      await intentManager.clearIntentContext(businessId, sessionId);
      console.log('Intent context cleared for completed task');
    }

    return NextResponse.json({
      success: true,
      data: {
        response: processedResponse,
        agent: {
          name: agent.name,
          isActive: agent.isActive
        },
        context: {
          businessName: business.name,
          hasMenuItems: businessContext.menuItems.length > 0,
          hasOperatingHours: businessContext.operatingHours.length > 0,
          hasPolicies: businessContext.policies.length > 0,
          hasLocations: businessContext.locations.length > 0
        },
        orderData,
        intent: {
          current: currentIntent,
          confidence: intentResult.confidence,
          reasoning: intentResult.reasoning
        }
      }
    });

  } catch (error) {
    console.error('Intelligent chat query error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process chat query'
    }, { status: 500 });
  }
}