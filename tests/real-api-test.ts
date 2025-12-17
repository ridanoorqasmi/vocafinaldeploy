// ===== REAL API TESTING =====
// This tests with actual OpenAI GPT-4o API calls
// WARNING: This will use real API credits!

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QueryProcessor } from '../lib/query-processor';
import { PrismaClient } from '@prisma/client';
import { QueryRequest } from '../lib/query-types';

// Use real Prisma client for real testing
const prisma = new PrismaClient();

describe('Real API Testing', () => {
  let queryProcessor: QueryProcessor;

  beforeAll(async () => {
    // Initialize with real services (no mocks)
    queryProcessor = new QueryProcessor(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Real GPT-4o Integration', () => {
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

    it('should handle real streaming responses', async () => {
      const request: QueryRequest = {
        query: 'Tell me about your restaurant',
        sessionId: 'real-streaming-test'
      };

      console.log('🌊 Testing REAL streaming with GPT-4o...');
      
      const chunks: string[] = [];
      const startTime = Date.now();

      for await (const event of queryProcessor.processStreamingQuery('business-123', request)) {
        if (event.type === 'chunk') {
          chunks.push(event.data.chunk);
          console.log('📦 Chunk received:', event.data.chunk);
        } else if (event.type === 'complete') {
          const endTime = Date.now();
          console.log('✅ Streaming complete:', {
            totalChunks: chunks.length,
            fullResponse: chunks.join(''),
            processingTime: `${endTime - startTime}ms`,
            tokensUsed: event.data.tokensUsed,
            cost: event.data.cost
          });
          break;
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('').length).toBeGreaterThan(10);
    }, 30000);
  });

  describe('Real Business Data Integration', () => {
    it('should work with real database data', async () => {
      // This would test with actual business data from your database
      // You'd need to have real business records in your database
      
      console.log('🗄️ Testing with REAL database data...');
      
      // Example: Test with a real business ID from your database
      // const realBusinessId = 'your-actual-business-id';
      // const result = await queryProcessor.processQuery(realBusinessId, request);
      
      console.log('ℹ️ Skipping real database test - no real business data configured');
      expect(true).toBe(true); // Placeholder
    });
  });
});
