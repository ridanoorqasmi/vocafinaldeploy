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
 * Phase 4: Enhanced with better handling of no-results and low-confidence answers
 */
export function formatKbResponse(
  answer: string | null | undefined,
  score?: number
): FormattedResponse {
  if (!answer || answer.trim().length === 0) {
    return {
      text: "I don't have specific information about that in my knowledge base. Could you please rephrase your question or provide more details? If you need assistance with something specific, I can help connect you with our support team.",
      metadata: {
        source: 'kb',
        score: score || 0,
        hasData: false
      }
    };
  }

  // Clean up the answer
  let formattedText = answer.trim();
  
  // Remove any remaining form-like patterns
  formattedText = formattedText
    .replace(/^[a-z]+:\s*_+\s*$/gmi, '') // Remove "name: ____" lines
    .replace(/^[a-z]+\s*:\s*$/gmi, '') // Remove "name:" lines
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim();

  // If we filtered out everything, return not found message
  if (formattedText.length < 30) {
    return {
      text: "I don't have specific information about that in my knowledge base. Could you please rephrase your question or provide more details?",
      metadata: {
        source: 'kb',
        score: score || 0,
        hasData: false
      }
    };
  }

  // If score is low, add a disclaimer
  if (score !== undefined && score < 0.7) {
    formattedText = `${formattedText}\n\n*Note: This information may not be fully relevant to your question. Please let me know if you need more specific details.`;
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
 * Phase 4: Enhanced with more natural, modern responses
 */
export function formatGreetingResponse(): FormattedResponse {
  const greetings = [
    "Hello! I'm Luna, your AI support assistant. I'm here to help answer your questions using our knowledge base. How can I assist you today?",
    "Hi there! I'm Luna, and I'm here to help. I can answer questions about our services, products, and policies. What would you like to know?",
    "Hey! I'm Luna, your support assistant. Feel free to ask me anything, and I'll do my best to help using the information I have. What can I help you with?",
    "Hi! I'm Luna. I'm here to assist you with any questions you might have. What would you like to know?"
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
 * Phase 4: Enhanced with more helpful, modern responses
 */
export function formatFallbackResponse(): FormattedResponse {
  const fallbacks = [
    "I'm not sure I understand that. Could you please rephrase your question or provide more details? I'm here to help answer questions using our knowledge base.",
    "I didn't quite catch that. Could you try asking your question in a different way? I can help with information from our knowledge base, or connect you with our support team if needed.",
    "I'm having trouble understanding. Could you provide more context or rephrase your question? I'm here to help!"
  ];
  
  const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  
  return {
    text: randomFallback,
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


