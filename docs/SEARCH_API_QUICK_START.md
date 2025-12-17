# 🔍 Search API Quick Start Guide

## 🚀 **Getting Started**

This guide will help you quickly integrate the Phase 2D vector search APIs into your application.

## 📋 **Prerequisites**

1. **Authentication**: Valid business JWT token
2. **Environment**: Phase 2A-2C embeddings must be set up
3. **Database**: PostgreSQL with pgvector extension
4. **OpenAI API**: Valid API key for embedding generation

## ⚡ **Quick Setup**

### 1. **Environment Configuration**

Add these variables to your `.env.local`:

```env
# Vector Search Configuration
VECTOR_SEARCH_TOPN=3
VECTOR_SEARCH_MINSCORE=0.75
SEARCH_CACHE_TTL=300
SEARCH_CACHE_PROVIDER=redis

# Redis Configuration (optional)
REDIS_URL="redis://localhost:6379"

# OpenAI API Key (required)
OPENAI_API_KEY="your_openai_api_key_here"
```

### 2. **Test API Connection**

```bash
# Test menu search
curl -X POST http://localhost:3000/api/search/menu \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_BUSINESS_TOKEN" \
  -d '{
    "query": "pizza",
    "topN": 3,
    "minScore": 0.75
  }'
```

## 🔧 **API Usage Examples**

### **Menu Search**

