// ===== RESPONSE PROCESSOR - QUALITY ASSURANCE & PROCESSING =====

import { QueryIntent } from './query-types';

export interface ResponseValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
}

export interface BusinessInformation {
  name: string;
  phone?: string;
  website?: string;
  address?: string;
  hours?: string;
  policies?: string[];
}

export interface ProcessedResponse {
  text: string;
  confidence: number;
  sources: string[];
  suggestions: string[];
  businessInfoExtracted: BusinessInformation;
  processingTimeMs: number;
  validationResult: ResponseValidationResult;
}

export interface ContentFilter {
  inappropriateContent: boolean;
  competitorMention: boolean;
  medicalAdvice: boolean;
  legalAdvice: boolean;
  financialAdvice: boolean;
  personalInformation: boolean;
}

export class ResponseProcessor {
  private inappropriateWords: string[];
  private competitorKeywords: string[];
  private medicalKeywords: string[];
  private legalKeywords: string[];
  private financialKeywords: string[];

  constructor() {
    this.inappropriateWords = [
      'hate', 'stupid', 'idiot', 'kill', 'die', 'murder', 'suicide',
      'bomb', 'terrorist', 'racist', 'sexist', 'homophobic'
    ];

    this.competitorKeywords = [
      'competitor', 'rival', 'alternative', 'better than', 'cheaper than',
      'instead of', 'rather than'
    ];

    this.medicalKeywords = [
      'diagnosis', 'treatment', 'medicine', 'prescription', 'symptoms',
      'medical advice', 'doctor', 'physician', 'therapy', 'cure'
    ];

    this.legalKeywords = [
      'legal advice', 'lawyer', 'attorney', 'lawsuit', 'legal action',
      'contract', 'liability', 'legal rights', 'court'
    ];

    this.financialKeywords = [
      'investment advice', 'financial advice', 'stock', 'investment',
      'financial planning', 'tax advice', 'accounting advice'
    ];
  }

  /**
   * Process and validate GPT-4o response
   */
  async processResponse(
    rawResponse: string,
    context: {
      businessName: string;
      businessType: string;
      intent: QueryIntent;
      conversationHistory: any[];
      relevantContext: string[];
    }
  ): Promise<ProcessedResponse> {
    const startTime = Date.now();

    // Step 1: Basic cleaning and formatting
    const cleanedResponse = this.cleanResponse(rawResponse);

    // Step 2: Content filtering
    const contentFilter = this.filterContent(cleanedResponse);

    // Step 3: Business relevance validation
    const relevanceCheck = this.validateBusinessRelevance(cleanedResponse, context);

    // Step 4: Extract business information
    const businessInfo = this.extractBusinessInformation(cleanedResponse, context);

    // Step 5: Generate follow-up suggestions
    const suggestions = this.generateSuggestions(context.intent, context.businessType);

    // Step 6: Calculate confidence score
    const confidence = this.calculateConfidence(
      cleanedResponse,
      contentFilter,
      relevanceCheck,
      context
    );

    // Step 7: Validate response quality
    const validationResult = this.validateResponseQuality(
      cleanedResponse,
      contentFilter,
      relevanceCheck,
      confidence
    );

    const processingTime = Date.now() - startTime;

    return {
      text: cleanedResponse,
      confidence,
      sources: context.relevantContext,
      suggestions,
      businessInfoExtracted: businessInfo,
      processingTimeMs: processingTime,
      validationResult
    };
  }

