// ===== REAL LLM API TEST =====
// This tests the LLM service directly with actual OpenAI GPT-4o API calls
// WARNING: This will use real API credits!

import { describe, it, expect, beforeAll } from 'vitest';
import { LLMService } from '../lib/llm-service';

describe('Real LLM API Test', () => {
  let llmService: LLMService;

  beforeAll(() => {
    // Initialize with real LLM service (no mocks)
    llmService = new LLMService();
  });

  it('should generate real responses from GPT-4o', async () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant for Pizza Palace, a restaurant.' },
      { role: 'user', content: 'What is your best pizza?' }
    ];

    console.log('🚀 Testing REAL OpenAI GPT-4o API...');
    console.log('💰 This will use real API credits!');
    
    const startTime = Date.now();
    const result = await llmService.generateResponse(messages, 'business-123', 'test-session');
    const endTime = Date.now();

    console.log('✅ Real API Response:', {
      text: result.text,
      processingTime: `${endTime - startTime}ms`,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      model: result.model
    });

    // Verify real response
    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(10);
    expect(result.tokensUsed).toBeGreaterThan(0);
    expect(result.cost).toBeGreaterThan(0);
    expect(result.model).toBe('gpt-4o');
  }, 30000); // 30 second timeout for real API calls

  it('should generate real streaming responses from GPT-4o', async () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant for Pizza Palace, a restaurant.' },
      { role: 'user', content: 'Tell me about your restaurant' }
    ];

    console.log('🌊 Testing REAL streaming with GPT-4o...');
    
    const chunks: string[] = [];
    const startTime = Date.now();

    for await (const chunk of llmService.generateStreamingResponse(messages, 'business-123', 'test-session')) {
      chunks.push(chunk.chunk);
      process.stdout.write(chunk.chunk);
    }

    const endTime = Date.now();
    console.log('\n');
    console.log('✅ Streaming complete!');
    console.log('📦 Total chunks:', chunks.length);
    console.log('📝 Full response:', chunks.join(''));
    console.log('⏱️ Processing time:', `${endTime - startTime}ms`);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('').length).toBeGreaterThan(10);
  }, 30000);
});
