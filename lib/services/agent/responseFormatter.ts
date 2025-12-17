// ===== RESPONSE FORMATTING MODULE =====
// Phase 3: Formats raw KB/DB results into user-friendly responses

export interface FormattedResponse {
  text: string;
  metadata?: {
    source: 'kb' | 'db' | 'escalation' | 'greeting' | 'fallback';
    score?: number;
    hasData?: boolean;
  };
}

/**
 * Format KB query result into user-friendly text
 */
export function formatKbResponse(
  answer: string | null | undefined,
  score?: number
): FormattedResponse {
  if (!answer || answer.trim().length === 0) {
    return {
      text: "I couldn't find relevant information in the knowledge base. Would you like to rephrase your question, or would you prefer to speak with a human agent?",
      metadata: {
        source: 'kb',
        score: score || 0,
        hasData: false
      }
    };
  }

  // Clean up the answer
  let formattedText = answer.trim();

  // If score is very low, add a disclaimer
  if (score !== undefined && score < 0.5) {
    formattedText = `${formattedText}\n\n*Note: This answer may not be fully relevant to your question. Please let me know if you need more specific information.`;
  }

  return {
    text: formattedText,
    metadata: {
      source: 'kb',
      score: score || 1.0,
      hasData: true
    }
  };
}

/**
 * Format database lookup result into user-friendly text
 */
export function formatDbResponse(
  data: any | null | undefined,
  identifierValue?: string
): FormattedResponse {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return {
      text: identifierValue
        ? `I couldn't find any record with identifier "${identifierValue}". Please verify the identifier and try again, or contact support for assistance.`
        : "I couldn't find the requested record. Please provide a valid identifier or contact support for assistance.",
      metadata: {
        source: 'db',
        hasData: false
      }
    };
  }

  // Format the data object into readable text
  let formattedText = 'Here is the information I found:\n\n';
  
  if (typeof data === 'object') {
    const entries = Object.entries(data);
    for (const [key, value] of entries) {
      // Format key (convert camelCase/snake_case to readable)
      const readableKey = formatKey(key);
      const formattedValue = formatValue(value);
      formattedText += `**${readableKey}**: ${formattedValue}\n`;
    }
  } else {
    formattedText += String(data);
  }

  return {
    text: formattedText.trim(),
    metadata: {
      source: 'db',
      hasData: true
    }
  };
}

/**
 * Format escalation message
 */
export function formatEscalationResponse(
  intent: 'action_request' | 'complaint',
  ticketId?: string
): FormattedResponse {
  let text = '';
  
  if (intent === 'action_request') {
    text = "I understand you'd like to make a change or perform an action. For security and accuracy, these requests need to be handled by our support team. ";
  } else if (intent === 'complaint') {
    text = "I'm sorry to hear about your concern. Our support team will review this and get back to you as soon as possible. ";
  }

  if (ticketId) {
    text += `I've created a support ticket (#${ticketId}) for you. Our team will review your request and respond shortly.`;
  } else {
    text += "I've escalated your request to our support team. They will review it and respond shortly.";
  }

  return {
    text,
    metadata: {
      source: 'escalation',
      hasData: true
    }
  };
}

/**
 * Format greeting response
 */
export function formatGreetingResponse(): FormattedResponse {
  const greetings = [
    "Hello! I'm here to help you. How can I assist you today?",
    "Hi there! I'm your support assistant. What can I help you with?",
    "Hello! I'm ready to help. What would you like to know?",
    "Hi! I'm here to answer your questions. How can I assist you?"
  ];
  
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  return {
    text: randomGreeting,
    metadata: {
      source: 'greeting'
    }
  };
}

/**
 * Format fallback response
 */
export function formatFallbackResponse(): FormattedResponse {
  return {
    text: "I'm not sure I understand. Could you please rephrase your question? If you need help with a specific task, I can connect you with our support team.",
    metadata: {
      source: 'fallback'
    }
  };
}

// Helper functions

function formatKey(key: string): string {
  // Convert camelCase or snake_case to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None';
    }
    // For nested objects, format as JSON (can be enhanced)
    return JSON.stringify(value, null, 2);
  }
  
  return String(value);
}


