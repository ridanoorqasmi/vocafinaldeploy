// ===== PROMPT BUILDER - DYNAMIC PROMPT CONSTRUCTION =====

import { QueryIntent } from './query-types';

export interface BusinessContext {
  id: string;
  name: string;
  type: string;
  category?: string;
  description: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  timezone?: string;
  operatingHours?: string;
  isOpen?: boolean;
  policies?: string[];
  services?: string[];
  products?: string[];
  specialOffers?: string[];
  customInstructions?: string;
}

export interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: QueryIntent;
}

export interface PromptContext {
  business: BusinessContext;
  conversationHistory: ConversationHistory[];
  currentQuery: string;
  detectedIntent: QueryIntent;
  relevantContext: string[];
  customerPreferences?: string[];
  sessionMetadata?: Record<string, any>;
}

export interface PromptTemplate {
  systemMessage: string;
  businessContext: string;
  conversationHistory: string;
  currentQuery: string;
  responseGuidelines: string;
  constraints: string;
}

export interface ResponseGuidelines {
  tone: 'professional' | 'friendly' | 'casual' | 'formal';
  length: 'brief' | 'moderate' | 'detailed';
  style: 'conversational' | 'informative' | 'persuasive';
  includeSuggestions: boolean;
  maxLength: number;
  brandVoice?: string;
}

export class PromptBuilder {
  private systemMessageTemplates: Record<string, string>;
  private industryTemplates: Record<string, string>;
  private responseGuidelines: ResponseGuidelines;

  constructor() {
    this.systemMessageTemplates = this.initializeSystemTemplates();
    this.industryTemplates = this.initializeIndustryTemplates();
    this.responseGuidelines = {
      tone: 'professional',
      length: 'moderate',
      style: 'conversational',
      includeSuggestions: true,
      maxLength: 500
    };
  }

  /**
   * Build complete prompt for GPT-4o
   */
  buildPrompt(context: PromptContext): PromptTemplate {
    const systemMessage = this.buildSystemMessage(context);
    const businessContext = this.buildBusinessContext(context.business);
    const conversationHistory = this.buildConversationHistory(context.conversationHistory);
    const currentQuery = this.buildCurrentQuery(context.currentQuery, context.detectedIntent);
    const responseGuidelines = this.buildResponseGuidelines(context);
    const constraints = this.buildConstraints(context);

    return {
      systemMessage,
      businessContext,
      conversationHistory,
      currentQuery,
      responseGuidelines,
      constraints
    };
  }

  /**
   * Build system message based on business type and context
   */
  private buildSystemMessage(context: PromptContext): string {
    const business = context.business;
    
    // Use custom instructions if provided
    if (business.customInstructions) {
      return business.customInstructions;
    }

    // Get industry-specific template
    const industryTemplate = this.industryTemplates[business.type.toLowerCase()] || 
                           this.industryTemplates['default'];

    // Replace placeholders
    return industryTemplate
      .replace(/{business_name}/g, business.name)
      .replace(/{business_type}/g, business.type)
      .replace(/{business_category}/g, business.category || business.type)
      .replace(/{business_description}/g, business.description)
      .replace(/{service_type}/g, business.services?.[0] || 'services');
  }

  /**
   * Build business context section
   */
  private buildBusinessContext(business: BusinessContext): string {
    let context = `Business Information:\n`;
    context += `- Name: ${business.name}\n`;
    context += `- Type: ${business.type}\n`;
    context += `- Description: ${business.description}\n`;

    if (business.phone) {
      context += `- Phone: ${business.phone}\n`;
    }

    if (business.website) {
      context += `- Website: ${business.website}\n`;
    }

    if (business.address) {
      context += `- Address: ${business.address}`;
      if (business.city) context += `, ${business.city}`;
      if (business.state) context += `, ${business.state}`;
      if (business.zipCode) context += ` ${business.zipCode}`;
      context += `\n`;
    }

    if (business.operatingHours) {
      context += `- Hours: ${business.operatingHours}\n`;
      context += `- Status: ${business.isOpen ? 'Currently Open' : 'Currently Closed'}\n`;
    }

    if (business.services && business.services.length > 0) {
      context += `- Services: ${business.services.join(', ')}\n`;
    }

    if (business.products && business.products.length > 0) {
      context += `- Products: ${business.products.join(', ')}\n`;
    }

    if (business.specialOffers && business.specialOffers.length > 0) {
      context += `- Special Offers: ${business.specialOffers.join(', ')}\n`;
    }

    if (business.policies && business.policies.length > 0) {
      context += `- Policies: ${business.policies.join(', ')}\n`;
    }

    return context;
  }

