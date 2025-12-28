/**
 * Session-Based Conversation Memory
 * Maintains context within a single chat session only
 * No persistence across sessions
 */

interface ConversationMessage {
  role: 'user' | 'agent';
  content: string;
}

interface SessionContext {
  keyTopics: string[]; // Main topics discussed
  keyFacts: string[]; // Important facts already explained
  lastQuestion?: string; // Most recent user question
  lastAnswer?: string; // Most recent agent answer
  conversationFlow: string; // Brief summary of conversation flow
}

/**
 * Analyze conversation history to extract key context
 */
export function extractSessionContext(
  conversationHistory: ConversationMessage[]
): SessionContext {
  if (conversationHistory.length === 0) {
    return {
      keyTopics: [],
      keyFacts: [],
      conversationFlow: ''
    };
  }

  const keyTopics: string[] = [];
  const keyFacts: string[] = [];
  const lastQuestion = conversationHistory[conversationHistory.length - 1]?.content;
  const lastAnswer = conversationHistory[conversationHistory.length - 2]?.content;

  // Extract topics from user questions
  for (const msg of conversationHistory) {
    if (msg.role === 'user') {
      const question = msg.content.toLowerCase();
      
      // Extract topic keywords
      if (question.includes('refund')) keyTopics.push('refund policy');
      if (question.includes('return')) keyTopics.push('return policy');
      if (question.includes('shipping') || question.includes('delivery')) keyTopics.push('shipping');
      if (question.includes('order') || question.includes('purchase')) keyTopics.push('orders');
      if (question.includes('payment') || question.includes('pay')) keyTopics.push('payment');
      if (question.includes('discount') || question.includes('coupon')) keyTopics.push('discounts');
      if (question.includes('warranty') || question.includes('guarantee')) keyTopics.push('warranty');
      if (question.includes('cancel')) keyTopics.push('cancellation');
    }
  }

  // Remove duplicates
  const uniqueTopics = Array.from(new Set(keyTopics));

  // Extract key facts from agent answers (first 2-3 sentences)
  for (const msg of conversationHistory) {
    if (msg.role === 'agent' && msg.content.length > 50) {
      const sentences = msg.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      if (sentences.length > 0) {
        // Take first key statement
        const keyFact = sentences[0].trim();
        if (keyFact.length < 200) { // Keep it concise
          keyFacts.push(keyFact);
        }
      }
    }
  }

  // Build conversation flow summary
  const userQuestions = conversationHistory
    .filter(msg => msg.role === 'user')
    .map(msg => msg.content)
    .slice(-3); // Last 3 questions

  const conversationFlow = userQuestions.length > 0
    ? `Recent questions: ${userQuestions.join(' → ')}`
    : '';

  return {
    keyTopics: uniqueTopics,
    keyFacts: keyFacts.slice(-5), // Keep last 5 key facts
    lastQuestion,
    lastAnswer,
    conversationFlow
  };
}

/**
 * Detect if question is a follow-up that references previous context
 */
export function isFollowUpQuestion(
  question: string,
  sessionContext: SessionContext
): boolean {
  const lowerQuestion = question.toLowerCase().trim();
  
  // Strong follow-up indicators
  const followUpPatterns = [
    /\b(it|this|that|they|them|those|these)\b/i, // Pronouns
    /\b(also|and|what about|how about)\b/i, // Continuation words
    /^(so|well|ok|okay|alright|then|now)\b/i, // Conversation continuers
    /\b(does it|can it|will it|is it|do they)\b/i, // Questions about "it"
    /\b(what should|what do|how do|where do|when do)\b/i, // Action questions (often follow-ups)
    /\b(apply|applicable|work|works|include|includes)\b/i, // Context-dependent verbs
  ];

  // Check patterns
  const hasFollowUpPattern = followUpPatterns.some(pattern => pattern.test(lowerQuestion));

  // Check if question is very short (likely a follow-up)
  const isShort = question.split(/\s+/).length <= 8;

  // Check if question references a topic from context
  const referencesTopic = sessionContext.keyTopics.some(topic => 
    lowerQuestion.includes(topic.toLowerCase())
  );

  // Check if question asks "what should I do" or similar (progressive question)
  const isProgressive = /\b(what should|what do|how do|next|now|then)\b/i.test(lowerQuestion);

  return hasFollowUpPattern || (isShort && referencesTopic) || isProgressive;
}

/**
 * Resolve pronouns and references in question using session context
 */
