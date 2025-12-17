# 🔐 Authentication & User Management API Documentation

## 📋 Overview

This document provides comprehensive documentation for the VOCA AI authentication and user management system. The API implements JWT-based authentication with role-based access control and multi-tenant isolation.

## 🏗️ Architecture

### Authentication Flow
```
Registration → Email Verification → JWT Token → Role-Based Access → API Calls
```

### User Roles
- **ADMIN**: Full business management, invite users, manage billing
- **MANAGER**: Manage menu, policies, view analytics, invite staff
- **STAFF**: Basic operations, view limited data

## 🔑 Authentication Endpoints

### POST /api/auth/register
Register a new business and admin user.

**Request Body:**
```json
{
  "businessName": "My Restaurant",
  "businessSlug": "my-restaurant",
  "industry": "Food & Beverage",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@myrestaurant.com",
  "password": "SecurePassword123!",
  "phone": "+1-555-123-4567",
  "timezone": "America/New_York"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@myrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true
    },
    "business": {
      "id": "business_456",
      "name": "My Restaurant",
      "slug": "my-restaurant",
      "status": "TRIAL"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900000
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data
- `409 Conflict`: Email or business slug already exists

### POST /api/auth/login
Authenticate user and return JWT tokens.

**Request Body:**
```json
{
  "email": "john@myrestaurant.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@myrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true
    },
    "business": {
      "id": "business_456",
      "name": "My Restaurant",
      "slug": "my-restaurant",
      "status": "ACTIVE"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900000
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid credentials

### POST /api/auth/logout
Invalidate user session and refresh token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### POST /api/auth/verify-email
Verify user email address with token.

**Request Body:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@myrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### POST /api/auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "john@myrestaurant.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "If an account with that email exists, a password reset link has been sent."
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### POST /api/auth/reset-password
Reset password with token from email.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@myrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /api/auth/me
Get current user information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@myrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true
    },
    "business": {
      "id": "business_456",
      "name": "My Restaurant",
      "slug": "my-restaurant",
      "status": "ACTIVE"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 👥 User Management Endpoints

### GET /api/users
Get all users for the current business (paginated).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_123",
        "email": "john@myrestaurant.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "ADMIN",
        "isActive": true,
        "lastLoginAt": "2024-01-15T09:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Permissions:** ADMIN, MANAGER

### POST /api/users
Invite a new user to the business.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "email": "newuser@myrestaurant.com",
  "role": "MANAGER",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_789",
      "email": "newuser@myrestaurant.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "MANAGER",
      "isActive": false
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Permissions:** ADMIN only

### GET /api/users/{userId}
Get specific user details.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@myrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true,
      "lastLoginAt": "2024-01-15T09:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Permissions:** ADMIN, MANAGER, or own profile

### PUT /api/users/{userId}
Update user information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@myrestaurant.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john.doe@myrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true,
      "lastLoginAt": "2024-01-15T09:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Permissions:** ADMIN, MANAGER, or own profile

### DELETE /api/users/{userId}
Delete (deactivate) a user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Permissions:** ADMIN only

### POST /api/users/invite
Accept an invitation to join a business.

**Request Body:**
```json
{
  "token": "invitation_token_from_email",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_789",
      "email": "newuser@myrestaurant.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "MANAGER",
      "isActive": true
    },
    "business": {
      "id": "business_456",
      "name": "My Restaurant",
      "slug": "my-restaurant",
      "status": "ACTIVE"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### PUT /api/users/{userId}/role
Change user role.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "role": "MANAGER"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_789",
      "email": "newuser@myrestaurant.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "MANAGER",
      "isActive": true,
      "lastLoginAt": "2024-01-15T09:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Permissions:** ADMIN only

### PUT /api/users/{userId}/status
Activate or deactivate a user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_789",
      "email": "newuser@myrestaurant.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "MANAGER",
      "isActive": false,
      "lastLoginAt": "2024-01-15T09:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Permissions:** ADMIN only

## 🔒 Security Features

### JWT Token Structure
```json
{
  "userId": "user_123",
  "businessId": "business_456",
  "role": "ADMIN",
  "email": "john@myrestaurant.com",
  "businessSlug": "my-restaurant",
  "iat": 1642248600,
  "exp": 1642249500
}
```

### Rate Limiting
- **Authentication endpoints**: 5 requests per 15 minutes
- **General endpoints**: 100 requests per 15 minutes

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

### Multi-Tenant Isolation
- Row-Level Security (RLS) policies ensure users can only access their business data
- Business context is automatically set for all authenticated requests
- Cross-tenant data access is prevented at the database level

## 📧 Email Templates

### Welcome Email
Sent to new users after registration with email verification link.

### Invitation Email
Sent to invited users with invitation acceptance link.

### Password Reset Email
Sent to users requesting password reset with secure reset link.

## 🚨 Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Invalid email or password |
| `TOKEN_EXPIRED` | Authentication token has expired |
| `TOKEN_INVALID` | Invalid authentication token |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions for operation |
| `BUSINESS_NOT_FOUND` | Business not found or access denied |
| `USER_NOT_FOUND` | User not found |
| `EMAIL_ALREADY_EXISTS` | Email address is already registered |
| `SLUG_ALREADY_EXISTS` | Business slug is already taken |
| `INVITATION_EXPIRED` | Invitation link has expired |
| `INVITATION_INVALID` | Invalid invitation token |
| `EMAIL_NOT_VERIFIED` | Email address not verified |
| `ACCOUNT_SUSPENDED` | Account has been suspended |
| `PASSWORD_TOO_WEAK` | Password does not meet requirements |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INVALID_INPUT` | Invalid input provided |

## 🧪 Testing

### Running Tests
```bash
npm run test:auth
```

### Test Coverage
- Authentication flow (register, login, logout)
- Email verification
- Password reset
- User invitation workflow
- Role-based access control
- Security features
- Multi-tenant isolation

## 🔧 Configuration

### Environment Variables
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-different-refresh-secret-min-32-chars

# Password Security
BCRYPT_ROUNDS=12

# Email Configuration
EMAIL_FROM=noreply@voca-ai.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASS=your-app-password

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
INVITATION_EXPIRES_HOURS=72
```

## 📱 Frontend Integration

### Login Flow
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const data = await response.json();
if (data.success) {
  localStorage.setItem('access_token', data.data.tokens.accessToken);
  localStorage.setItem('refresh_token', data.data.tokens.refreshToken);
}
```

### Authenticated Requests
```javascript
const response = await fetch('/api/users', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

### Token Refresh
```javascript
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: localStorage.getItem('refresh_token') })
});
```

## 🚀 Deployment

### Production Checklist
- [ ] Set strong JWT secrets (32+ characters)
- [ ] Configure email service (SendGrid, AWS SES, etc.)
- [ ] Set up SSL/TLS certificates
- [ ] Configure CORS for production domains
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Test all authentication flows
- [ ] Verify multi-tenant isolation

### Security Best Practices
- Use HTTPS in production
- Implement proper CORS policies
- Set secure cookie flags
- Use environment variables for secrets
- Regular security audits
- Monitor for suspicious activity
- Implement account lockout policies
- Use strong password policies


