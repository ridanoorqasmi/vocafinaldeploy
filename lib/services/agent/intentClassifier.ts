// ===== INTENT CLASSIFICATION MODULE =====
// Phase 3: Generic intent classification for support agent

export type IntentType = 
  | 'kb_question'      // Knowledge base question
  | 'db_lookup'        // Database lookup request
  | 'action_request'   // Request requiring modification/write → escalate
  | 'complaint'        // Complaint → escalate
  | 'greeting'         // Greeting message
  | 'fallback';        // Default fallback

export interface IntentClassificationResult {
  intent: IntentType;
  confidence: number;
  extractedValue?: string; // For db_lookup, extracted identifier
}

/**
 * Classify user intent from message text
 * Uses rule-based heuristics (can be enhanced with LLM later)
 */
export function classifyIntent(message: string): IntentClassificationResult {
  const normalizedMessage = message.toLowerCase().trim();
  
  // Skip empty messages
  if (normalizedMessage.length === 0) {
    return { intent: 'fallback', confidence: 0.0 };
  }

  // Complaint patterns (check before other patterns)
  if (isComplaint(normalizedMessage)) {
    return { intent: 'complaint', confidence: 0.85 };
  }

  // Action request patterns (modification/write operations)
  if (isActionRequest(normalizedMessage)) {
    return { intent: 'action_request', confidence: 0.8 };
  }

  // Database lookup patterns (looking up specific records/IDs)
  const dbLookupResult = detectDbLookup(normalizedMessage);
  if (dbLookupResult) {
    return dbLookupResult;
  }

  // Greeting patterns (check after DB lookup to avoid false positives)
  if (isGreeting(normalizedMessage)) {
    return { intent: 'greeting', confidence: 0.9 };
  }

  // Knowledge base question (default for informational queries)
  // This should catch most questions and informational requests
  if (isKbQuestion(normalizedMessage)) {
    return { intent: 'kb_question', confidence: 0.8 };
  }

  // Fallback - but still try KB first
  return { intent: 'kb_question', confidence: 0.6 };
}

function isGreeting(message: string): boolean {
  // Only treat as pure greeting if it's very short and just a greeting
  // Longer messages with greetings should be treated as questions
  const pureGreetingPatterns = [
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)$/,
    /^(hi there|hello there|hey there)$/,
    /^(what's up|whats up|sup)$/
  ];
  
  // If it's just a greeting word/phrase, it's a greeting
  if (pureGreetingPatterns.some(pattern => pattern.test(message))) {
    return true;
  }
  
  // If message is very short (1-2 words) and starts with greeting, treat as greeting
  const words = message.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 2) {
    const greetingStartPatterns = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/,
    ];
    return greetingStartPatterns.some(pattern => pattern.test(message));
  }
  
  // Otherwise, treat greeting + question as a question
  return false;
}

function isComplaint(message: string): boolean {
  const complaintKeywords = [
    'complaint', 'complain', 'unhappy', 'dissatisfied', 'disappointed',
    'terrible', 'awful', 'horrible', 'worst', 'bad service', 'poor service',
    'issue', 'problem', 'wrong', 'error', 'mistake', 'fault', 'faulty',
    'broken', 'not working', "doesn't work", 'refund', 'return', 'cancel'
  ];
  return complaintKeywords.some(keyword => message.includes(keyword));
}

function isActionRequest(message: string): boolean {
  const actionKeywords = [
    'create', 'add', 'insert', 'update', 'modify', 'change', 'edit', 'delete',
    'remove', 'cancel', 'refund', 'process', 'submit', 'send', 'place order',
    'make', 'do', 'set', 'configure', 'setup', 'install', 'activate',
    'deactivate', 'enable', 'disable', 'reset', 'clear', 'save', 'store'
  ];
  
  // Check for action verbs at start or with "I want to", "can you", etc.
  const actionPatterns = [
    /^(create|add|insert|update|modify|change|edit|delete|remove|cancel|refund|process|submit|send|place|make|do|set|configure|setup|install|activate|deactivate|enable|disable|reset|clear|save|store)/,
    /(i want to|i need to|can you|please|i'd like to|i would like to).*(create|add|insert|update|modify|change|edit|delete|remove|cancel|refund|process|submit|send|place|make|do|set|configure|setup|install|activate|deactivate|enable|disable|reset|clear|save|store)/
  ];
  
  return actionKeywords.some(keyword => message.includes(keyword)) ||
         actionPatterns.some(pattern => pattern.test(message));
}

function detectDbLookup(message: string): IntentClassificationResult | null {
  // Patterns for database lookups (ID numbers, order numbers, reference numbers, etc.)
  const idPatterns = [
    /\b(order|order #|order number|order id|orderid|orderno)\s*[#:]?\s*([a-z0-9\-]+)/i,
    /\b(id|identifier|ref|reference|ref #|reference number|refno)\s*[#:]?\s*([a-z0-9\-]+)/i,
    /\b(customer|cust|customer id|customer number|custid|custno)\s*[#:]?\s*([a-z0-9\-]+)/i,
    /\b(ticket|ticket #|ticket number|ticket id|ticketno)\s*[#:]?\s*([a-z0-9\-]+)/i,
    /\b(account|account #|account number|account id|accountno)\s*[#:]?\s*([a-z0-9\-]+)/i,
    /\b(invoice|invoice #|invoice number|invoice id|invoiceno)\s*[#:]?\s*([a-z0-9\-]+)/i,
    /\blookup\s+(.+)/i,
    /\bfind\s+(.+)/i,
    /\bshow\s+(me\s+)?(info|information|details|data)\s+(for|about|on)\s+(.+)/i,
    /\bwhat\s+(is|are)\s+(the\s+)?(info|information|details|data)\s+(for|about|on)\s+(.+)/i
  ];

  for (const pattern of idPatterns) {
    const match = message.match(pattern);
    if (match) {
      // Extract the identifier value (usually the last capture group)
      const extractedValue = match[match.length - 1]?.trim();
      if (extractedValue && extractedValue.length > 0) {
        return {
          intent: 'db_lookup',
          confidence: 0.8,
          extractedValue
        };
      }
    }
  }

  // Check for standalone ID-like patterns (alphanumeric strings that look like IDs)
  const standaloneIdPattern = /\b([A-Z0-9]{4,}[-\-]?[A-Z0-9]{4,})\b/;
  const standaloneMatch = message.match(standaloneIdPattern);
  if (standaloneMatch && message.length < 100) { // Short messages with ID-like strings
    return {
      intent: 'db_lookup',
      confidence: 0.65,
      extractedValue: standaloneMatch[1]
    };
  }

  return null;
}

function isKbQuestion(message: string): boolean {
  // If it's a pure greeting (very short), don't treat as KB question
  if (isGreeting(message) && message.split(/\s+/).length <= 2) {
    return false;
  }
  
  // Question patterns
  const questionPatterns = [
    /^(what|when|where|who|why|how|which|can|could|should|would|is|are|do|does|did|will|has|have)/,
    /\?$/,
    /^(tell me|explain|describe|show me|help me|i need help|i want to know|i'm looking for)/
  ];
  
  // If it matches question patterns, it's a KB question
  if (questionPatterns.some(pattern => pattern.test(message))) {
    return true;
  }
  
  // Default: treat most messages as potential KB questions (except pure greetings, complaints, actions, DB lookups)
  // This makes the agent more helpful and tries to answer from KB first
  return true;
}


