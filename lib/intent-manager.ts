// ===== INTENT MANAGER SERVICE =====

import { PrismaClient } from '@prisma/client';

export type BotIntent = 
  | 'lookup_order'
  | 'new_order' 
  | 'cancel_order'
  | 'modify_order'
  | 'support'
  | 'general';

export interface IntentDetectionResult {
  intent: BotIntent;
  confidence: number;
  reasoning: string;
  shouldPersist: boolean;
}

export interface IntentContext {
  currentIntent: BotIntent | null;
  intentData: Record<string, any>;
  lastIntentChange: Date;
  conversationStep: number;
}

export class IntentManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Detect intent from user message
   */
  detectIntent(message: string, currentContext?: IntentContext): IntentDetectionResult {
    const text = message.toLowerCase().trim();
    
    // Intent detection patterns
    const intentPatterns = {
      lookup_order: [
        'lookup', 'look up', 'track', 'check order', 'recent order',
        'order status', 'where is my order', 'order details', 'find order',
        'order id', 'order number', 'tracking', 'status', 'my last order',
        'what did i order', 'order history'
      ],
      new_order: [
        'order', 'buy', 'menu', 'want to order', 'place order', 'get food',
        'hungry', 'food', 'pizza', 'burger', 'meal', 'lunch', 'dinner',
        'what do you have', 'show me', 'i want', 'can i get', 'i would like',
        'i need', 'give me', 'i\'ll have', 'i\'ll take'
      ],
      cancel_order: [
        'cancel', 'delete', 'remove order', 'cancel item', 'don\'t want',
        'stop order', 'cancel my order', 'remove', 'delete order'
      ],
      modify_order: [
        'update', 'add item', 'change item', 'modify', 'edit', 'change',
        'add to order', 'remove from order', 'change order'
      ],
      support: [
        'help', 'agent', 'problem', 'issue', 'complaint', 'refund',
        'support', 'assistance', 'trouble', 'error', 'wrong'
      ]
    };

    // Check for explicit intent change
    const intentChangePatterns = [
      { pattern: /now i want to|i want to place|let me order/i, intent: 'new_order' as BotIntent },
      { pattern: /help me look up|track my order/i, intent: 'lookup_order' as BotIntent },
      { pattern: /cancel my order|remove my order/i, intent: 'cancel_order' as BotIntent },
      { pattern: /modify|update|change my order/i, intent: 'modify_order' as BotIntent },
      { pattern: /i need help|support|problem/i, intent: 'support' as BotIntent }
    ];

    // Check for explicit intent changes first
    for (const { pattern, intent } of intentChangePatterns) {
      if (pattern.test(text)) {
        return {
          intent,
          confidence: 0.9,
          reasoning: `Explicit intent change detected: ${intent}`,
          shouldPersist: true
        };
      }
    }

    // Special handling for "Yes, I'd like to cancel" responses
    if (text.includes('yes') && text.includes('cancel')) {
      return {
        intent: 'cancel_order',
        confidence: 0.9,
        reasoning: 'Confirmation of cancellation intent detected',
        shouldPersist: true
      };
    }

    // Special handling for ambiguous "my order" phrases
    if (text.includes('my order') && !text.includes('check') && !text.includes('look up') && !text.includes('track')) {
      // If user says "my order" without lookup keywords, prioritize new order intent
      if (text.includes('want to') || text.includes('would like to') || text.includes('need to') || text.includes('place')) {
        return {
          intent: 'new_order',
          confidence: 0.8,
          reasoning: 'Ambiguous "my order" phrase with new order indicators',
          shouldPersist: true
        };
      }
    }

    // If we have a current intent, check if this message supports it
    if (currentContext?.currentIntent) {
      const supportingInfo = this.detectSupportingInfo(text, currentContext.currentIntent);
      if (supportingInfo.confidence > 0.7) {
        return {
          intent: currentContext.currentIntent,
          confidence: supportingInfo.confidence,
          reasoning: `Supporting information for current intent: ${currentContext.currentIntent}`,
          shouldPersist: true
        };
      }
    }

    // Score each intent based on keyword matches
    const intentScores: Record<BotIntent, number> = {
      lookup_order: 0,
      new_order: 0,
      cancel_order: 0,
      modify_order: 0,
      support: 0,
      general: 0
    };

    // Calculate scores for each intent
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          intentScores[intent as BotIntent] += 1;
        }
      }
    }

    // Find the highest scoring intent
    const maxScore = Math.max(...Object.values(intentScores));
    const detectedIntent = Object.entries(intentScores).find(([_, score]) => score === maxScore)?.[0] as BotIntent;

    // If no clear intent detected, use general
    if (maxScore === 0) {
      return {
        intent: 'general',
        confidence: 0.5,
        reasoning: 'No clear intent detected, using general',
        shouldPersist: false
      };
    }

    // Calculate confidence based on score
    const confidence = Math.min(maxScore / 3, 0.9); // Cap at 0.9

    return {
      intent: detectedIntent,
      confidence,
      reasoning: `Detected ${detectedIntent} with score ${maxScore}`,
      shouldPersist: confidence > 0.6
    };
  }

  /**
   * Detect if message contains supporting information for current intent
   */
  private detectSupportingInfo(message: string, currentIntent: BotIntent): { confidence: number; reasoning: string } {
    const text = message.toLowerCase();

    switch (currentIntent) {
      case 'lookup_order':
        // Look for name, phone, order ID patterns
        const namePattern = /(?:name|i'm|i am|call me)\s+([a-zA-Z\s]+)/i;
        const phonePattern = /(?:\d{3}[-.]?\d{3}[-.]?\d{4}|\d{10})/;
        const orderIdPattern = /[a-zA-Z0-9]{6,}/;
        
        if (namePattern.test(text) || phonePattern.test(text) || orderIdPattern.test(text)) {
          return { confidence: 0.8, reasoning: 'Supporting info for order lookup detected' };
        }
        break;

      case 'new_order':
        // Look for food items, quantities
        const foodItems = ['pizza', 'burger', 'fries', 'drink', 'salad', 'sandwich'];
        const quantityPattern = /(\d+)\s*(?:x|times|of)/i;
        
        if (foodItems.some(item => text.includes(item)) || quantityPattern.test(text)) {
          return { confidence: 0.8, reasoning: 'Food items or quantities detected' };
        }
        break;

      case 'cancel_order':
        // Look for order IDs or item names
        const orderIdPattern2 = /[a-zA-Z0-9]{6,}/;
        if (orderIdPattern2.test(text)) {
          return { confidence: 0.8, reasoning: 'Order ID for cancellation detected' };
        }
        break;

      case 'modify_order':
        // Look for specific items to modify
        const modifyPattern = /(?:add|remove|change)\s+([a-zA-Z\s]+)/i;
        if (modifyPattern.test(text)) {
          return { confidence: 0.8, reasoning: 'Modification details detected' };
        }
        break;
    }

    return { confidence: 0.3, reasoning: 'No clear supporting information' };
  }

  /**
   * Get current intent context from session
   */
  async getIntentContext(businessId: string, sessionId: string): Promise<IntentContext | null> {
    try {
      if (!this.prisma) {
        console.error('Prisma client not initialized');
        return null;
      }

      const conversation = await this.prisma.conversation.findFirst({
        where: {
          businessId,
          sessionId,
          isActive: true
        }
      });

      if (!conversation) {
        return null;
      }

      const metadata = conversation.metadata as any || {};
      return {
        currentIntent: metadata.currentIntent || null,
        intentData: metadata.intentData || {},
        lastIntentChange: metadata.lastIntentChange ? new Date(metadata.lastIntentChange) : new Date(),
        conversationStep: metadata.conversationStep || 0
      };
    } catch (error) {
      console.error('Error getting intent context:', error);
      return null;
    }
  }

  /**
   * Update intent context in session
   */
  async updateIntentContext(
    businessId: string, 
    sessionId: string, 
    intent: BotIntent,
    intentData?: Record<string, any>
  ): Promise<void> {
    try {
      if (!this.prisma) {
        console.error('Prisma client not initialized');
        return;
      }

      const currentContext = await this.getIntentContext(businessId, sessionId);
      const newStep = (currentContext?.conversationStep || 0) + 1;

      const metadata = {
        currentIntent: intent,
        intentData: intentData || {},
        lastIntentChange: new Date().toISOString(),
        conversationStep: newStep
      };

      await this.prisma.conversation.updateMany({
        where: {
          businessId,
          sessionId,
          isActive: true
        },
        data: {
          metadata
        }
      });
    } catch (error) {
      console.error('Error updating intent context:', error);
    }
  }

  /**
   * Clear intent context (when task is completed)
   */
  async clearIntentContext(businessId: string, sessionId: string): Promise<void> {
    try {
      if (!this.prisma) {
        console.error('Prisma client not initialized');
        return;
      }

      await this.prisma.conversation.updateMany({
        where: {
          businessId,
          sessionId,
          isActive: true
        },
        data: {
          metadata: {
            currentIntent: null,
            intentData: {},
            lastIntentChange: new Date().toISOString(),
            conversationStep: 0
          }
        }
      });
    } catch (error) {
      console.error('Error clearing intent context:', error);
    }
  }

  /**
   * Check if intent should be persisted based on message content
   */
  shouldPersistIntent(message: string, currentIntent: BotIntent): boolean {
    const text = message.toLowerCase();
    
    // Don't persist if user explicitly changes topic
    const topicChangePatterns = [
      /now i want to/i,
      /let me/i,
      /i want to/i,
      /can i/i,
      /help me/i
    ];

    if (topicChangePatterns.some(pattern => pattern.test(text))) {
      return false;
    }

    // Don't persist if user says goodbye or ends conversation
    const endPatterns = [
      /thank you/i,
      /goodbye/i,
      /bye/i,
      /that's all/i,
      /nothing else/i
    ];

    if (endPatterns.some(pattern => pattern.test(text))) {
      return false;
    }

    return true;
  }

  /**
   * Get intent-specific response guidance
   */
  getIntentGuidance(intent: BotIntent, step: number): string {
    switch (intent) {
      case 'lookup_order':
        switch (step) {
          case 1:
            return "Please provide your name, phone number, or order ID to look up your order.";
          case 2:
            return "I'm looking up your order details...";
          default:
            return "Is there anything else I can help you with regarding your order?";
        }

      case 'new_order':
        switch (step) {
          case 1:
            return "Great! Let me show you our menu. What would you like to order?";
          case 2:
            return "What else would you like to add to your order?";
          default:
            return "Please provide your name and phone number to complete the order.";
        }

      case 'cancel_order':
        switch (step) {
          case 1:
            return "I can help you cancel your order. Please provide your order ID.";
          case 2:
            return "I'm processing your cancellation request...";
          default:
            return "Your order has been cancelled. Is there anything else I can help you with?";
        }

      case 'modify_order':
        switch (step) {
          case 1:
            return "I can help you modify your order. Please provide your order ID and what you'd like to change.";
          case 2:
            return "I'm updating your order...";
          default:
            return "Your order has been updated. Is there anything else you'd like to change?";
        }

      case 'support':
        switch (step) {
          case 1:
            return "I'm here to help! What seems to be the issue?";
          case 2:
            return "I understand your concern. Let me connect you with our support team.";
          default:
            return "Our support team will contact you shortly. Is there anything else I can help with?";
        }

      default:
        return "How can I help you today?";
    }
  }
}

// ===== SINGLETON INSTANCE =====
let intentManagerInstance: IntentManager | null = null;

export function getIntentManager(prisma?: PrismaClient): IntentManager {
  if (!intentManagerInstance) {
    if (!prisma) {
      throw new Error('PrismaClient instance is required for first initialization');
    }
    intentManagerInstance = new IntentManager(prisma);
  }
  return intentManagerInstance;
}
