# 🔍 Query Pipeline Quick Start Guide

## 🚀 **Getting Started**

This guide will help you quickly integrate the Phase 3A query processing pipeline into your application.

## 📋 **Prerequisites**

1. **Authentication**: Valid business JWT token
2. **Database**: PostgreSQL with updated schema (conversations & query_logs tables)
3. **Environment**: Phase 2A-2D embeddings and vector search operational
4. **OpenAI API**: Valid API key for intent detection

## ⚡ **Quick Setup**

### 1. **Database Migration**

Run the database migration to add new tables:

```bash
# Generate Prisma client with new schema
npm run db:generate

# Apply database changes
npm run db:push
```

### 2. **Environment Configuration**

Add these variables to your `.env.local`:

```env
# Query Processing Configuration
QUERY_MAX_LENGTH=2000
QUERY_RATE_LIMIT_PER_MINUTE=60
QUERY_RATE_LIMIT_PER_HOUR=1000
CONTEXT_SIMILARITY_THRESHOLD=0.7
CONTEXT_MAX_ITEMS=10

# Session Management
SESSION_TIMEOUT_MINUTES=30
CONVERSATION_HISTORY_LIMIT=10
CONTEXT_WINDOW_TOKENS=4000
SESSION_CLEANUP_INTERVAL_HOURS=24

# Performance Settings
QUERY_TIMEOUT_MS=5000
DATABASE_POOL_SIZE=20
CACHE_TTL_MINUTES=15

# Logging Configuration
LOG_RETENTION_DAYS=30
BATCH_LOG_SIZE=100
FLUSH_INTERVAL_MS=5000
```

### 3. **Test API Connection**

```bash
# Test query processing
curl -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BUSINESS_TOKEN" \
  -d '{
    "query": "What is your best pizza?",
    "sessionId": "test-session-123"
  }'
```

## 🔧 **API Usage Examples**

### **Basic Query Processing**

```typescript
const processQuery = async (query: string, sessionId?: string) => {
  const response = await fetch('/api/v1/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${businessToken}`
    },
    body: JSON.stringify({
      query,
      sessionId,
      context: {
        location: 'New York',
        preferences: ['vegetarian']
      }
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return {
      response: data.data.response.text,
      intent: data.data.response.intent,
      confidence: data.data.response.confidence,
      suggestions: data.data.response.suggestions,
      sessionId: data.data.session.sessionId,
      expiresAt: data.data.session.expiresAt
    };
  }
  
  throw new Error(data.error?.message || 'Query processing failed');
};
```

### **Conversation Flow**

```typescript
class ConversationManager {
  private sessionId: string | null = null;
  private expiresAt: string | null = null;

  async startConversation() {
    const result = await processQuery('Hello!');
    this.sessionId = result.sessionId;
    this.expiresAt = result.expiresAt;
    return result;
  }

  async sendMessage(message: string) {
    if (!this.sessionId) {
      throw new Error('No active conversation');
    }

    const result = await processQuery(message, this.sessionId);
    
    // Update session info
    this.sessionId = result.sessionId;
    this.expiresAt = result.expiresAt;
    
    return result;
  }

  isSessionValid(): boolean {
    if (!this.expiresAt) return false;
    return new Date() < new Date(this.expiresAt);
  }
}
```

### **Intent-Based Handling**

```typescript
const handleQuery = async (query: string) => {
  const result = await processQuery(query);
  
  switch (result.intent) {
    case 'MENU_INQUIRY':
      return handleMenuQuery(result);
    case 'HOURS_POLICY':
      return handleHoursQuery(result);
    case 'PRICING_QUESTION':
      return handlePricingQuery(result);
    case 'DIETARY_RESTRICTIONS':
      return handleDietaryQuery(result);
    case 'LOCATION_INFO':
      return handleLocationQuery(result);
    case 'GENERAL_CHAT':
      return handleGeneralChat(result);
    case 'COMPLAINT_FEEDBACK':
      return handleComplaintQuery(result);
    default:
      return handleUnknownQuery(result);
  }
};

const handleMenuQuery = (result: any) => {
  // Custom logic for menu inquiries
  return {
    type: 'menu',
    response: result.response,
    suggestions: result.suggestions,
    confidence: result.confidence
  };
};
```

## 🎯 **Common Use Cases**

### **1. Chatbot Integration**

```typescript
class RestaurantChatbot {
  private conversationManager: ConversationManager;

  constructor() {
    this.conversationManager = new ConversationManager();
  }

