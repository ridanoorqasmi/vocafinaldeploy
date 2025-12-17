# 🚀 Quick Start Guide - Authentication System

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** database running
3. **Environment variables** configured

## ⚡ Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env.local` file in your project root:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/voca_order_taking"

# JWT Configuration (REQUIRED)
JWT_SECRET="your-super-secret-jwt-key-min-32-chars-change-in-production-12345"
JWT_REFRESH_SECRET="your-different-refresh-secret-min-32-chars-change-in-production-67890"

# Password Security
BCRYPT_ROUNDS=12

# Email Configuration (Optional for testing)
EMAIL_FROM="noreply@voca-ai.com"
EMAIL_SMTP_HOST="smtp.gmail.com"
EMAIL_SMTP_PORT="587"
EMAIL_SMTP_USER=""
EMAIL_SMTP_PASS=""

# Frontend Configuration
FRONTEND_URL="http://localhost:3000"
INVITATION_EXPIRES_HOURS=72
```

### 3. Start Development Server
```bash
npm run dev
```

## 🧪 Test the API

### Test Registration Endpoint

**Using Postman:**
1. **Method:** POST
2. **URL:** `http://localhost:3000/api/auth/register`
3. **Headers:** `Content-Type: application/json`
4. **Body (JSON):**
```json
{
  "businessName": "Test Restaurant",
  "businessSlug": "test-restaurant-123",
  "industry": "Food & Beverage",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@testrestaurant.com",
  "password": "SecurePassword123!",
  "phone": "+1-555-123-4567",
  "timezone": "America/New_York"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@testrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true
    },
    "business": {
      "id": "business_456",
      "name": "Test Restaurant",
      "slug": "test-restaurant-123",
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

### Test Login Endpoint

**Using Postman:**
1. **Method:** POST
2. **URL:** `http://localhost:3000/api/auth/login`
3. **Headers:** `Content-Type: application/json`
4. **Body (JSON):**
```json
{
  "email": "john@testrestaurant.com",
  "password": "SecurePassword123!"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "john@testrestaurant.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true
    },
    "business": {
      "id": "business_456",
      "name": "Test Restaurant",
      "slug": "test-restaurant-123",
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

## 🔧 Troubleshooting

### Common Issues

**1. 500 Internal Server Error**
- Check if database is running
- Verify DATABASE_URL is correct
- Check JWT_SECRET is set (32+ characters)

**2. Email Service Errors**
- Email service is optional for testing
- Set EMAIL_SMTP_USER and EMAIL_SMTP_PASS if you want emails
- Or leave them empty to skip email sending

**3. Database Connection Issues**
- Ensure PostgreSQL is running
- Check database credentials
- Verify database exists

**4. JWT Token Errors**
- Ensure JWT_SECRET and JWT_REFRESH_SECRET are set
- Secrets must be at least 32 characters long
- Use different secrets for access and refresh tokens

### Quick Fixes

**Reset Database:**
```bash
npm run db:push
npm run db:seed
```

**Check Logs:**
```bash
# Check terminal output for error messages
# Look for specific error details
```

**Test Database Connection:**
```bash
npm run db:studio
```

## 📊 Available Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new business | ❌ |
| POST | `/api/auth/login` | User login | ❌ |
| POST | `/api/auth/logout` | User logout | ✅ |
| GET | `/api/auth/me` | Get current user | ✅ |
| GET | `/api/users` | List users | ✅ |
| POST | `/api/users` | Invite user | ✅ |

## 🎯 Next Steps

1. **Test all endpoints** using Postman
2. **Verify database** records are created
3. **Test authentication** flow end-to-end
4. **Configure email service** (optional)
5. **Deploy to production** when ready

## 📞 Support

If you encounter issues:
1. Check the terminal output for error messages
2. Verify all environment variables are set
3. Ensure database is running and accessible
4. Check the API documentation for detailed endpoint info

**Happy Testing! 🚀**
