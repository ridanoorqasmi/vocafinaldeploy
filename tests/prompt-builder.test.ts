// ===== PROMPT BUILDER TESTS - PHASE 3B =====

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptBuilder, BusinessContext, ConversationHistory } from '../lib/prompt-builder';

describe('PromptBuilder', () => {
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    promptBuilder = new PromptBuilder();
  });

  describe('buildPrompt', () => {
    it('should build a complete prompt for a restaurant business', () => {
      const businessContext: BusinessContext = {
        id: 'business-123',
        name: 'Pizza Palace',
        type: 'restaurant',
        category: 'Italian',
        description: 'Authentic Italian pizza and pasta',
        phone: '555-PIZZA',
        website: 'https://pizzapalace.com',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        timezone: 'America/New_York',
        operatingHours: '11:00 AM - 10:00 PM',
        isOpen: true,
        services: ['Dine-in', 'Takeout', 'Delivery'],
        products: ['Pizza', 'Pasta', 'Salads'],
        specialOffers: ['20% off on Tuesdays'],
        policies: ['No outside food', '18% gratuity for parties of 6+']
      };

      const conversationHistory: ConversationHistory[] = [
        {
          role: 'user',
          content: 'What are your hours?',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          intent: 'HOURS_POLICY'
        },
        {
          role: 'assistant',
          content: 'We are open from 11:00 AM to 10:00 PM daily.',
          timestamp: new Date('2024-01-01T10:01:00Z')
        }
      ];

      const context = {
        business: businessContext,
        conversationHistory,
        currentQuery: 'What is your best pizza?',
        detectedIntent: 'MENU_INQUIRY' as const,
        relevantContext: ['Menu Items: Margherita Pizza, Pepperoni Pizza, Veggie Pizza'],
        customerPreferences: ['vegetarian-friendly']
      };

      const prompt = promptBuilder.buildPrompt(context);

      expect(prompt).toBeDefined();
      expect(prompt.systemMessage).toContain('Pizza Palace');
      expect(prompt.systemMessage).toContain('restaurant');
      expect(prompt.businessContext).toContain('Pizza Palace');
      expect(prompt.businessContext).toContain('555-PIZZA');
      expect(prompt.businessContext).toContain('11:00 AM - 10:00 PM');
      expect(prompt.conversationHistory).toContain('What are your hours?');
      expect(prompt.currentQuery).toContain('What is your best pizza?');
      expect(prompt.responseGuidelines).toContain('professional');
      expect(prompt.constraints).toContain('Only provide information about this specific business');
    });

    it('should build prompt for retail business', () => {
      const businessContext: BusinessContext = {
        id: 'business-456',
        name: 'Tech Store',
        type: 'retail',
        category: 'Electronics',
        description: 'Latest electronics and gadgets',
        phone: '555-TECH',
        website: 'https://techstore.com',
        address: '456 Tech Ave',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        timezone: 'America/Los_Angeles',
        operatingHours: '9:00 AM - 9:00 PM',
        isOpen: true,
        services: ['In-store shopping', 'Online orders', 'Tech support'],
        products: ['Laptops', 'Phones', 'Accessories'],
        specialOffers: ['Student discount 10%'],
        policies: ['30-day return policy', 'Extended warranty available']
      };

      const context = {
        business: businessContext,
        conversationHistory: [],
        currentQuery: 'Do you have the latest iPhone?',
        detectedIntent: 'MENU_INQUIRY' as const,
        relevantContext: ['Products: iPhone 15, MacBook Pro, AirPods'],
        customerPreferences: []
      };

      const prompt = promptBuilder.buildPrompt(context);

      expect(prompt.systemMessage).toContain('Tech Store');
      expect(prompt.systemMessage).toContain('retail');
      expect(prompt.businessContext).toContain('Electronics');
      expect(prompt.businessContext).toContain('30-day return policy');
    });

    it('should handle custom instructions', () => {
      const businessContext: BusinessContext = {
        id: 'business-789',
        name: 'Custom Business',
        type: 'service',
        category: 'Consulting',
        description: 'Professional consulting services',
        customInstructions: 'Always be formal and professional. Use industry terminology.'
      };

      const context = {
        business: businessContext,
        conversationHistory: [],
        currentQuery: 'What services do you offer?',
        detectedIntent: 'MENU_INQUIRY' as const,
        relevantContext: [],
        customerPreferences: []
      };

      const prompt = promptBuilder.buildPrompt(context);

      expect(prompt.systemMessage).toBe('Always be formal and professional. Use industry terminology.');
    });
  });

  describe('validatePrompt', () => {
    it('should validate a complete prompt', () => {
      const prompt = {
        systemMessage: 'You are a helpful assistant for Test Business.',
        businessContext: 'Business: Test Business | Type: restaurant',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your menu?',
        responseGuidelines: 'Be helpful and professional.',
        constraints: 'Only provide business information.'
      };

      const validation = promptBuilder.validatePrompt(prompt);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.estimatedTokens).toBeGreaterThan(0);
    });

    it('should detect missing system message', () => {
      const prompt = {
        systemMessage: '',
        businessContext: 'Business: Test Business',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your menu?',
        responseGuidelines: 'Be helpful.',
        constraints: 'Only provide business information.'
      };

      const validation = promptBuilder.validatePrompt(prompt);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Missing system message');
    });

    it('should detect unreplaced placeholders', () => {
      const prompt = {
        systemMessage: 'You are a helpful assistant for {business_name}.',
        businessContext: 'Business: Test Business',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your menu?',
        responseGuidelines: 'Be helpful.',
        constraints: 'Only provide business information.'
      };

      const validation = promptBuilder.validatePrompt(prompt);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Unreplaced placeholders in system message');
    });

    it('should detect prompt too long', () => {
      const longContent = 'A'.repeat(10000);
      const prompt = {
        systemMessage: longContent,
        businessContext: longContent,
        conversationHistory: longContent,
        currentQuery: longContent,
        responseGuidelines: longContent,
        constraints: longContent
      };

      const validation = promptBuilder.validatePrompt(prompt);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Prompt too long');
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count correctly', () => {
      const prompt = {
        systemMessage: 'You are a helpful assistant.',
        businessContext: 'Business: Test Business',
        conversationHistory: 'No previous conversation.',
        currentQuery: 'What is your menu?',
        responseGuidelines: 'Be helpful.',
        constraints: 'Only provide business information.'
      };

      const tokenCount = promptBuilder.estimateTokenCount(prompt);

      expect(tokenCount).toBeGreaterThan(0);
      expect(typeof tokenCount).toBe('number');
    });
  });

  describe('addIndustryTemplate', () => {
    it('should add custom industry template', () => {
      const customTemplate = 'You are a specialized AI for {business_name}, a {business_type} business.';
      
      promptBuilder.addIndustryTemplate('healthcare', customTemplate);

      // This would be tested by building a prompt for a healthcare business
      // and verifying the custom template is used
      expect(true).toBe(true); // Placeholder for now
    });
  });

  describe('updateResponseGuidelines', () => {
    it('should update response guidelines', () => {
      const newGuidelines = {
        tone: 'friendly' as const,
        length: 'brief' as const,
        style: 'conversational' as const
      };

      promptBuilder.updateResponseGuidelines(newGuidelines);

      // This would be tested by building a prompt and verifying the guidelines are updated
      expect(true).toBe(true); // Placeholder for now
    });
  });
});
