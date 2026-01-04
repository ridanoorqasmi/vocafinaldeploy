/**
 * Phase 4: Safe Fallback Handling
 * Ensures agent always returns a polite response, never crashes
 */

export interface FallbackResponse {
  text: string;
  metadata?: {
    reason: string;
    originalError?: string;
  };
}

/**
 * Returns a polite fallback message when something fails
 */
export function getFallbackResponse(
  context: 'kb_query' | 'db_lookup' | 'intent_classification' | 'response_formatting' | 'general',
  originalError?: Error | string
): FallbackResponse {
  const errorMessage = originalError instanceof Error 
    ? originalError.message 
    : String(originalError || '');

  const fallbackMessages: Record<string, string> = {
    kb_query: "I'm having trouble accessing the knowledge base right now. Please try rephrasing your question, or I can connect you with a human agent for assistance.",
    db_lookup: "I'm unable to look up that information at the moment. Would you like me to connect you with a support agent who can help?",
    intent_classification: "I'm not quite sure how to help with that. Could you provide a bit more detail, or would you like to speak with a human agent?",
    response_formatting: "I encountered an issue processing your request. Let me connect you with someone who can assist you right away.",
    general: "I'm experiencing a technical issue. Please try again in a moment, or I can connect you with a support agent for immediate assistance."
  };

  return {
    text: fallbackMessages[context] || fallbackMessages.general,
    metadata: {
      reason: context,
      originalError: errorMessage || undefined
    }
  };
}

/**
 * Wraps an async function with fallback handling
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  context: 'kb_query' | 'db_lookup' | 'intent_classification' | 'response_formatting' | 'general',
  fallbackValue: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[FALLBACK] ${context} failed:`, error);
    return fallbackValue;
  }
}

/**
 * Checks if an error should trigger escalation
 */
export function shouldEscalate(error: Error | string): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Escalate on critical errors
  const criticalPatterns = [
    /database.*connection/i,
    /timeout/i,
    /rate limit/i,
    /unauthorized/i,
    /forbidden/i
  ];

  return criticalPatterns.some(pattern => pattern.test(errorMessage));
}