  /**
   * Build conversation history section
   */
  private buildConversationHistory(history: ConversationHistory[]): string {
    if (history.length === 0) {
      return 'Conversation History: This is the start of the conversation.';
    }

    // Limit to last 5 exchanges to manage token usage
    const recentHistory = history.slice(-10);
    
    let historyText = 'Conversation History:\n';
    recentHistory.forEach((message, index) => {
      const role = message.role === 'user' ? 'Customer' : 'Assistant';
      const intent = message.intent ? ` (Intent: ${message.intent})` : '';
      historyText += `${index + 1}. ${role}${intent}: ${message.content}\n`;
    });

    return historyText;
  }

  /**
   * Build current query section with intent context
   */
  private buildCurrentQuery(query: string, intent: QueryIntent): string {
    const intentContext = this.getIntentContext(intent);
    
    return `Current Customer Query: "${query}"\nIntent: ${intent} - ${intentContext}`;
  }

  /**
   * Build response guidelines
   */
  private buildResponseGuidelines(context: PromptContext): string {
    const business = context.business;
    const guidelines = this.responseGuidelines;

    let guidelinesText = 'Response Guidelines:\n';
    guidelinesText += `- Tone: ${guidelines.tone}\n`;
    guidelinesText += `- Length: ${guidelines.length}\n`;
    guidelinesText += `- Style: ${guidelines.style}\n`;
    guidelinesText += `- Maximum length: ${guidelines.maxLength} characters\n`;

    if (guidelines.brandVoice) {
      guidelinesText += `- Brand voice: ${guidelines.brandVoice}\n`;
    }

    if (guidelines.includeSuggestions) {
      guidelinesText += `- Include helpful follow-up suggestions\n`;
    }

    // Add business-specific guidelines
    if (business.customInstructions) {
      guidelinesText += `- Follow business-specific instructions\n`;
    }

    return guidelinesText;
  }

  /**
   * Build constraints and limitations
   */
  private buildConstraints(context: PromptContext): string {
    const business = context.business;
    
    let constraints = 'Constraints and Limitations:\n';
    constraints += '- Only provide information about this specific business\n';
    constraints += '- Do not make up information not provided in the context\n';
    constraints += '- If you don\'t know something, say so and suggest contacting the business directly\n';
    constraints += '- Maintain a professional and helpful tone\n';
    constraints += '- Do not provide medical, legal, or financial advice\n';
    constraints += '- Do not discuss competitors unless specifically asked\n';

    // Add business-specific constraints
    if (business.policies && business.policies.length > 0) {
      constraints += '- Follow all business policies and procedures\n';
    }

    return constraints;
  }

  /**
   * Get intent-specific context
   */
  private getIntentContext(intent: QueryIntent): string {
    const intentContexts: Record<QueryIntent, string> = {
      'MENU_INQUIRY': 'Customer is asking about menu items, food options, or products',
      'HOURS_POLICY': 'Customer is asking about operating hours, policies, or procedures',
      'PRICING_QUESTION': 'Customer is asking about prices, costs, or payment information',
      'DIETARY_RESTRICTIONS': 'Customer has dietary restrictions or special dietary needs',
      'LOCATION_INFO': 'Customer is asking about location, directions, or delivery areas',
      'GENERAL_CHAT': 'Customer is making small talk or general conversation',
      'COMPLAINT_FEEDBACK': 'Customer has a complaint or is providing feedback',
      'UNKNOWN': 'Customer query intent is unclear or ambiguous'
    };

    return intentContexts[intent] || 'Unknown intent';
  }

  /**
   * Initialize system message templates
   */
  private initializeSystemTemplates(): Record<string, string> {
    return {
      default: `You are a helpful AI assistant for {business_name}, a {business_type} business. 
You help customers with information about {business_description}.
Always be professional, helpful, and accurate. Provide specific information when available,
and suggest contacting the business directly when you don't have the information.`,

      custom: `{custom_system_message}`
    };
  }

