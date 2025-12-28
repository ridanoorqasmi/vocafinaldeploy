/**
 * Support-Specific Intent Classifier
 * Classifies user messages into support intents for tone adjustment
 * Internal only - not shown to users
 */

export type SupportIntent = 
  | 'faq'              // General or factual questions
  | 'policy'           // Questions about rules, terms, or conditions
  | 'how_to'           // Guidance or process-related questions
  | 'complaint'        // Negative sentiment, dissatisfaction, or confusion
  | 'pre_sales'        // Interest before buying or signing up
  | 'escalation_risk'  // Anger, urgency, or request for human support
  | 'general';         // Default fallback

export interface SupportIntentResult {
  intent: SupportIntent;
  confidence: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'urgent';
}

/**
 * Classify support-specific intent from user message
 * Used internally for tone adjustment only
 */
export function classifySupportIntent(message: string): SupportIntentResult {
  const normalizedMessage = message.toLowerCase().trim();
  
  if (normalizedMessage.length === 0) {
    return { intent: 'general', confidence: 0.0, sentiment: 'neutral' };
  }

  // 1. Escalation Risk (check first - highest priority)
  const escalationResult = detectEscalationRisk(normalizedMessage);
  if (escalationResult) {
    return escalationResult;
  }

  // 2. Complaint / Frustration
  const complaintResult = detectComplaint(normalizedMessage);
  if (complaintResult) {
    return complaintResult;
  }

  // 3. Pre-sales questions
  const preSalesResult = detectPreSales(normalizedMessage);
  if (preSalesResult) {
    return preSalesResult;
  }

  // 4. Policy clarification
  const policyResult = detectPolicyQuestion(normalizedMessage);
  if (policyResult) {
    return policyResult;
  }

  // 5. How-to / Steps
  const howToResult = detectHowTo(normalizedMessage);
  if (howToResult) {
    return howToResult;
  }

  // 6. FAQ (default for general questions)
  const faqResult = detectFAQ(normalizedMessage);
  if (faqResult) {
    return faqResult;
  }

  // Fallback
  return { intent: 'general', confidence: 0.5, sentiment: 'neutral' };
}

/**
 * Detect escalation risk - anger, urgency, or request for human
 */
function detectEscalationRisk(message: string): SupportIntentResult | null {
  const urgentKeywords = [
    'urgent', 'asap', 'immediately', 'right now', 'emergency', 'critical',
    'need help now', 'can\'t wait', 'time sensitive'
  ];

  const angerKeywords = [
    'terrible', 'awful', 'horrible', 'worst', 'ridiculous', 'unacceptable',
    'fed up', 'enough', 'done with', 'cancel everything', 'never again'
  ];

  const humanRequestPatterns = [
    /(speak|talk|connect|transfer|forward|escalate).*(human|person|agent|representative|manager|supervisor)/,
    /(i want|i need|can i|may i).*(human|person|agent|representative|manager|supervisor)/,
    /(get me|put me|let me).*(human|person|agent|representative|manager|supervisor)/
  ];

  const hasUrgency = urgentKeywords.some(keyword => message.includes(keyword));
  const hasAnger = angerKeywords.some(keyword => message.includes(keyword));
  const requestsHuman = humanRequestPatterns.some(pattern => pattern.test(message));

  if (hasUrgency || hasAnger || requestsHuman) {
    let sentiment: 'urgent' | 'frustrated' = hasAnger ? 'frustrated' : 'urgent';
    return {
      intent: 'escalation_risk',
      confidence: 0.9,
      sentiment
    };
  }

  return null;
}

/**
 * Detect complaint or frustration
 */
function detectComplaint(message: string): SupportIntentResult | null {
  const complaintKeywords = [
    'complaint', 'complain', 'unhappy', 'dissatisfied', 'disappointed',
    'not happy', 'not satisfied', 'issue', 'problem', 'wrong', 'error',
    'mistake', 'fault', 'faulty', 'broken', 'not working', "doesn't work",
    'poor service', 'bad service', 'terrible service', 'slow', 'late',
    'frustrated', 'frustrating', 'annoyed', 'annoying', 'upset'
  ];

  const negativePhrases = [
    'not good', 'not great', 'could be better', 'not impressed',
    'not what i expected', 'disappointed with', 'unhappy with'
  ];

  const hasComplaint = complaintKeywords.some(keyword => message.includes(keyword));
  const hasNegativePhrase = negativePhrases.some(phrase => message.includes(phrase));

  if (hasComplaint || hasNegativePhrase) {
    return {
      intent: 'complaint',
      confidence: 0.85,
      sentiment: 'frustrated'
    };
  }

  return null;
}

