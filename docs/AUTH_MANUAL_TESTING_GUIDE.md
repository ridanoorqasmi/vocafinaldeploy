# 🧪 Authentication System Manual Testing Guide

## 📋 Overview

This guide provides step-by-step instructions for manually testing the authentication and user management system. Follow these tests to ensure all features work correctly before deployment.

## 🚀 Setup

### Prerequisites
1. Database is running and seeded
2. Environment variables are configured
3. Email service is set up (optional for testing)
4. Development server is running

### Environment Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# In another terminal, run tests
npm run test:auth
```

## 🔐 Authentication Flow Tests

### Test 1: Business Registration

**Objective:** Verify new business registration works correctly.

**Steps:**
1. Open Postman or curl
2. Send POST request to `http://localhost:3000/api/auth/register`
3. Use this payload:
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

**Expected Results:**
- ✅ Status: 201 Created
- ✅ Response contains user data with role "ADMIN"
- ✅ Response contains business data with status "TRIAL"
- ✅ Response contains access and refresh tokens
- ✅ Business and user created in database
- ✅ Welcome email sent (if email service configured)

**Validation:**
```bash
# Check database
npm run db:studio
# Verify business and user records exist
```

### Test 2: User Login

**Objective:** Verify user can login with valid credentials.

**Steps:**
1. Use credentials from Test 1
2. Send POST request to `http://localhost:3000/api/auth/login`
3. Use this payload:
```json
{
  "email": "john@testrestaurant.com",
  "password": "SecurePassword123!"
}
```

**Expected Results:**
- ✅ Status: 200 OK
- ✅ Response contains user and business data
- ✅ Response contains valid JWT tokens
- ✅ Last login time updated in database

### Test 3: Invalid Login Attempts

**Objective:** Verify security measures work correctly.

**Test Cases:**
1. **Wrong Password:**
```json
{
  "email": "john@testrestaurant.com",
  "password": "wrongpassword"
}
```
Expected: 401 Unauthorized

2. **Non-existent Email:**
```json
{
  "email": "nonexistent@test.com",
  "password": "SecurePassword123!"
}
```
Expected: 401 Unauthorized

3. **Empty Fields:**
```json
{
  "email": "",
  "password": ""
}
```
Expected: 400 Bad Request

### Test 4: Get Current User

**Objective:** Verify JWT authentication works.

**Steps:**
1. Use access token from Test 2
2. Send GET request to `http://localhost:3000/api/auth/me`
3. Add header: `Authorization: Bearer <access_token>`

**Expected Results:**
- ✅ Status: 200 OK
- ✅ Response contains current user data
- ✅ Response contains business data

### Test 5: Token Validation

**Objective:** Verify JWT token security.

**Test Cases:**
1. **Valid Token:** Should return user data
2. **Expired Token:** Should return 401 Unauthorized
3. **Invalid Token:** Should return 401 Unauthorized
4. **No Token:** Should return 401 Unauthorized

## 👥 User Management Tests

### Test 6: Invite User

**Objective:** Verify admin can invite team members.

**Steps:**
1. Login as admin (from Test 2)
2. Send POST request to `http://localhost:3000/api/users`
3. Use this payload:
```json
{
  "email": "manager@testrestaurant.com",
  "role": "MANAGER",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Expected Results:**
- ✅ Status: 201 Created
- ✅ User created with isActive: false
- ✅ Invitation token generated
- ✅ Invitation email sent (if configured)

### Test 7: Accept Invitation

**Objective:** Verify invited user can accept invitation.

**Steps:**
1. Get invitation token from database or email
2. Send POST request to `http://localhost:3000/api/users/invite`
3. Use this payload:
```json
{
  "token": "<invitation_token>",
  "password": "NewPassword123!"
}
```

**Expected Results:**
- ✅ Status: 200 OK
- ✅ User activated (isActive: true)
- ✅ Password set
- ✅ Email verified automatically

### Test 8: List Users

**Objective:** Verify user listing with pagination.

**Steps:**
1. Login as admin
2. Send GET request to `http://localhost:3000/api/users`
3. Try with query parameters: `?page=1&limit=10`

**Expected Results:**
- ✅ Status: 200 OK
- ✅ Response contains users array
- ✅ Response contains pagination info
- ✅ Only users from same business returned

### Test 9: Update User

**Objective:** Verify user information can be updated.

**Steps:**
1. Login as admin
2. Send PUT request to `http://localhost:3000/api/users/{userId}`
3. Use this payload:
```json
{
  "firstName": "John Updated",
  "lastName": "Doe Updated",
  "email": "john.updated@testrestaurant.com"
}
```

**Expected Results:**
- ✅ Status: 200 OK
- ✅ User data updated in database
- ✅ Response contains updated user data

### Test 10: Change User Role

**Objective:** Verify admin can change user roles.

**Steps:**
1. Login as admin
2. Send PUT request to `http://localhost:3000/api/users/{userId}/role`
3. Use this payload:
```json
{
  "role": "STAFF"
}
```

**Expected Results:**
- ✅ Status: 200 OK
- ✅ User role updated in database
- ✅ Response contains updated user data

### Test 11: Activate/Deactivate User

**Objective:** Verify admin can manage user status.

**Steps:**
1. Login as admin
2. Send PUT request to `http://localhost:3000/api/users/{userId}/status`
3. Use this payload:
```json
{
  "isActive": false
}
```

**Expected Results:**
- ✅ Status: 200 OK
- ✅ User status updated in database
- ✅ Deactivated user cannot login

## 🔒 Security Tests

### Test 12: Role-Based Access Control

**Objective:** Verify role permissions work correctly.

