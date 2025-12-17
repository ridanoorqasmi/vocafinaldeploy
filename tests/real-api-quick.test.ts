// ===== QUICK REAL API TEST =====
// This tests with actual OpenAI GPT-4o API calls
// WARNING: This will use real API credits!

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QueryProcessor } from '../lib/query-processor';
import { PrismaClient } from '@prisma/client';
import { QueryRequest } from '../lib/query-types';

// Use real Prisma client for real testing
const prisma = new PrismaClient();

describe('Real API Quick Test', () => {
  let queryProcessor: QueryProcessor;

  beforeAll(async () => {
    // Initialize with real services (no mocks)
    queryProcessor = new QueryProcessor(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should generate real responses from GPT-4o', async () => {
    const request: QueryRequest = {
      query: 'What is your best pizza?',
      sessionId: 'real-test-session'
    };

    console.log('🚀 Testing with REAL OpenAI GPT-4o API...');
    console.log('💰 This will use real API credits!');
    
    const startTime = Date.now();
    const result = await queryProcessor.processQuery('business-123', request);
    const endTime = Date.now();

    console.log('✅ Real API Response:', {
      response: result.response.text,
      processingTime: `${endTime - startTime}ms`,
      tokensUsed: result.usage?.tokensUsed,
      cost: result.usage?.costEstimate,
      model: result.metadata.modelUsed
    });

    // Verify real response
    expect(result).toBeDefined();
    expect(result.response.text).toBeDefined();
    expect(result.response.text.length).toBeGreaterThan(10);
    expect(result.usage?.tokensUsed).toBeGreaterThan(0);
    expect(result.usage?.costEstimate).toBeGreaterThan(0);
    expect(result.metadata.modelUsed).toBe('gpt-4o');
  }, 30000); // 30 second timeout for real API calls
});
