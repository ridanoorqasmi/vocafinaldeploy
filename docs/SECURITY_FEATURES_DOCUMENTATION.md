# 🛡️ Security Features Documentation

## Overview

This document describes the comprehensive security features implemented in the VOCA AI Business API system. These features provide production-ready security layers including API key authentication, rate limiting, input validation, comprehensive logging, and security headers.

## 🔐 Authentication & Authorization

### Dual Authentication System

The API supports two authentication methods:

1. **JWT Token Authentication** (Existing)
   - Bearer token in Authorization header
   - Role-based access control (OWNER, ADMIN, MANAGER, STAFF)
   - Multi-tenant business isolation

2. **API Key Authentication** (New)
   - API key in X-API-Key header
   - Permission-based access control (read, write, admin)
   - Business-scoped access

### API Key Management

#### Create API Key
```http
POST /api/businesses/:businessId/api-keys
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "My API Key",
  "permissions": ["read", "write"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

#### List API Keys
```http
GET /api/businesses/:businessId/api-keys?page=1&limit=50
Authorization: Bearer <jwt_token>
```

#### Update API Key
```http
PUT /api/businesses/:businessId/api-keys/:keyId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated API Key",
  "permissions": ["read", "write", "admin"]
}
```

#### Revoke API Key
```http
DELETE /api/businesses/:businessId/api-keys/:keyId
Authorization: Bearer <jwt_token>
```

### Permission Levels

- **read**: Can perform GET operations
- **write**: Can perform POST, PUT, PATCH operations
- **admin**: Can perform DELETE operations and manage API keys

## 🚦 Rate Limiting

### Rate Limit Tiers

| Endpoint Type | Limit | Window | Description |
|---------------|-------|--------|-------------|
| Authentication | 10 requests | 15 minutes | Login/register endpoints |
| Read Operations | 10 requests | 1 minute | GET endpoints |
| Write Operations | 5 requests | 1 minute | POST, PUT, PATCH endpoints |
| Bulk Operations | 3 requests | 1 minute | DELETE endpoints |
| API Key Requests | 20 requests | 1 minute | Higher limits for API keys |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640995200
```

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds."
  }
}
```

## ✅ Input Validation & Sanitization

### Validation Schemas

All input is validated against Zod schemas:

- **Business Data**: Name, email, phone, website validation
- **Location Data**: Address, coordinates, contact validation
- **Menu Items**: Price, description, allergen validation
- **API Keys**: Permission validation, expiration dates
- **Query Parameters**: Pagination, search, sorting validation

### Sanitization

All string inputs are sanitized to prevent:
- XSS attacks
- SQL injection
- HTML injection
- Script injection

### Validation Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "invalid_string"
      }
    ]
  }
}
```

## 📊 Comprehensive Logging

### Request Logging

Every API request is logged with:

- Business ID and User ID
- Request method and path
- Query parameters
- User agent and IP address
- Request size and response time
- Response status and error messages
- Security flags (suspicious requests)

### Security Event Logging

Security events are logged separately:

- **AUTH_FAILURE**: Failed authentication attempts
- **RATE_LIMIT**: Rate limit violations
- **SUSPICIOUS_INPUT**: Potentially malicious requests
- **UNAUTHORIZED_ACCESS**: Access denied events

### Log Storage

Logs are stored in the database:
- `query_logs` table for request logs
- `usage_metrics` table for security events

## 🔒 Security Headers

### Standard Security Headers

All responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### HTTPS Security (Production)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Content Security Policy

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

## 🌐 CORS Configuration

### Allowed Origins

Configured via environment variable:
```env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### CORS Headers

```http
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
```

## 🛡️ Request Security

### Request Size Limiting

Maximum request size: 10MB (configurable)

```env
MAX_REQUEST_SIZE=10485760
```

### IP Blocking

Basic IP blocking support for repeated abuse.

### Suspicious Request Detection

Automatically detects and logs:
- SQL injection attempts
- XSS attacks
- Script injection
- Unusual user agents
- Oversized requests

## 📈 Usage Tracking

### Metrics Collected

- API requests per business per hour/day
- Response times by endpoint
- Error rates and types
- Rate limit hits by business
- API key usage patterns
- Security events and blocked requests

### Usage Reports

Generate usage reports for billing and analytics:

```javascript
// Get usage stats for a business
const stats = await getUsageStats(businessId, startDate, endDate);
```

## 🔧 Configuration

### Environment Variables

```env
# API Security
API_KEY_SECRET=your-api-key-encryption-secret-32-chars
RATE_LIMIT_REDIS_URL=redis://localhost:6379
MAX_REQUEST_SIZE=10mb
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=true

# Security  
ENABLE_CORS=true
TRUST_PROXY=true
SECURITY_HEADERS_ENABLED=true
ENABLE_CSP=true
```

## 🧪 Testing

### Security Test Suite

Run the comprehensive security test:

```bash
node scripts/test-security-features.js
```

### Test Coverage

- ✅ API Key Management (Create, Read, Update, Delete)
- ✅ API Key Authentication
- ✅ Rate Limiting
- ✅ Input Validation
- ✅ Security Headers
- ✅ CORS Configuration
- ✅ Unauthorized Access Blocking
- ✅ Invalid API Key Rejection

## 🚀 Production Deployment

### Security Checklist

- [ ] Set strong API_KEY_SECRET
- [ ] Configure ALLOWED_ORIGINS
- [ ] Enable HTTPS with HSTS
- [ ] Set up Redis for rate limiting
- [ ] Configure log retention
- [ ] Set up monitoring alerts
- [ ] Review and update rate limits
- [ ] Test all security features

### Performance Considerations

- Rate limiting adds <1ms overhead
- Input validation adds <2ms overhead
- Logging adds <3ms overhead
- Security headers add <1ms overhead
- Total security overhead: <7ms per request

## 📚 API Examples

### Using JWT Authentication

```javascript
const response = await fetch('/api/businesses/123', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...',
    'Content-Type': 'application/json'
  }
});
```

### Using API Key Authentication

```javascript
const response = await fetch('/api/businesses/123', {
  headers: {
    'X-API-Key': 'voca_-qxK8LpVeP8dyV_...',
    'Content-Type': 'application/json'
  }
});
```

### Handling Rate Limits

```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  console.log(`Rate limited. Retry after ${retryAfter} seconds.`);
}
```

## 🔍 Monitoring & Alerts

### Key Metrics to Monitor

1. **Authentication Failures**: High failure rates may indicate attacks
2. **Rate Limit Hits**: Unusual patterns may indicate abuse
3. **Suspicious Requests**: Automated attacks or probes
4. **Response Times**: Performance degradation
5. **Error Rates**: System health indicators

### Recommended Alerts

- Authentication failure rate > 10%
- Rate limit hits > 100/hour per IP
- Suspicious requests > 50/hour
- Response time > 1 second
- Error rate > 5%

## 🛠️ Troubleshooting

### Common Issues

1. **Rate Limit Too Aggressive**: Adjust limits in `RATE_LIMITS` configuration
2. **CORS Issues**: Check `ALLOWED_ORIGINS` configuration
3. **API Key Not Working**: Verify permissions and expiration
4. **Validation Errors**: Check input format against schemas
5. **Logging Issues**: Verify database connection and permissions

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
```

This comprehensive security system provides enterprise-grade protection while maintaining excellent performance and developer experience.