  /**
   * Initialize industry-specific templates
   */
  private initializeIndustryTemplates(): Record<string, string> {
    return {
      default: this.systemMessageTemplates.default,

      restaurant: `You are a helpful AI assistant for {business_name}, a {business_category} restaurant.
Help customers with menu information, dietary options, reservations, and general questions.
Always be friendly and food-focused. If asked about specific ingredients or allergens,
recommend contacting the restaurant directly for the most accurate information.`,

      retail: `You are a customer service AI for {business_name}, a {business_category} store.
Help customers find products, check availability, compare options, and provide store information.
Be helpful and product-focused. For specific product details or availability,
suggest calling the store or checking the website.`,

      service: `You are an AI assistant for {business_name}, providing {service_type} services.
Help customers understand services, pricing, booking procedures, and policies.
Be professional and service-oriented. For detailed service information or bookings,
recommend contacting the business directly.`,

      healthcare: `You are a helpful AI assistant for {business_name}, a {business_category} healthcare provider.
Help with general information about services, hours, and policies.
IMPORTANT: Do not provide medical advice, diagnosis, or treatment recommendations.
Always recommend consulting with healthcare professionals for medical concerns.`,

      automotive: `You are a customer service AI for {business_name}, an automotive {business_category}.
Help customers with service information, appointments, and general questions.
Be knowledgeable about automotive services. For specific technical issues or repairs,
recommend scheduling an appointment with qualified technicians.`,

      beauty: `You are a helpful AI assistant for {business_name}, a {business_category} beauty business.
Help customers with service information, appointments, and product recommendations.
Be friendly and beauty-focused. For specific treatments or skin concerns,
recommend scheduling a consultation with qualified professionals.`,

      fitness: `You are an AI assistant for {business_name}, a {business_category} fitness facility.
Help customers with membership information, class schedules, and general questions.
Be motivational and fitness-focused. For specific fitness goals or health concerns,
recommend consulting with fitness professionals or healthcare providers.`,

      education: `You are a helpful AI assistant for {business_name}, an educational {business_category}.
Help students and parents with program information, schedules, and policies.
Be supportive and education-focused. For specific academic concerns or enrollment,
recommend contacting the appropriate department or staff member.`
    };
  }

  /**
   * Update response guidelines
   */
  updateResponseGuidelines(guidelines: Partial<ResponseGuidelines>): void {
    this.responseGuidelines = { ...this.responseGuidelines, ...guidelines };
  }

  /**
   * Add custom industry template
   */
  addIndustryTemplate(industry: string, template: string): void {
    this.industryTemplates[industry.toLowerCase()] = template;
  }

  /**
   * Estimate token count for prompt
   */
  estimateTokenCount(prompt: PromptTemplate): number {
    const fullPrompt = Object.values(prompt).join('\n\n');
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(fullPrompt.length / 4);
  }

  /**
   * Validate prompt before sending to LLM
   */
  validatePrompt(prompt: PromptTemplate): {
    isValid: boolean;
    issues: string[];
    estimatedTokens: number;
  } {
    const issues: string[] = [];
    const estimatedTokens = this.estimateTokenCount(prompt);

    // Check for required sections
    if (!prompt.systemMessage || prompt.systemMessage.trim().length === 0) {
      issues.push('Missing system message');
    }

    if (!prompt.businessContext || prompt.businessContext.trim().length === 0) {
      issues.push('Missing business context');
    }

    if (!prompt.currentQuery || prompt.currentQuery.trim().length === 0) {
      issues.push('Missing current query');
    }

    // Check token limits
    if (estimatedTokens > 8000) {
      issues.push(`Prompt too long: ${estimatedTokens} tokens (max: 8000)`);
    }

    // Check for placeholder replacement
    if (prompt.systemMessage.includes('{') && prompt.systemMessage.includes('}')) {
      issues.push('Unreplaced placeholders in system message');
    }

    return {
      isValid: issues.length === 0,
      issues,
      estimatedTokens
    };
  }
}

// ===== SINGLETON INSTANCE =====
let promptBuilderInstance: PromptBuilder | null = null;

export function getPromptBuilder(): PromptBuilder {
  if (!promptBuilderInstance) {
    promptBuilderInstance = new PromptBuilder();
  }
  return promptBuilderInstance;
}