export function resolveQuestionContext(
  question: string,
  sessionContext: SessionContext
): string {
  if (!isFollowUpQuestion(question, sessionContext)) {
    return question;
  }

  // If question uses pronouns, try to resolve them
  const lowerQuestion = question.toLowerCase();
  let resolvedQuestion = question;
  
  // Resolve pronouns with most recent topic
  if (/\b(it|this|that)\b/i.test(question)) {
    if (sessionContext.keyTopics.length > 0) {
      const lastTopic = sessionContext.keyTopics[sessionContext.keyTopics.length - 1];
      // Replace pronoun with topic (case-insensitive)
      resolvedQuestion = question.replace(/\b(it|this|that)\b/gi, (match) => {
        // Preserve case
        if (match === 'It' || match === 'it') return lastTopic;
        if (match === 'This' || match === 'this') return lastTopic;
        if (match === 'That' || match === 'that') return lastTopic;
        return lastTopic;
      });
    }
  }

  // Resolve "they/them" with plural topics
  if (/\b(they|them|those|these)\b/i.test(question)) {
    if (sessionContext.keyTopics.length > 1) {
      const topics = sessionContext.keyTopics.slice(-2).join(' and ');
      resolvedQuestion = question.replace(/\b(they|them|those|these)\b/gi, topics);
    } else if (sessionContext.keyTopics.length === 1) {
      resolvedQuestion = question.replace(/\b(they|them|those|these)\b/gi, sessionContext.keyTopics[0]);
    }
  }

  // If question is very vague or action-oriented, add context
  if ((question.length < 30 || /\b(what should|what do|how do|next|now|then)\b/i.test(question)) 
      && sessionContext.keyTopics.length > 0) {
    const mainTopic = sessionContext.keyTopics[sessionContext.keyTopics.length - 1];
    // Only add context if not already present
    if (!lowerQuestion.includes(mainTopic.toLowerCase())) {
      resolvedQuestion = `${question} (in context of ${mainTopic})`;
    }
  }

  return resolvedQuestion;
}

/**
 * Build enhanced context prompt for the agent
 */
export function buildSessionContextPrompt(
  sessionContext: SessionContext,
  conversationHistory: ConversationMessage[]
): string {
  if (conversationHistory.length === 0) {
    return '';
  }

  const parts: string[] = [];

  // Add key topics (most important for context)
  if (sessionContext.keyTopics.length > 0) {
    parts.push(`Current topic: ${sessionContext.keyTopics[sessionContext.keyTopics.length - 1]}`);
    if (sessionContext.keyTopics.length > 1) {
      parts.push(`Previously discussed: ${sessionContext.keyTopics.slice(0, -1).join(', ')}`);
    }
  }

  // Add recent exchange (last Q&A) - most relevant
  if (sessionContext.lastQuestion && sessionContext.lastAnswer) {
    parts.push(`\nLast exchange:\nUser: "${sessionContext.lastQuestion}"\nYou: "${sessionContext.lastAnswer.substring(0, 300)}${sessionContext.lastAnswer.length > 300 ? '...' : ''}"`);
  }

  // Add key facts already explained (to avoid repetition)
  if (sessionContext.keyFacts.length > 0) {
    parts.push(`\nAlready explained to user:\n- ${sessionContext.keyFacts.slice(-3).join('\n- ')}`);
  }

  // Add full recent conversation (last 6-8 messages for full context)
  if (conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-8);
    parts.push(`\nFull conversation history:\n${recentMessages.map((msg, idx) => {
      const role = msg.role === 'user' ? 'User' : 'You';
      return `${idx + 1}. ${role}: ${msg.content}`;
    }).join('\n')}`);
  }

  return parts.join('\n');
}

/**
 * Check if question asks for information already explained
 */
export function isAlreadyExplained(
  question: string,
  sessionContext: SessionContext
): boolean {
  const lowerQuestion = question.toLowerCase();
  
  // Check if any key fact matches the question topic
  for (const fact of sessionContext.keyFacts) {
    const factLower = fact.toLowerCase();
    
    // Simple keyword matching
    const questionWords = lowerQuestion.split(/\s+/).filter(w => w.length > 4);
    const factWords = factLower.split(/\s+/).filter(w => w.length > 4);
    
    const overlap = questionWords.filter(w => factWords.includes(w));
    
    if (overlap.length >= 2) {
      return true; // Likely already explained
    }
  }
  
  return false;
}

