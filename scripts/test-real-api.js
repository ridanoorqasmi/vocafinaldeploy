// ===== REAL API TESTING SCRIPT =====
// Run this to test with actual OpenAI GPT-4o API

const { QueryProcessor } = require('../lib/query-processor');
const { PrismaClient } = require('@prisma/client');

async function testRealAPI() {
  console.log('🚀 Starting REAL API Testing...');
  console.log('💰 This will use real OpenAI credits!');
  console.log('');

  const prisma = new PrismaClient();
  const queryProcessor = new QueryProcessor(prisma);

  try {
    // Test 1: Basic query
    console.log('📝 Test 1: Basic Query');
    const request = {
      query: 'What is your best pizza?',
      sessionId: 'real-test-session'
    };

    const startTime = Date.now();
    const result = await queryProcessor.processQuery('business-123', request);
    const endTime = Date.now();

    console.log('✅ Response:', result.response.text);
    console.log('⏱️ Processing Time:', `${endTime - startTime}ms`);
    console.log('🎯 Tokens Used:', result.usage?.tokensUsed);
    console.log('💰 Cost:', `$${result.usage?.costEstimate?.toFixed(4)}`);
    console.log('🤖 Model:', result.metadata.modelUsed);
    console.log('');

    // Test 2: Streaming
    console.log('📝 Test 2: Streaming Response');
    console.log('🌊 Streaming response:');
    
    const streamRequest = {
      query: 'Tell me about your restaurant',
      sessionId: 'real-streaming-test'
    };

    let fullResponse = '';
    for await (const event of queryProcessor.processStreamingQuery('business-123', streamRequest)) {
      if (event.type === 'chunk') {
        process.stdout.write(event.data.chunk);
        fullResponse += event.data.chunk;
      } else if (event.type === 'complete') {
        console.log('\n');
        console.log('✅ Streaming complete!');
        console.log('🎯 Total tokens:', event.data.tokensUsed);
        console.log('💰 Total cost:', `$${event.data.cost?.toFixed(4)}`);
        break;
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
  }
}

// Run the test
testRealAPI().catch(console.error);
