/**
 * Conversation State Manager
 * Lightweight middleware for maintaining intent continuity in chat flows
 * Does not modify existing business logic - only wraps around it
 */

export interface ConversationSession {
  activeIntent: 'take_order' | 'cancel_order' | 'lookup_order' | null;
  awaitingSlot: 'name' | 'phone' | 'item' | 'order_id' | null;
  data: {
    name: string | null;
    phone: string | null;
    items: string[];
    orderId: string | null;
  };
  irrelevantCount: number;
  slotRetryCount: number;
  lastActivity: number;
  sessionId?: string;
  businessId?: string;
}

export class ConversationStateManager {
  private sessions: Map<string, ConversationSession> = new Map();

  /**
   * Get or create session for user
   */
  getSession(sessionId: string, businessId: string): ConversationSession {
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          activeIntent: null,
          awaitingSlot: null,
          data: {
            name: null,
            phone: null,
            items: [],
            orderId: null
          },
          irrelevantCount: 0,
          slotRetryCount: 0,
          lastActivity: Date.now(),
          sessionId,
          businessId
        });
      }
    return this.sessions.get(sessionId)!;
  }

  /**
   * Check if we're in an active flow awaiting specific input
   */
  isAwaitingSlot(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session ? session.awaitingSlot !== null : false;
  }

  /**
   * Handle slot input and move to next step
   */
  handleSlotInput(sessionId: string, userMessage: string): {
    shouldContinue: boolean;
    response?: string;
    nextSlot?: string;
  } {
    const session = this.getSession(sessionId, '');
    
    if (!session.awaitingSlot) {
      return { shouldContinue: true };
    }

    const trimmedMessage = userMessage.trim();
    
    // Update last activity
    session.lastActivity = Date.now();
    
    // Reset irrelevant count on valid input
    session.irrelevantCount = 0;
    
    // Check for session timeout (5 minutes of inactivity)
    if (Date.now() - session.lastActivity > 5 * 60 * 1000) {
      console.log('Session timeout detected, resetting conversation state');
      this.resetSession(sessionId);
      return {
        shouldContinue: false,
        response: "I notice we've been going in circles. Let's start fresh! Would you like to place a new order?"
      };
    }
    
    // Check for retry limit - if too many retries, accept any input and move on
    if (session.slotRetryCount >= 3) {
      console.log(`Slot retry limit reached for ${session.awaitingSlot}, accepting input and moving on`);
      session.slotRetryCount = 0;
      
      switch (session.awaitingSlot) {
        case 'phone':
          session.data.phone = trimmedMessage;
          session.awaitingSlot = 'item';
          return {
            shouldContinue: false,
            response: `Got it! What would you like to order?`,
            nextSlot: 'item'
          };
        case 'name':
          session.data.name = trimmedMessage;
          session.awaitingSlot = 'phone';
          return {
            shouldContinue: false,
            response: `Thanks ${session.data.name}! May I have your phone number?`,
            nextSlot: 'phone'
          };
        default:
          return { shouldContinue: true };
      }
    }

    switch (session.awaitingSlot) {
      case 'name':
        session.data.name = trimmedMessage;
        session.awaitingSlot = 'phone';
        return {
          shouldContinue: false,
          response: `Thanks ${session.data.name}! May I have your phone number?`,
          nextSlot: 'phone'
        };

      case 'phone':
        // More intelligent phone validation
        const phoneNumbers = trimmedMessage.replace(/[\s\-\(\)\.]/g, '');
        const hasNumbers = /\d/.test(phoneNumbers);
        const hasEnoughDigits = phoneNumbers.length >= 7;
        
        console.log(`Phone validation: "${trimmedMessage}" -> digits: "${phoneNumbers}", length: ${phoneNumbers.length}, hasNumbers: ${hasNumbers}`);
        
        if (!hasNumbers || !hasEnoughDigits) {
          session.slotRetryCount++;
          console.log(`Phone validation failed, retry count: ${session.slotRetryCount}`);
          
          if (session.slotRetryCount >= 2) {
            // After 2 failed attempts, accept any input with numbers
            console.log('Accepting phone number after retry limit');
            session.data.phone = trimmedMessage;
            session.awaitingSlot = 'item';
            session.slotRetryCount = 0;
            return {
              shouldContinue: false,
              response: `Got it! What would you like to order?`,
              nextSlot: 'item'
            };
          }
          
          return {
            shouldContinue: false,
            response: 'Please provide a valid phone number with at least 7 digits.'
          };
        }
        
        // Reset retry count on successful validation
        session.slotRetryCount = 0;
        session.data.phone = trimmedMessage;
        session.awaitingSlot = 'item';
        return {
          shouldContinue: false,
          response: `Got it! What would you like to order?`,
          nextSlot: 'item'
        };

      case 'item':
        session.data.items.push(trimmedMessage);
        session.awaitingSlot = null;
        session.activeIntent = null;
        return {
          shouldContinue: false,
          response: `Great! I've added "${trimmedMessage}" to your order. Would you like to add anything else, or shall I proceed with your order?`
        };

      case 'order_id':
        session.data.orderId = trimmedMessage;
        session.awaitingSlot = null;
        session.activeIntent = null;
        return {
          shouldContinue: false,
          response: `Got it! Let me look up order ${trimmedMessage} for you.`
        };

      default:
        return { shouldContinue: true };
    }
  }

  /**
   * Start a new flow
   */
  startFlow(sessionId: string, intent: 'take_order' | 'cancel_order' | 'lookup_order', businessId: string): void {
    const session = this.getSession(sessionId, businessId);
    session.activeIntent = intent;
    session.irrelevantCount = 0;
    
    switch (intent) {
      case 'take_order':
        session.awaitingSlot = 'name';
        session.data = { name: null, phone: null, items: [], orderId: null };
        break;
      case 'cancel_order':
      case 'lookup_order':
        session.awaitingSlot = 'order_id';
        session.data = { name: null, phone: null, items: [], orderId: null };
        break;
    }
  }

  /**
   * Handle irrelevant input during active flow
   */
  handleIrrelevantInput(sessionId: string, userMessage: string): {
    shouldContinue: boolean;
    response?: string;
    shouldReset?: boolean;
  } {
    const session = this.getSession(sessionId, '');
    
    if (!session.awaitingSlot) {
      return { shouldContinue: true };
    }

    session.irrelevantCount++;

    // Check for soft reset trigger
    if (session.irrelevantCount >= 3) {
      this.resetSession(sessionId);
      return {
        shouldContinue: false,
        response: "I notice we've gotten a bit off track. Let's start fresh! Would you like to place a new order, cancel an existing order, or check your order status?",
        shouldReset: true
      };
    }

    // Gentle redirect based on current slot
    let redirectMessage = '';
    switch (session.awaitingSlot) {
      case 'name':
        redirectMessage = "I'd love to help with that! First, could I get your name for the order?";
        break;
      case 'phone':
        redirectMessage = "Sure! To complete your order, I'll need your phone number.";
        break;
      case 'item':
        redirectMessage = "Great! What would you like to order from our menu?";
        break;
      case 'order_id':
        redirectMessage = "I can help with that! What's your order ID?";
        break;
    }

    return {
      shouldContinue: false,
      response: redirectMessage
    };
  }

  /**
   * Reset session to initial state
   */
  resetSession(sessionId: string): void {
    const session = this.getSession(sessionId, '');
    session.activeIntent = null;
    session.awaitingSlot = null;
    session.data = { name: null, phone: null, items: [], orderId: null };
    session.irrelevantCount = 0;
    session.slotRetryCount = 0;
    session.lastActivity = Date.now();
  }

  /**
   * Get current session data
   */
  getSessionData(sessionId: string): ConversationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Check if message is relevant to current slot
   */
  isRelevantToSlot(sessionId: string, userMessage: string): boolean {
    const session = this.getSession(sessionId, '');
    if (!session.awaitingSlot) return true;

    const message = userMessage.toLowerCase().trim();

    // Check for order confirmation keywords - if found, bypass conversation state
    const confirmationKeywords = [
      'yes', 'confirm', 'process my order', 'take my order', 
      'proceed', 'go ahead', 'confirm order', 'place order',
      'yes process', 'yes confirm', 'process order'
    ];
    
    if (confirmationKeywords.some(keyword => message.includes(keyword))) {
      console.log('Order confirmation detected, bypassing conversation state');
      return false; // This will skip conversation state handling
    }

    switch (session.awaitingSlot) {
      case 'name':
        // Check if it looks like a name (not a question, not a command)
        return !message.includes('?') && 
               !message.includes('what') && 
               !message.includes('how') &&
               !message.includes('menu') &&
               !message.includes('order') &&
               !message.includes('cancel') &&
               message.length > 1;

      case 'phone':
        // Check if it contains numbers
        return /\d/.test(message);

      case 'item':
        // Check if it mentions food items or ordering
        const foodKeywords = ['burger', 'pizza', 'salad', 'order', 'want', 'like', 'have'];
        return foodKeywords.some(keyword => message.includes(keyword));

      case 'order_id':
        // Check if it contains alphanumeric characters (likely an ID)
        return /[a-zA-Z0-9]/.test(message);

      default:
        return true;
    }
  }

  /**
   * Check if message is an order confirmation
   */
  isOrderConfirmation(userMessage: string): boolean {
    const message = userMessage.toLowerCase().trim();
    const confirmationKeywords = [
      'yes', 'confirm', 'process my order', 'take my order', 
      'proceed', 'go ahead', 'confirm order', 'place order',
      'yes process', 'yes confirm', 'process order'
    ];
    
    return confirmationKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if we have all required data for order processing
   */
  hasAllOrderData(sessionId: string): boolean {
    const session = this.getSession(sessionId, '');
    return !!(session.data.name && session.data.phone && session.data.items.length > 0);
  }

  /**
   * Get collected order data
   */
  getOrderData(sessionId: string): { name: string; phone: string; items: string[] } | null {
    const session = this.getSession(sessionId, '');
    if (this.hasAllOrderData(sessionId)) {
      return {
        name: session.data.name!,
        phone: session.data.phone!,
        items: session.data.items
      };
    }
    return null;
  }

  /**
   * Handle order confirmation - reset conversation state
   */
  handleOrderConfirmation(sessionId: string): void {
    console.log('Order confirmation received, resetting conversation state');
    this.resetSession(sessionId);
  }

  /**
   * Clean up old sessions (optional - for memory management)
   */
  cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    // This would need timestamp tracking to implement properly
    // For now, we'll keep it simple and not implement cleanup
  }

  /**
   * Check if user message contains complete order information
   */
  hasCompleteOrderInfo(userMessage: string): { hasName: boolean; hasPhone: boolean; hasItems: boolean } {
    const trimmedMessage = userMessage.toLowerCase().trim();
    
    // Check for name patterns
    const namePatterns = [
      /(?:my name is|i'm|i am|name is)\s+([a-zA-Z\s]{2,})/i,
      /(?:call me|i'm called)\s+([a-zA-Z\s]{2,})/i
    ];
    const hasName = namePatterns.some(pattern => pattern.test(trimmedMessage));
    
    // Check for phone patterns
    const phonePatterns = [
      /\d{7,}/,
      /(?:phone|number|contact).*\d/,
      /(?:call|text|reach).*\d/
    ];
    const hasPhone = phonePatterns.some(pattern => pattern.test(trimmedMessage));
    
    // Check for item patterns
    const itemPatterns = [
      /(?:order|want|like|get|have)\s+(?:a|an|some|the)?\s*([a-zA-Z\s]+)/,
      /(?:burger|pizza|sandwich|salad|drink|food)/,
      /(?:smash|chicken|beef|veggie)/
    ];
    const hasItems = itemPatterns.some(pattern => pattern.test(trimmedMessage));
    
    return { hasName, hasPhone, hasItems };
  }
}

// Global instance
export const conversationState = new ConversationStateManager();