  /**
   * Clean and format response text
   */
  private cleanResponse(response: string): string {
    // Remove extra whitespace
    let cleaned = response.trim();

    // Fix common formatting issues
    cleaned = cleaned.replace(/\s+/g, ' '); // Multiple spaces to single space
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n'); // Multiple newlines to double newline
    cleaned = cleaned.replace(/\.\s*\./g, '.'); // Multiple periods to single period

    // Ensure proper sentence structure
    if (cleaned && !cleaned.endsWith('.') && !cleaned.endsWith('!') && !cleaned.endsWith('?')) {
      cleaned += '.';
    }

    // Capitalize first letter
    if (cleaned && cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  }

  /**
   * Filter inappropriate or problematic content
   */
  private filterContent(response: string): ContentFilter {
    const lowerResponse = response.toLowerCase();

    return {
      inappropriateContent: this.inappropriateWords.some(word => 
        lowerResponse.includes(word)
      ),
      competitorMention: this.competitorKeywords.some(keyword => 
        lowerResponse.includes(keyword)
      ),
      medicalAdvice: this.medicalKeywords.some(keyword => 
        lowerResponse.includes(keyword)
      ),
      legalAdvice: this.legalKeywords.some(keyword => 
        lowerResponse.includes(keyword)
      ),
      financialAdvice: this.financialKeywords.some(keyword => 
        lowerResponse.includes(keyword)
      ),
      personalInformation: this.containsPersonalInformation(response)
    };
  }

  /**
   * Check for personal information disclosure
   */
  private containsPersonalInformation(response: string): boolean {
    // Check for phone numbers, emails, addresses, etc.
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const ssnRegex = /\b\d{3}-?\d{2}-?\d{4}\b/;

    return phoneRegex.test(response) || 
           emailRegex.test(response) || 
           ssnRegex.test(response);
  }

  /**
   * Validate business relevance
   */
  private validateBusinessRelevance(
    response: string,
    context: { businessName: string; businessType: string; intent: QueryIntent }
  ): {
    isRelevant: boolean;
    relevanceScore: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let relevanceScore = 1.0;

    // Check if response mentions the business
    if (!response.toLowerCase().includes(context.businessName.toLowerCase())) {
      // This might not always be an issue, but worth noting
      relevanceScore *= 0.8;
    }

    // Check if response is appropriate for the business type
    const businessTypeRelevance = this.checkBusinessTypeRelevance(
      response,
      context.businessType,
      context.intent
    );

    if (businessTypeRelevance < 0.5) {
      issues.push('Response not relevant to business type');
      relevanceScore *= 0.6;
    }

    // Check if response addresses the detected intent
    const intentRelevance = this.checkIntentRelevance(response, context.intent);
    if (intentRelevance < 0.5) {
      issues.push('Response does not address customer intent');
      relevanceScore *= 0.7;
    }

    return {
      isRelevant: relevanceScore > 0.6,
      relevanceScore,
      issues
    };
  }

  /**
   * Check business type relevance
   */
  private checkBusinessTypeRelevance(
    response: string,
    businessType: string,
    intent: QueryIntent
  ): number {
    const lowerResponse = response.toLowerCase();
    const lowerBusinessType = businessType.toLowerCase();

    // Define relevance keywords for different business types
    const businessTypeKeywords: Record<string, string[]> = {
      restaurant: ['food', 'menu', 'dining', 'eat', 'meal', 'dish', 'ingredient', 'allergy'],
      retail: ['product', 'item', 'buy', 'purchase', 'price', 'sale', 'discount', 'inventory'],
      service: ['service', 'appointment', 'booking', 'schedule', 'consultation', 'professional'],
      healthcare: ['health', 'medical', 'doctor', 'patient', 'treatment', 'care', 'wellness'],
      automotive: ['car', 'vehicle', 'repair', 'service', 'maintenance', 'auto', 'mechanic'],
      beauty: ['beauty', 'spa', 'treatment', 'appointment', 'service', 'skincare', 'hair'],
      fitness: ['fitness', 'gym', 'workout', 'exercise', 'training', 'membership', 'class'],
      education: ['education', 'learning', 'course', 'class', 'student', 'academic', 'program']
    };

    const keywords = businessTypeKeywords[lowerBusinessType] || [];
    const keywordMatches = keywords.filter(keyword => lowerResponse.includes(keyword)).length;
    
    return Math.min(1, keywordMatches / Math.max(1, keywords.length));
  }

  /**
   * Check intent relevance
   */
  private checkIntentRelevance(response: string, intent: QueryIntent): number {
    const lowerResponse = response.toLowerCase();

    const intentKeywords: Record<QueryIntent, string[]> = {
      'MENU_INQUIRY': ['menu', 'food', 'dish', 'item', 'option', 'available', 'serve'],
      'HOURS_POLICY': ['hour', 'open', 'close', 'time', 'policy', 'rule', 'procedure'],
      'PRICING_QUESTION': ['price', 'cost', 'fee', 'charge', 'expensive', 'cheap', 'dollar'],
      'DIETARY_RESTRICTIONS': ['dietary', 'allergy', 'vegetarian', 'vegan', 'gluten', 'ingredient'],
      'LOCATION_INFO': ['location', 'address', 'where', 'directions', 'near', 'area'],
      'GENERAL_CHAT': ['hello', 'hi', 'thank', 'help', 'assist', 'welcome'],
      'COMPLAINT_FEEDBACK': ['complaint', 'issue', 'problem', 'concern', 'feedback', 'unhappy'],
      'UNKNOWN': []
    };

    const keywords = intentKeywords[intent] || [];
    if (keywords.length === 0) return 0.5; // Neutral for unknown intent

    const keywordMatches = keywords.filter(keyword => lowerResponse.includes(keyword)).length;
    return Math.min(1, keywordMatches / Math.max(1, keywords.length));
  }

  /**
   * Extract business information from response
   */
  private extractBusinessInformation(
    response: string,
    context: { businessName: string }
  ): BusinessInformation {
    const businessInfo: BusinessInformation = {
      name: context.businessName
    };

    // Extract phone number
    const phoneMatch = response.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    if (phoneMatch) {
      businessInfo.phone = phoneMatch[0];
    }

    // Extract website
    const websiteMatch = response.match(/https?:\/\/[^\s]+/);
    if (websiteMatch) {
      businessInfo.website = websiteMatch[0];
    }

    // Extract address (basic pattern)
    const addressMatch = response.match(/\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)/i);
    if (addressMatch) {
      businessInfo.address = addressMatch[0];
    }

    // Extract hours
    const hoursMatch = response.match(/(?:hours?|open|close)[:\s]+([^.!?]+)/i);
    if (hoursMatch) {
      businessInfo.hours = hoursMatch[1].trim();
    }

    return businessInfo;
  }

