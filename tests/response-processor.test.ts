// ===== RESPONSE PROCESSOR TESTS - PHASE 3B =====

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponseProcessor } from '../lib/response-processor';

describe('ResponseProcessor', () => {
  let responseProcessor: ResponseProcessor;

  beforeEach(() => {
    responseProcessor = new ResponseProcessor();
  });

  describe('processResponse', () => {
    it('should process a valid response successfully', async () => {
      const rawResponse = 'Welcome to Pizza Palace! We have delicious Italian pizza and pasta. Our hours are 11 AM to 10 PM daily.';
      
      const context = {
        businessName: 'Pizza Palace',
        businessType: 'restaurant',
        intent: 'MENU_INQUIRY' as const,
        conversationHistory: [],
        relevantContext: ['Menu Items: Margherita Pizza, Pepperoni Pizza']
      };

      const result = await responseProcessor.processResponse(rawResponse, context);

      expect(result).toBeDefined();
      expect(result.text).toBe(rawResponse);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.sources).toEqual(['Menu Items: Margherita Pizza, Pepperoni Pizza']);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.businessInfoExtracted.name).toBe('Pizza Palace');
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.validationResult.isValid).toBe(true);
    });

    it('should detect inappropriate content', async () => {
      const inappropriateResponse = 'This is a hateful response about your business.';
      
      const context = {
        businessName: 'Test Business',
        businessType: 'restaurant',
        intent: 'GENERAL_CHAT' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(inappropriateResponse, context);

      expect(result.validationResult.isValid).toBe(false);
      expect(result.validationResult.issues).toContain('Contains inappropriate content');
      expect(result.confidence).toBe(0);
    });

    it('should detect medical advice', async () => {
      const medicalResponse = 'You should take this medicine for your symptoms.';
      
      const context = {
        businessName: 'Test Business',
        businessType: 'restaurant',
        intent: 'GENERAL_CHAT' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(medicalResponse, context);

      expect(result.validationResult.issues).toContain('Contains medical advice');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should detect legal advice', async () => {
      const legalResponse = 'You should consult a lawyer about your legal rights.';
      
      const context = {
        businessName: 'Test Business',
        businessType: 'restaurant',
        intent: 'GENERAL_CHAT' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(legalResponse, context);

      expect(result.validationResult.issues).toContain('Contains legal advice');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should detect financial advice', async () => {
      const financialResponse = 'You should invest in this stock for better returns.';
      
      const context = {
        businessName: 'Test Business',
        businessType: 'restaurant',
        intent: 'GENERAL_CHAT' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(financialResponse, context);

      expect(result.validationResult.issues).toContain('Contains financial advice');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should detect competitor mentions', async () => {
      const competitorResponse = 'We are better than our competitor McDonald\'s.';
      
      const context = {
        businessName: 'Pizza Palace',
        businessType: 'restaurant',
        intent: 'GENERAL_CHAT' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(competitorResponse, context);

      expect(result.validationResult.issues).toContain('Mentions competitors');
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should detect personal information', async () => {
      const personalInfoResponse = 'Call us at 555-123-4567 or email john@example.com.';
      
      const context = {
        businessName: 'Test Business',
        businessType: 'restaurant',
        intent: 'LOCATION_INFO' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(personalInfoResponse, context);

      expect(result.validationResult.issues).toContain('Contains personal information');
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should extract business information correctly', async () => {
      const responseWithInfo = 'Welcome to Pizza Palace! Call us at 555-PIZZA or visit https://pizzapalace.com. We are located at 123 Main St, New York, NY 10001. Our hours are 11:00 AM to 10:00 PM.';
      
      const context = {
        businessName: 'Pizza Palace',
        businessType: 'restaurant',
        intent: 'LOCATION_INFO' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(responseWithInfo, context);

      expect(result.businessInfoExtracted.name).toBe('Pizza Palace');
      expect(result.businessInfoExtracted.phone).toBe('555-PIZZA');
      expect(result.businessInfoExtracted.website).toBe('https://pizzapalace.com');
      expect(result.businessInfoExtracted.address).toContain('123 Main St');
      expect(result.businessInfoExtracted.hours).toContain('11:00 AM to 10:00 PM');
    });

    it('should generate appropriate suggestions for different intents', async () => {
      const menuResponse = 'We have delicious pizza and pasta options.';
      
      const context = {
        businessName: 'Pizza Palace',
        businessType: 'restaurant',
        intent: 'MENU_INQUIRY' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(menuResponse, context);

      expect(result.suggestions).toContain('What are your most popular items?');
      expect(result.suggestions).toContain('Do you have any specials today?');
    });

    it('should handle empty response', async () => {
      const emptyResponse = '';
      
      const context = {
        businessName: 'Test Business',
        businessType: 'restaurant',
        intent: 'GENERAL_CHAT' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(emptyResponse, context);

      expect(result.validationResult.isValid).toBe(false);
      expect(result.validationResult.issues).toContain('Response too short');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle very long response', async () => {
      const longResponse = 'A'.repeat(2000);
      
      const context = {
        businessName: 'Test Business',
        businessType: 'restaurant',
        intent: 'GENERAL_CHAT' as const,
        conversationHistory: [],
        relevantContext: []
      };

      const result = await responseProcessor.processResponse(longResponse, context);

      expect(result.validationResult.issues).toContain('Response too long');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('formatBusinessInformation', () => {
    it('should format business information correctly', () => {
      const businessInfo = {
        name: 'Pizza Palace',
        phone: '555-PIZZA',
        website: 'https://pizzapalace.com',
        address: '123 Main St, New York, NY 10001',
        hours: '11:00 AM - 10:00 PM',
        policies: ['No outside food', '18% gratuity for parties of 6+']
      };

      const formatted = responseProcessor.formatBusinessInformation(businessInfo);

      expect(formatted).toContain('**Pizza Palace**');
      expect(formatted).toContain('📞 Phone: 555-PIZZA');
      expect(formatted).toContain('🌐 Website: https://pizzapalace.com');
      expect(formatted).toContain('📍 Address: 123 Main St, New York, NY 10001');
      expect(formatted).toContain('🕒 Hours: 11:00 AM - 10:00 PM');
      expect(formatted).toContain('📋 Policies: No outside food, 18% gratuity for parties of 6+');
    });

    it('should handle minimal business information', () => {
      const businessInfo = {
        name: 'Test Business'
      };

      const formatted = responseProcessor.formatBusinessInformation(businessInfo);

      expect(formatted).toContain('**Test Business**');
      expect(formatted).not.toContain('📞');
      expect(formatted).not.toContain('🌐');
    });
  });

  describe('applyBrandVoice', () => {
    it('should apply brand voice adjustments', () => {
      const response = 'Welcome to our restaurant!';
      const brandVoice = 'friendly and casual';

      const adjustedResponse = responseProcessor.applyBrandVoice(response, brandVoice);

      // For now, this returns the response as-is
      expect(adjustedResponse).toBe(response);
    });
  });
});
