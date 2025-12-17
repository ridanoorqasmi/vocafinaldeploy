# Business API Documentation

## Overview

This document provides comprehensive documentation for the Business CRUD APIs built for the VOCA AI platform. These APIs enable businesses to manage their locations, menus, policies, team members, and other business data through a secure, role-based system.

## Authentication

All API endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Base URL

```
http://localhost:3000/api
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "pages": 2
    }
  }
}
```

## Role-Based Access Control

- **OWNER**: Full access to all operations
- **ADMIN**: Full access to all operations (except changing owner role)
- **MANAGER**: Can manage menu, policies, view team (cannot delete team members)
- **STAFF**: Read-only access to business data

## API Endpoints

### 1. Business Profile Management

#### Get Business Details
```http
GET /api/businesses/:businessId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cmfi89m9700019oq4rgzw8017",
    "name": "Test Restaurant",
    "slug": "test-restaurant",
    "email": "admin@testrestaurant.com",
    "phone": "+1-555-123-4567",
    "website": "https://testrestaurant.com",
    "description": "Delicious food and great service",
    "timezone": "America/New_York",
    "currency": "USD",
    "language": "en",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "_count": {
      "users": 3,
      "locations": 2,
      "menuItems": 25,
      "policies": 5,
      "knowledgeBase": 10
    }
  }
}
```

#### Update Business Info
```http
PUT /api/businesses/:businessId
```

**Request Body:**
```json
{
  "name": "Updated Restaurant Name",
  "phone": "+1-555-999-8888",
  "website": "https://updatedrestaurant.com",
  "description": "Updated description",
  "timezone": "America/Los_Angeles",
  "currency": "USD",
  "language": "en"
}
```

**Required Role:** ADMIN, OWNER

#### Get Business Statistics
```http
GET /api/businesses/:businessId/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "business": {
      "name": "Test Restaurant",
      "status": "ACTIVE",
      "daysActive": 30
    },
    "counts": {
      "users": 3,
      "locations": 2,
      "menuItems": 25,
      "categories": 5,
      "policies": 5,
      "knowledgeBase": 10,
      "orders": 150,
      "queries": 500
    },
    "performance": {
      "averageResponseTime": 120,
      "successRate": 98.5,
      "totalQueriesToday": 45,
      "activeUsersToday": 8
    },
    "revenue": {
      "totalOrders": 150,
      "averageOrderValue": 25.50,
      "monthlyRevenue": 3825.00,
      "growthRate": 12.5
    }
  }
}
```

### 2. Location Management

#### List All Locations
```http
GET /api/businesses/:businessId/locations
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)
- `search` (optional): Search in name, city, state
- `is_active` (optional): Filter by active status

#### Add New Location
```http
POST /api/businesses/:businessId/locations
```

**Request Body:**
```json
{
  "name": "Main Location",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "US",
  "phone": "+1-555-123-4567",
  "isActive": true
}
```

**Required Role:** ADMIN, OWNER, MANAGER

#### Update Location
```http
PUT /api/businesses/:businessId/locations/:locationId
```

#### Remove Location
```http
DELETE /api/businesses/:businessId/locations/:locationId
```

**Required Role:** ADMIN, OWNER

### 3. Operating Hours Management

#### Get Current Hours
```http
GET /api/businesses/:businessId/operating-hours
```

**Query Parameters:**
- `location_id` (optional): Filter by specific location

#### Update All Hours
```http
PUT /api/businesses/:businessId/operating-hours
```

**Request Body:**
```json
{
  "locationId": "cmfi89m9700019oq4rgzw8017",
  "hours": [
    {
      "dayOfWeek": 0,
      "openTime": "09:00",
      "closeTime": "21:00",
      "isClosed": false
    },
    {
      "dayOfWeek": 1,
      "openTime": "09:00",
      "closeTime": "21:00",
      "isClosed": false
    }
  ]
}
```

#### Update Specific Day
```http
PATCH /api/businesses/:businessId/operating-hours/:day
```

**Request Body:**
```json
{
  "locationId": "cmfi89m9700019oq4rgzw8017",
  "openTime": "10:00",
  "closeTime": "22:00",
  "isClosed": false
}
```

**Required Role:** ADMIN, OWNER, MANAGER

### 4. Categories Management

#### List Categories
```http
GET /api/businesses/:businessId/categories
```

**Query Parameters:**
- `page`, `limit`, `search`, `is_active`

#### Create Category
```http
POST /api/businesses/:businessId/categories
```

**Request Body:**
```json
{
  "name": "Appetizers",
  "description": "Delicious appetizers to start your meal",
  "sortOrder": 0,
  "isActive": true
}
```

#### Update Category
```http
PUT /api/businesses/:businessId/categories/:categoryId
```

#### Delete Category
```http
DELETE /api/businesses/:businessId/categories/:categoryId
```

**Required Role:** ADMIN, OWNER, MANAGER (ADMIN, OWNER for delete)

### 5. Menu Items Management

#### List Menu Items
```http
GET /api/businesses/:businessId/menu-items
```

**Query Parameters:**
- `page`, `limit`, `search`, `category_id`, `is_available`, `sort_by`, `sort_order`

#### Create Menu Item
```http
POST /api/businesses/:businessId/menu-items
```

**Request Body:**
```json
{
  "name": "Margherita Pizza",
  "description": "Classic pizza with tomato, mozzarella, and basil",
  "price": 15.99,
  "image": "https://example.com/pizza.jpg",
  "categoryId": "cmfi89m9700019oq4rgzw8017",
  "isAvailable": true,
  "sortOrder": 0,
  "allergens": ["gluten", "dairy"],
  "calories": 300,
  "prepTime": 15
}
```

#### Update Menu Item
```http
PUT /api/businesses/:businessId/menu-items/:itemId
```

#### Delete Menu Item
```http
DELETE /api/businesses/:businessId/menu-items/:itemId
```

#### Get Full Menu
```http
GET /api/businesses/:businessId/menu
```

**Query Parameters:**
- `include_inactive` (optional): Include inactive items (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "cmfi89m9700019oq4rgzw8017",
        "name": "Appetizers",
        "description": "Delicious appetizers",
        "sortOrder": 0,
        "items": [...]
      }
    ],
    "uncategorized": {
      "name": "Other Items",
      "items": [...]
    },
    "summary": {
      "totalCategories": 5,
      "totalItems": 25,
      "availableItems": 23
    }
  }
}
```