  async handleUserMessage(message: string) {
    try {
      // Start conversation if needed
      if (!this.conversationManager.isSessionValid()) {
        await this.conversationManager.startConversation();
      }

      // Process user message
      const result = await this.conversationManager.sendMessage(message);
      
      return {
        message: result.response,
        intent: result.intent,
        confidence: result.confidence,
        suggestions: result.suggestions,
        sessionId: result.sessionId
      };
    } catch (error) {
      console.error('Chatbot error:', error);
      return {
        message: "I'm sorry, I'm having trouble processing your request. Please try again.",
        intent: 'UNKNOWN',
        confidence: 0,
        suggestions: ['Try rephrasing your question', 'Contact support']
      };
    }
  }
}
```

### **2. Search Suggestions**

```typescript
const getSearchSuggestions = async (partialQuery: string) => {
  if (partialQuery.length < 2) return [];
  
  try {
    const result = await processQuery(partialQuery);
    
    return result.suggestions || [];
  } catch (error) {
    console.error('Suggestions error:', error);
    return [];
  }
};
```

### **3. Customer Support**

```typescript
const handleCustomerSupport = async (customerMessage: string, customerId: string) => {
  try {
    const result = await processQuery(customerMessage, undefined, customerId);
    
    // Route based on intent
    if (result.intent === 'COMPLAINT_FEEDBACK') {
      // Escalate to human agent
      await escalateToHumanAgent(customerId, result);
      return {
        message: "I understand your concern. I'm connecting you with a human agent who can help.",
        escalated: true
      };
    }
    
    return {
      message: result.response,
      intent: result.intent,
      confidence: result.confidence
    };
  } catch (error) {
    console.error('Support error:', error);
    return {
      message: "I'm sorry, I'm having trouble. Let me connect you with a human agent.",
      escalated: true
    };
  }
};
```

## 📊 **Analytics & Monitoring**

### **Get Query Analytics**

```typescript
const getQueryAnalytics = async (startDate?: Date, endDate?: Date) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate.toISOString());
  if (endDate) params.append('endDate', endDate.toISOString());
  
  const response = await fetch(`/api/v1/analytics/query?${params}`, {
    headers: {
      'Authorization': `Bearer ${businessToken}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    return {
      totalQueries: data.data.queryAnalytics.totalQueries,
      successRate: data.data.queryAnalytics.successfulQueries / data.data.queryAnalytics.totalQueries,
      averageProcessingTime: data.data.queryAnalytics.averageProcessingTime,
      intentDistribution: data.data.queryAnalytics.intentDistribution,
      realTimeMetrics: data.data.realTimeMetrics
    };
  }
  
  throw new Error(data.error?.message || 'Analytics failed');
};
```

### **Monitor Performance**

```typescript
const monitorPerformance = async () => {
  const analytics = await getQueryAnalytics();
  
  console.log('Query Performance Metrics:');
  console.log(`Total Queries: ${analytics.totalQueries}`);
  console.log(`Success Rate: ${(analytics.successRate * 100).toFixed(2)}%`);
  console.log(`Average Processing Time: ${analytics.averageProcessingTime}ms`);
  console.log(`Active Sessions: ${analytics.realTimeMetrics.activeSessions}`);
  console.log(`Queries Last Hour: ${analytics.realTimeMetrics.queriesLastHour}`);
  
  // Check for performance issues
  if (analytics.averageProcessingTime > 500) {
    console.warn('⚠️ Average processing time is above 500ms');
  }
  
  if (analytics.successRate < 0.95) {
    console.warn('⚠️ Success rate is below 95%');
  }
};
```

## 🔧 **Configuration Options**

### **Query Processing Settings**

```typescript
// Customize query processing
const queryConfig = {
  maxQueryLength: 2000,        // Maximum query length
  rateLimitPerMinute: 60,      // Rate limit per minute
  contextSimilarityThreshold: 0.7,  // Context relevance threshold
  sessionTimeoutMinutes: 30,   // Session timeout
  enableCaching: true,         // Enable response caching
  enableAnalytics: true        // Enable analytics logging
};
```

### **Intent Detection Settings**

```typescript
// Customize intent detection
const intentConfig = {
  confidenceThreshold: 0.7,    // Minimum confidence for intent
  enableFallback: true,        // Enable fallback detection
  customIntents: {             // Custom intent patterns
    'CATERING_INQUIRY': ['catering', 'party', 'event'],
    'RESERVATION_REQUEST': ['reservation', 'booking', 'table']
  }
};
```

## 🚨 **Error Handling**

### **Common Error Scenarios**

```typescript
const handleQueryWithErrorHandling = async (query: string) => {
  try {
    const result = await processQuery(query);
    return result;
  } catch (error) {
    if (error.message.includes('Rate limit exceeded')) {
      // Handle rate limiting
      return {
        message: "You're asking questions too quickly. Please wait a moment and try again.",
        retryAfter: 60
      };
    }
    
    if (error.message.includes('Session has expired')) {
      // Handle session expiration
      return {
        message: "Your session has expired. Let me start a new conversation.",
        newSession: true
      };
    }
    
    if (error.message.includes('Invalid input')) {
      // Handle validation errors
      return {
        message: "I didn't understand that. Could you please rephrase your question?",
        suggestions: ['Try asking about our menu', 'Ask about our hours', 'Ask about delivery']
      };
    }
    
    // Handle other errors
    console.error('Query processing error:', error);
    return {
      message: "I'm having trouble processing your request. Please try again.",
      error: true
    };
  }
};
```

### **Retry Logic**

```typescript
const processQueryWithRetry = async (query: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processQuery(query);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

## 🧪 **Testing Your Integration**

### **1. Test Basic Query Processing**

```bash
# Test menu inquiry
curl -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "What do you have on your menu?"}'

# Test hours inquiry
curl -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "What are your hours?"}'

# Test pricing inquiry
curl -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "How much does the pizza cost?"}'
```

### **2. Test Conversation Flow**

```bash
# Start conversation
curl -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "Hello, I need help"}'