  /**
   * Generate follow-up suggestions
   */
  private generateSuggestions(intent: QueryIntent, businessType: string): string[] {
    const suggestions: Record<QueryIntent, string[]> = {
      'MENU_INQUIRY': [
        'What are your most popular items?',
        'Do you have any specials today?',
        'What ingredients do you use?',
        'Do you have vegetarian options?'
      ],
      'HOURS_POLICY': [
        'What are your busiest times?',
        'Do you have holiday hours?',
        'What is your cancellation policy?',
        'Do you take reservations?'
      ],
      'PRICING_QUESTION': [
        'Do you offer any discounts?',
        'What payment methods do you accept?',
        'Do you have package deals?',
        'Are there any additional fees?'
      ],
      'DIETARY_RESTRICTIONS': [
        'What other dietary options do you have?',
        'Can you accommodate other allergies?',
        'Do you have a nutrition guide?',
        'Are your ingredients locally sourced?'
      ],
      'LOCATION_INFO': [
        'Do you offer delivery?',
        'What is your delivery area?',
        'Is parking available?',
        'Are you accessible by public transit?'
      ],
      'GENERAL_CHAT': [
        'What makes you different from competitors?',
        'How long have you been in business?',
        'What do customers love most about you?',
        'Do you have any upcoming events?'
      ],
      'COMPLAINT_FEEDBACK': [
        'How can we make this right?',
        'Would you like to speak with a manager?',
        'Can we offer you a discount?',
        'What would you like us to improve?'
      ],
      'UNKNOWN': [
        'How can I help you today?',
        'What would you like to know?',
        'Is there anything specific you need?',
        'Would you like to speak with someone?'
      ]
    };

    return suggestions[intent] || suggestions['UNKNOWN'];
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    response: string,
    contentFilter: ContentFilter,
    relevanceCheck: any,
    context: any
  ): number {
    let confidence = 1.0;

    // Reduce confidence for content issues
    if (contentFilter.inappropriateContent) confidence = 0;
    if (contentFilter.medicalAdvice) confidence *= 0.3;
    if (contentFilter.legalAdvice) confidence *= 0.3;
    if (contentFilter.financialAdvice) confidence *= 0.3;
    if (contentFilter.competitorMention) confidence *= 0.7;
    if (contentFilter.personalInformation) confidence *= 0.5;

    // Apply relevance score
    confidence *= relevanceCheck.relevanceScore;

    // Check response length appropriateness
    if (response.length < 20) confidence *= 0.6;
    if (response.length > 1000) confidence *= 0.8;

    // Check for business name mention
    if (!response.toLowerCase().includes(context.businessName.toLowerCase())) {
      confidence *= 0.9;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Validate overall response quality
   */
  private validateResponseQuality(
    response: string,
    contentFilter: ContentFilter,
    relevanceCheck: any,
    confidence: number
  ): ResponseValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for content issues
    if (contentFilter.inappropriateContent) {
      issues.push('Contains inappropriate content');
    }

    if (contentFilter.medicalAdvice) {
      issues.push('Contains medical advice');
      suggestions.push('Avoid providing medical advice');
    }

    if (contentFilter.legalAdvice) {
      issues.push('Contains legal advice');
      suggestions.push('Avoid providing legal advice');
    }

    if (contentFilter.financialAdvice) {
      issues.push('Contains financial advice');
      suggestions.push('Avoid providing financial advice');
    }

    if (contentFilter.competitorMention) {
      issues.push('Mentions competitors');
      suggestions.push('Focus on your own business');
    }

    if (contentFilter.personalInformation) {
      issues.push('Contains personal information');
      suggestions.push('Avoid sharing personal information');
    }

    // Check relevance issues
    if (!relevanceCheck.isRelevant) {
      issues.push('Response not relevant to business');
      suggestions.push('Focus on business-specific information');
    }

    // Check confidence level
    if (confidence < 0.5) {
      issues.push('Low confidence response');
      suggestions.push('Consider regenerating response');
    }

    // Check response length
    if (response.length < 20) {
      issues.push('Response too short');
      suggestions.push('Provide more detailed information');
    }

    if (response.length > 1000) {
      issues.push('Response too long');
      suggestions.push('Keep response concise');
    }

    return {
      isValid: issues.length === 0,
      confidence,
      issues,
      suggestions
    };
  }

  /**
   * Format business information consistently
   */
  formatBusinessInformation(info: BusinessInformation): string {
    let formatted = '';

    if (info.name) {
      formatted += `**${info.name}**\n\n`;
    }

    if (info.phone) {
      formatted += `📞 Phone: ${info.phone}\n`;
    }

    if (info.website) {
      formatted += `🌐 Website: ${info.website}\n`;
    }

    if (info.address) {
      formatted += `📍 Address: ${info.address}\n`;
    }

    if (info.hours) {
      formatted += `🕒 Hours: ${info.hours}\n`;
    }

    if (info.policies && info.policies.length > 0) {
      formatted += `📋 Policies: ${info.policies.join(', ')}\n`;
    }

    return formatted.trim();
  }

  /**
   * Apply brand voice adjustments
   */
  applyBrandVoice(response: string, brandVoice: string): string {
    // This would implement brand voice adjustments based on business preferences
    // For now, return the response as-is
    return response;
  }
}

// ===== SINGLETON INSTANCE =====
let responseProcessorInstance: ResponseProcessor | null = null;

export function getResponseProcessor(): ResponseProcessor {
  if (!responseProcessorInstance) {
    responseProcessorInstance = new ResponseProcessor();
  }
  return responseProcessorInstance;
}