/**
 * Detect pre-sales questions
 */
function detectPreSales(message: string): SupportIntentResult | null {
  const preSalesKeywords = [
    'interested in', 'thinking about', 'considering', 'looking to',
    'want to buy', 'want to purchase', 'want to sign up', 'want to join',
    'pricing', 'price', 'cost', 'how much', 'what does it cost',
    'features', 'what can it do', 'capabilities', 'what\'s included',
    'trial', 'demo', 'free', 'discount', 'promotion', 'offer',
    'compare', 'difference between', 'vs', 'versus', 'better than'
  ];

  const preSalesPatterns = [
    /(tell me|show me|explain).*(about|features|pricing|cost|price)/,
    /(what|how).*(does|can|will).*(cost|price|work)/,
    /(is|are).*(there|any).*(trial|demo|free|discount|promotion)/
  ];

  const hasPreSalesKeyword = preSalesKeywords.some(keyword => message.includes(keyword));
  const matchesPreSalesPattern = preSalesPatterns.some(pattern => pattern.test(message));

  if (hasPreSalesKeyword || matchesPreSalesPattern) {
    return {
      intent: 'pre_sales',
      confidence: 0.8,
      sentiment: 'positive'
    };
  }

  return null;
}

/**
 * Detect policy clarification questions
 */
function detectPolicyQuestion(message: string): SupportIntentResult | null {
  const policyKeywords = [
    'policy', 'policies', 'terms', 'conditions', 'rules', 'guidelines',
    'refund policy', 'return policy', 'cancellation policy', 'privacy policy',
    'shipping policy', 'delivery policy', 'warranty', 'guarantee',
    'allowed', 'not allowed', 'permitted', 'prohibited', 'restrictions',
    'requirements', 'eligibility', 'qualify', 'qualification'
  ];

  const policyPatterns = [
    /(what|what's|what is|what are).*(policy|policies|terms|conditions|rules)/,
    /(can i|may i|am i allowed|is it allowed|is it permitted).*/,
    /(refund|return|cancel|shipping|delivery|warranty).*(policy|terms|conditions)/
  ];

  const hasPolicyKeyword = policyKeywords.some(keyword => message.includes(keyword));
  const matchesPolicyPattern = policyPatterns.some(pattern => pattern.test(message));

  if (hasPolicyKeyword || matchesPolicyPattern) {
    return {
      intent: 'policy',
      confidence: 0.85,
      sentiment: 'neutral'
    };
  }

  return null;
}

/**
 * Detect how-to or step-by-step questions
 */
function detectHowTo(message: string): SupportIntentResult | null {
  const howToKeywords = [
    'how to', 'how do i', 'how can i', 'how should i', 'how do you',
    'steps', 'step by step', 'process', 'procedure', 'guide', 'tutorial',
    'walk me through', 'show me how', 'help me', 'assist me',
    'set up', 'setup', 'configure', 'install', 'activate', 'enable',
    'get started', 'begin', 'start using', 'use', 'access'
  ];

  const howToPatterns = [
    /^how (to|do|can|should|will)/,
    /(what|what are|what's).*(steps|process|procedure|way|method)/,
    /(guide|walk|show|help|assist).*(me|through|how)/
  ];

  const hasHowToKeyword = howToKeywords.some(keyword => message.includes(keyword));
  const matchesHowToPattern = howToPatterns.some(pattern => pattern.test(message));

  if (hasHowToKeyword || matchesHowToPattern) {
    return {
      intent: 'how_to',
      confidence: 0.85,
      sentiment: 'neutral'
    };
  }

  return null;
}

/**
 * Detect FAQ - general factual questions
 */
function detectFAQ(message: string): SupportIntentResult | null {
  // FAQ is typically questions that don't fit other categories
  const questionPatterns = [
    /^(what|when|where|who|why|which|can|could|should|would|is|are|do|does|did|will|has|have)/,
    /\?$/,
    /^(tell me|explain|describe|what is|what are|what's)/
  ];

  const isQuestion = questionPatterns.some(pattern => pattern.test(message));
  
  if (isQuestion) {
    return {
      intent: 'faq',
      confidence: 0.75,
      sentiment: 'neutral'
    };
  }

  return null;
}