# Continue conversation (use sessionId from previous response)
curl -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "What do you recommend?",
    "sessionId": "SESSION_ID_FROM_PREVIOUS_RESPONSE"
  }'
```

### **3. Test Error Handling**

```bash
# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/query \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"query": "test query"}' &
done
wait

# Test invalid input
curl -X POST http://localhost:3000/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": ""}'
```

## 📈 **Best Practices**

### **1. Session Management**

```typescript
// Proper session handling
class SessionManager {
  private sessionId: string | null = null;
  private expiresAt: Date | null = null;

  async getOrCreateSession(): Promise<string> {
    if (this.isSessionValid()) {
      return this.sessionId!;
    }
    
    // Create new session
    const result = await processQuery('Hello');
    this.sessionId = result.sessionId;
    this.expiresAt = new Date(result.expiresAt);
    return this.sessionId;
  }

  private isSessionValid(): boolean {
    return this.sessionId !== null && 
           this.expiresAt !== null && 
           new Date() < this.expiresAt;
  }
}
```

### **2. Error Recovery**

```typescript
// Robust error handling
const processQuerySafely = async (query: string) => {
  try {
    return await processQuery(query);
  } catch (error) {
    // Log error for monitoring
    console.error('Query processing error:', error);
    
    // Return fallback response
    return {
      response: "I'm having trouble processing your request. Please try again.",
      intent: 'UNKNOWN',
      confidence: 0,
      suggestions: ['Try rephrasing your question', 'Contact support']
    };
  }
};
```

### **3. Performance Optimization**

```typescript
// Cache frequent queries
const queryCache = new Map<string, any>();

const processQueryWithCache = async (query: string) => {
  const cacheKey = query.toLowerCase().trim();
  
  if (queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey);
    // Check if cache is still valid (e.g., 5 minutes)
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.result;
    }
  }
  
  const result = await processQuery(query);
  
  // Cache the result
  queryCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
  
  return result;
};
```

## 🆘 **Troubleshooting**

### **Common Issues**

1. **"Authentication required"**
   - Check JWT token validity
   - Ensure proper Authorization header

2. **"Rate limit exceeded"**
   - Reduce query frequency
   - Implement client-side rate limiting

3. **"Session has expired"**
   - Start new conversation
   - Check session timeout configuration

4. **"Invalid input"**
   - Check query length (1-2000 characters)
   - Ensure proper JSON format

5. **Slow responses**
   - Check database connection
   - Monitor OpenAI API response times
   - Review processing step timing

### **Debug Mode**

```typescript
// Enable debug logging
const debugQuery = async (query: string) => {
  console.log('Processing query:', query);
  
  const startTime = Date.now();
  const result = await processQuery(query);
  const endTime = Date.now();
  
  console.log('Query processed in:', endTime - startTime, 'ms');
  console.log('Intent detected:', result.intent);
  console.log('Confidence:', result.confidence);
  console.log('Processing time:', result.metadata.processingTimeMs, 'ms');
  
  return result;
};
```

## 📚 **Additional Resources**

- [Full Implementation Documentation](./PHASE_3A_IMPLEMENTATION.md)
- [API Reference](./PHASE_3A_IMPLEMENTATION.md#api-reference)
- [Performance Benchmarks](./PHASE_3A_IMPLEMENTATION.md#performance-metrics)
- [Error Codes Reference](./PHASE_3A_IMPLEMENTATION.md#error-handling)

---

**Need Help?** Check the troubleshooting section or review the full implementation documentation.