**Test Cases:**
1. **Admin Access:** Should access all endpoints
2. **Manager Access:** Should access most endpoints, not admin-only
3. **Staff Access:** Should access limited endpoints
4. **Cross-Business Access:** Should be blocked

**Steps:**
1. Create users with different roles
2. Test each endpoint with different role tokens
3. Verify appropriate access granted/denied

### Test 13: Multi-Tenant Isolation

**Objective:** Verify users can only access their business data.

**Steps:**
1. Create two businesses with users
2. Login as user from Business A
3. Try to access data from Business B
4. Verify access is blocked

**Expected Results:**
- ✅ Users can only see their business data
- ✅ Cross-tenant access returns 403 Forbidden
- ✅ RLS policies working correctly

### Test 14: Rate Limiting

**Objective:** Verify rate limiting prevents abuse.

**Steps:**
1. Send multiple login requests rapidly
2. Verify rate limiting kicks in after 5 attempts
3. Wait 15 minutes and try again

**Expected Results:**
- ✅ After 5 failed attempts: 429 Too Many Requests
- ✅ Rate limiting resets after window period

### Test 15: Password Security

**Objective:** Verify password requirements and hashing.

**Test Cases:**
1. **Weak Password:** Should be rejected
2. **Strong Password:** Should be accepted
3. **Password Hashing:** Should be secure

**Steps:**
1. Try registration with weak passwords
2. Verify strong passwords are accepted
3. Check database for hashed passwords

## 📧 Email Tests

### Test 16: Email Verification

**Objective:** Verify email verification flow works.

**Steps:**
1. Register new user
2. Check email for verification link
3. Click verification link or use token in API
4. Verify user can login after verification

### Test 17: Password Reset

**Objective:** Verify password reset flow works.

**Steps:**
1. Send forgot password request
2. Check email for reset link
3. Use reset token to set new password
4. Verify user can login with new password

### Test 18: User Invitations

**Objective:** Verify invitation emails work.

**Steps:**
1. Invite new user
2. Check email for invitation link
3. Use invitation token to accept
4. Verify user can login

## 🧪 Automated Testing

### Run Test Suite
```bash
# Run all auth tests
npm run test:auth

# Run with coverage
npm run test:auth -- --coverage

# Run specific test
npm run test:auth -- --grep "User can login"
```

### Test Results Validation
- ✅ All tests pass
- ✅ No console errors
- ✅ Database state is correct
- ✅ JWT tokens are valid
- ✅ Email sending works (if configured)

## 🐛 Common Issues & Solutions

### Issue 1: JWT Token Invalid
**Solution:** Check JWT_SECRET environment variable

### Issue 2: Email Not Sending
**Solution:** Verify email service configuration

### Issue 3: Database Connection Error
**Solution:** Check DATABASE_URL and ensure database is running

### Issue 4: Rate Limiting Too Strict
**Solution:** Adjust rate limiting configuration

### Issue 5: RLS Policies Not Working
**Solution:** Verify RLS is enabled and policies are applied

## 📊 Performance Testing

### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Create load test script
artillery quick --count 100 --num 10 http://localhost:3000/api/auth/login
```

### Performance Benchmarks
- ✅ Auth endpoints respond in <200ms
- ✅ JWT verification takes <10ms
- ✅ Password hashing completes in <500ms
- ✅ Database queries use indexes efficiently

## ✅ Testing Checklist

### Authentication
- [ ] Registration works
- [ ] Login works
- [ ] Logout works
- [ ] Token validation works
- [ ] Password reset works
- [ ] Email verification works

### User Management
- [ ] User invitation works
- [ ] Invitation acceptance works
- [ ] User listing works
- [ ] User updates work
- [ ] Role changes work
- [ ] User activation/deactivation works

### Security
- [ ] Role-based access control works
- [ ] Multi-tenant isolation works
- [ ] Rate limiting works
- [ ] Password security works
- [ ] JWT security works

### Email
- [ ] Welcome emails work
- [ ] Invitation emails work
- [ ] Password reset emails work

### Performance
- [ ] Response times are acceptable
- [ ] Database queries are optimized
- [ ] No memory leaks
- [ ] Handles concurrent requests

## 🚀 Deployment Testing

### Pre-Deployment Checklist
- [ ] All manual tests pass
- [ ] All automated tests pass
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Email service configured
- [ ] SSL certificates installed
- [ ] CORS configured
- [ ] Rate limiting configured
- [ ] Monitoring set up

### Post-Deployment Testing
- [ ] Production endpoints work
- [ ] Email sending works
- [ ] Database connections work
- [ ] Performance is acceptable
- [ ] Security measures active
- [ ] Monitoring alerts configured

## 📝 Test Results Template

```
Test Date: ___________
Tester: ___________
Environment: ___________

Authentication Tests:
- Registration: ✅/❌
- Login: ✅/❌
- Logout: ✅/❌
- Token Validation: ✅/❌

User Management Tests:
- Invite User: ✅/❌
- Accept Invitation: ✅/❌
- List Users: ✅/❌
- Update User: ✅/❌

Security Tests:
- Role-Based Access: ✅/❌
- Multi-Tenant Isolation: ✅/❌
- Rate Limiting: ✅/❌
- Password Security: ✅/❌

Email Tests:
- Welcome Email: ✅/❌
- Invitation Email: ✅/❌
- Password Reset Email: ✅/❌

Performance:
- Response Times: ✅/❌
- Database Performance: ✅/❌
- Memory Usage: ✅/❌

Issues Found:
1. ___________
2. ___________
3. ___________

Overall Status: ✅ PASS / ❌ FAIL
```

This comprehensive testing guide ensures your authentication system is robust, secure, and ready for production use.