```typescript
const searchMenu = async (query: string) => {
  const response = await fetch('/api/search/menu', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${businessToken}`
    },
    body: JSON.stringify({
      query: 'pepperoni pizza',
      topN: 5,
      minScore: 0.75,
      includeMetadata: true
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data.results.map(result => ({
      id: result.contentId,
      name: result.metadata?.title || result.content,
      price: result.metadata?.price,
      snippet: result.textSnippet,
      confidence: result.confidence
    }));
  }
  
  throw new Error(data.error?.message || 'Search failed');
};
```

### **FAQ Search**

```typescript
const searchFAQs = async (query: string) => {
  const response = await fetch('/api/search/faqs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${businessToken}`
    },
    body: JSON.stringify({
      query: 'how to place order',
      topN: 3,
      minScore: 0.8
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data.results.map(result => ({
      question: result.metadata?.title || result.content,
      answer: result.textSnippet,
      confidence: result.confidence
    }));
  }
  
  throw new Error(data.error?.message || 'Search failed');
};
```

### **Combined Search**

```typescript
const searchAll = async (query: string) => {
  const response = await fetch('/api/search/all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${businessToken}`
    },
    body: JSON.stringify({
      query: 'delivery information',
      topN: 10,
      minScore: 0.75,
      contentTypes: ['MENU', 'FAQ', 'POLICY']
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return {
      results: data.data.results,
      grouped: data.data.groupedResults,
      stats: data.data.stats
    };
  }
  
  throw new Error(data.error?.message || 'Search failed');
};
```

## 🎯 **Common Use Cases**

### **1. Chatbot Integration**

```typescript
const getChatbotContext = async (userMessage: string) => {
  try {
    // Search for relevant context
    const searchResults = await searchAll(userMessage);
    
    // Filter high-confidence results
    const relevantContext = searchResults.results
      .filter(result => result.confidence > 0.8)
      .slice(0, 3) // Top 3 most relevant
      .map(result => ({
        type: result.contentType,
        content: result.textSnippet,
        confidence: result.confidence
      }));
    
    return relevantContext;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
};
```

### **2. Search Suggestions**

```typescript
const getSearchSuggestions = async (partialQuery: string) => {
  if (partialQuery.length < 2) return [];
  
  try {
    const results = await searchAll(partialQuery);
    
    return results.results
      .slice(0, 5)
      .map(result => ({
        text: result.textSnippet,
        type: result.contentType,
        confidence: result.confidence
      }));
  } catch (error) {
    console.error('Suggestions error:', error);
    return [];
  }
};
```

### **3. Content Discovery**

```typescript
const discoverContent = async (category: string) => {
  try {
    const results = await searchAll(category);
    
    // Group by content type
    const discovery = {
      menu: results.results.filter(r => r.contentType === 'MENU'),
      faqs: results.results.filter(r => r.contentType === 'FAQ'),
      policies: results.results.filter(r => r.contentType === 'POLICY')
    };
    
    return discovery;
  } catch (error) {
    console.error('Discovery error:', error);
    return { menu: [], faqs: [], policies: [] };
  }
};
```

## 📊 **Performance Monitoring**

### **Get Search Statistics**

```typescript
const getSearchStats = async () => {
  const response = await fetch('/api/search/stats', {
    headers: {
      'Authorization': `Bearer ${businessToken}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    return {
      totalEmbeddings: data.data.retrieval.totalEmbeddings,
      cacheHitRate: data.data.cache.hitRate,
      averageResponseTime: data.data.performance.averageResponseTime,
      successRate: data.data.performance.successRate
    };
  }
  
  throw new Error(data.error?.message || 'Stats failed');
};
```

## 🔧 **Configuration Options**

### **Search Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | - | Search query (required) |
| `topN` | number | 3 | Number of results (1-20) |
| `minScore` | number | 0.75 | Minimum similarity (0-1) |
| `includeMetadata` | boolean | true | Include metadata |
| `contentTypes` | array | all | Filter by type |

### **Recommended Settings**

```typescript
// For chatbot responses
const chatbotConfig = {
  topN: 3,
  minScore: 0.8,
  includeMetadata: true
};

// For search suggestions
const suggestionsConfig = {
  topN: 5,
  minScore: 0.7,
  includeMetadata: false
};

// For content discovery
const discoveryConfig = {
  topN: 10,
  minScore: 0.75,
  includeMetadata: true
};
```

## 🚨 **Error Handling**

### **Common Error Scenarios**

```typescript
const handleSearchError = (error: any) => {
  switch (error.code) {
    case 'UNAUTHORIZED':
      // Redirect to login
      window.location.href = '/login';
      break;
      
    case 'INVALID_REQUEST':
      // Show validation error
      console.error('Invalid search parameters:', error.details);
      break;
      
    case 'SEARCH_FAILED':
      // Show generic error
      console.error('Search service unavailable');
      break;
      
    default:
      console.error('Unknown error:', error);
  }
};
```

### **Retry Logic**

```typescript
const searchWithRetry = async (query: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await searchAll(query);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
};
```

## 🧪 **Testing Your Integration**

### **1. Test Basic Search**

```bash
# Test menu search
curl -X POST http://localhost:3000/api/search/menu \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "pizza"}'
```

### **2. Test Error Handling**

```bash
# Test with invalid token
curl -X POST http://localhost:3000/api/search/menu \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token" \
  -d '{"query": "pizza"}'
```

### **3. Test Performance**

```bash
# Test with multiple requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/search/menu \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"query": "pizza"}' &
done
wait
```

## 📈 **Best Practices**

### **1. Query Optimization**

```typescript
// Good: Specific queries
const goodQueries = [
  'pepperoni pizza',
  'delivery policy',
  'how to place order'
];

// Avoid: Too vague
const vagueQueries = [
  'food',
  'help',
  'info'
];
```

### **2. Caching Strategy**

```typescript
// Cache search results on client side
const searchCache = new Map();

const cachedSearch = async (query: string) => {
  if (searchCache.has(query)) {
    return searchCache.get(query);
  }
  
  const results = await searchAll(query);
  searchCache.set(query, results);
  
  // Clear cache after 5 minutes
  setTimeout(() => {
    searchCache.delete(query);
  }, 5 * 60 * 1000);
  
  return results;
};
```

### **3. User Experience**

```typescript
// Debounce search input
const debouncedSearch = debounce(async (query: string) => {
  if (query.length >= 2) {
    const results = await searchAll(query);
    updateSearchResults(results);
  }
}, 300);

// Show loading states
const searchWithLoading = async (query: string) => {
  setLoading(true);
  try {
    const results = await searchAll(query);
    setResults(results);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

## 🆘 **Troubleshooting**

### **Common Issues**

1. **"Authentication required"**
   - Check JWT token validity
   - Ensure proper Authorization header

2. **"Search failed"**
   - Check database connection
   - Verify OpenAI API key

3. **Slow responses**
   - Check cache configuration
   - Monitor database performance

4. **No results**
   - Lower minScore threshold
   - Check if embeddings exist

### **Debug Mode**

```typescript
// Enable debug logging
const debugSearch = async (query: string) => {
  console.log('Search query:', query);
  
  const startTime = Date.now();
  const results = await searchAll(query);
  const endTime = Date.now();
  
  console.log('Search time:', endTime - startTime, 'ms');
  console.log('Results count:', results.results.length);
  console.log('Average confidence:', results.stats.averageConfidence);
  
  return results;
};
```

## 📚 **Additional Resources**

- [Full API Documentation](./PHASE_2D_IMPLEMENTATION.md)
- [Performance Benchmarks](./PHASE_2D_IMPLEMENTATION.md#performance-metrics)
- [Error Codes Reference](./PHASE_2D_IMPLEMENTATION.md#error-handling)
- [Configuration Options](./PHASE_2D_IMPLEMENTATION.md#configuration)

---

**Need Help?** Check the troubleshooting section or review the full implementation documentation.

