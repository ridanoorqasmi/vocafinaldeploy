// ===== LLM SERVICE TESTS - PHASE 3B =====

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

// Mock openai-client
vi.mock('../lib/openai-client', () => ({
  getOpenAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

describe('LLMService', () => {
  let llmService: any;
  let mockOpenAI: any;

  beforeEach(async () => {
    // Import after mocks are set up
    const { LLMService } = await import('../lib/llm-service');
    
    // Get the mocked OpenAI client
    const { getOpenAIClient } = await import('../lib/openai-client');
    mockOpenAI = getOpenAIClient();
    
    llmService = new LLMService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateResponse', () => {
    it('should generate a complete response successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'This is a test response from GPT-4o.'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, how are you?' }
      ];

      const result = await llmService.generateResponse(messages, 'business-123', 'session-456');

      expect(result).toBeDefined();
      expect(result.text).toBe('This is a test response from GPT-4o.');
      expect(result.tokensUsed).toBe(150);
      expect(result.cost).toBeGreaterThan(0);
      expect(result.model).toBe('gpt-4o');
      expect(result.finishReason).toBe('stop');
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const messages = [
        { role: 'user', content: 'Test query' }
      ];

      await expect(
        llmService.generateResponse(messages, 'business-123', 'session-456')
      ).rejects.toThrow('AI service temporarily unavailable');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).code = 'rate_limit_exceeded';
      
      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError);

      const messages = [
        { role: 'user', content: 'Test query' }
      ];

      await expect(
        llmService.generateResponse(messages, 'business-123', 'session-456')
      ).rejects.toThrow('Rate limit exceeded. Please try again in a moment.');
    });
  });

  describe('generateStreamingResponse', () => {
    it('should generate streaming response successfully', async () => {
      const mockStream = [
        {
          choices: [{
            delta: { content: 'Hello' }
          }]
        },
        {
          choices: [{
            delta: { content: ' world' }
          }]
        },
        {
          choices: [{
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 10,
            total_tokens: 110
          }
        }
      ];

      mockOpenAI.chat.completions.create.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        }
      });

      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const chunks: any[] = [];
      for await (const chunk of llmService.generateStreamingResponse(messages, 'business-123', 'session-456')) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0].chunk).toBe('Hello');
      expect(chunks[1].chunk).toBe(' world');
      expect(chunks[2].completed).toBe(true);
    });
  });

  describe('getBusinessQuota', () => {
    it('should return business quota information', async () => {
      const quota = await llmService.getBusinessQuota('business-123');

      expect(quota).toBeDefined();
      expect(quota.businessId).toBe('business-123');
      expect(quota.monthlyLimit).toBe(1000000);
      expect(quota.remainingQuota).toBe(1000000);
      expect(quota.resetDate).toBeInstanceOf(Date);
    });
  });

  describe('generateFallbackResponse', () => {
    it('should generate appropriate fallback responses for different intents', () => {
      const businessName = 'Test Restaurant';

      const menuResponse = llmService.generateFallbackResponse('MENU_INQUIRY', businessName);
      expect(menuResponse).toContain(businessName);
      expect(menuResponse).toContain('menu');

      const hoursResponse = llmService.generateFallbackResponse('HOURS_POLICY', businessName);
      expect(hoursResponse).toContain(businessName);
      expect(hoursResponse).toContain('hours');

      const unknownResponse = llmService.generateFallbackResponse('UNKNOWN', businessName);
      expect(unknownResponse).toContain(businessName);
    });
  });

  describe('validateResponse', () => {
    it('should validate response quality correctly', () => {
      const validResponse = 'This is a helpful response about our restaurant.';
      const context = { businessName: 'Test Restaurant' };

      const result = llmService.validateResponse(validResponse, context);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect inappropriate content', () => {
      const inappropriateResponse = 'This is a hateful response.';
      const context = { businessName: 'Test Restaurant' };

      const result = llmService.validateResponse(inappropriateResponse, context);

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.issues).toContain('Potentially inappropriate content');
    });

    it('should detect empty responses', () => {
      const emptyResponse = '';
      const context = { businessName: 'Test Restaurant' };

      const result = llmService.validateResponse(emptyResponse, context);

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.issues).toContain('Empty response');
    });
  });
});