**Required Role:** ADMIN, OWNER, MANAGER (ADMIN, OWNER for delete)

### 6. Policies Management

#### List Policies
```http
GET /api/businesses/:businessId/policies
```

**Query Parameters:**
- `page`, `limit`, `search`, `type`, `is_active`

#### Create Policy
```http
POST /api/businesses/:businessId/policies
```

**Request Body:**
```json
{
  "type": "delivery",
  "title": "Delivery Policy",
  "content": "We deliver within 5 miles of our location",
  "isActive": true,
  "effectiveDate": "2024-01-01T00:00:00.000Z"
}
```

**Valid Types:** `delivery`, `refund`, `privacy`, `terms`, `cancellation`

#### Update Policy
```http
PUT /api/businesses/:businessId/policies/:policyId
```

#### Delete Policy
```http
DELETE /api/businesses/:businessId/policies/:policyId
```

**Required Role:** ADMIN, OWNER, MANAGER (ADMIN, OWNER for delete)

### 7. Knowledge Base Management

#### List FAQ Items
```http
GET /api/businesses/:businessId/knowledge-base
```

**Query Parameters:**
- `page`, `limit`, `search`, `category`, `is_active`

#### Create FAQ
```http
POST /api/businesses/:businessId/knowledge-base
```

**Request Body:**
```json
{
  "title": "How to place an order?",
  "content": "You can place an order by calling us or visiting our website",
  "category": "FAQ",
  "tags": ["ordering", "help"],
  "isActive": true
}
```

**Valid Categories:** `FAQ`, `Policies`, `Procedures`, `Training`

#### Update FAQ
```http
PUT /api/businesses/:businessId/knowledge-base/:kbId
```

#### Delete FAQ
```http
DELETE /api/businesses/:businessId/knowledge-base/:kbId
```

**Required Role:** ADMIN, OWNER, MANAGER (ADMIN, OWNER for delete)

### 8. Team Management

#### List Team Members
```http
GET /api/businesses/:businessId/team
```

**Query Parameters:**
- `page`, `limit`, `search`, `role`, `is_active`

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cmfi89m9700019oq4rgzw8017",
        "email": "john@testrestaurant.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "ADMIN",
        "isActive": true,
        "lastLoginAt": "2024-01-01T00:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {...},
    "summary": {
      "totalMembers": 3,
      "activeMembers": 3,
      "roleCounts": {
        "OWNER": 1,
        "ADMIN": 1,
        "MANAGER": 1
      }
    }
  }
}
```

#### Change User Role
```http
PUT /api/businesses/:businessId/team/:userId/role
```

**Request Body:**
```json
{
  "role": "MANAGER"
}
```

**Valid Roles:** `ADMIN`, `MANAGER`, `STAFF`

**Required Role:** ADMIN, OWNER

#### Remove Team Member
```http
DELETE /api/businesses/:businessId/team/:userId
```

**Required Role:** ADMIN, OWNER

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Access denied |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid input data |
| `DUPLICATE_ERROR` | Resource already exists |
| `CONFLICT` | Operation conflicts with existing data |
| `INTERNAL_ERROR` | Server error |

## HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

## Testing

Run the comprehensive test suite:

```bash
node scripts/test-business-apis.js
```

This will test all API endpoints with proper authentication and role-based access control.

## Security Features

- JWT-based authentication
- Role-based access control
- Multi-tenant data isolation
- Input validation and sanitization
- Soft delete for data preservation
- Rate limiting (via existing middleware)
- CORS protection
- SQL injection prevention (via Prisma)

## Performance Considerations

- Pagination for large datasets
- Database indexes for efficient queries
- Optimized queries with selective field loading
- Connection pooling via Prisma
- Response caching headers (can be added)

## Integration Notes

- All endpoints integrate with existing authentication system
- Uses existing Prisma models without modification
- Respects existing RLS policies
- Compatible with existing middleware
- Ready for AI query integration

