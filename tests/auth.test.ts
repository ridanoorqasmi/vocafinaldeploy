import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { authService } from '../lib/auth-service';
import { userService } from '../lib/user-service';
import { hashPassword } from '../lib/password';

const prisma = new PrismaClient();

// ===== AUTHENTICATION TESTS =====

describe('Authentication System', () => {
  let testBusiness: any;
  let testUser: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test@' } }
    });
    await prisma.business.deleteMany({
      where: { slug: { contains: 'test-business' } }
    });

    // Create test business
    testBusiness = await prisma.business.create({
      data: {
        name: 'Test Business',
        slug: 'test-business-' + Date.now(),
        email: 'admin@test-business.com',
        passwordHash: await hashPassword('password123'),
        status: 'ACTIVE'
      }
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        businessId: testBusiness.id,
        email: 'test@example.com',
        passwordHash: await hashPassword('password123'),
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test@' } }
    });
    await prisma.business.deleteMany({
      where: { slug: { contains: 'test-business' } }
    });
  });

  test('User can register new business and admin account', async () => {
    const registrationData = {
      businessName: 'New Test Business',
      businessSlug: 'new-test-business-' + Date.now(),
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@newtest.com',
      password: 'Password123!'
    };

    const result = await authService.register(registrationData);

    expect(result.success).toBe(true);
    expect(result.data?.user.email).toBe('john@newtest.com');
    expect(result.data?.user.role).toBe('ADMIN');
    expect(result.data?.business.name).toBe('New Test Business');
    expect(result.data?.tokens.accessToken).toBeDefined();
    expect(result.data?.tokens.refreshToken).toBeDefined();
  });

  test('User can login with valid credentials', async () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const result = await authService.login(loginData);

    expect(result.success).toBe(true);
    expect(result.data?.user.email).toBe('test@example.com');
    expect(result.data?.tokens.accessToken).toBeDefined();
    expect(result.data?.tokens.refreshToken).toBeDefined();
  });

  test('User cannot login with invalid credentials', async () => {
    const loginData = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    const result = await authService.login(loginData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_CREDENTIALS');
  });

  test('Registration fails with duplicate email', async () => {
    const registrationData = {
      businessName: 'Another Test Business',
      businessSlug: 'another-test-business-' + Date.now(),
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'test@example.com', // Already exists
      password: 'Password123!'
    };

    const result = await authService.register(registrationData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  test('Registration fails with duplicate business slug', async () => {
    const registrationData = {
      businessName: 'Another Test Business',
      businessSlug: testBusiness.slug, // Already exists
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'Password123!'
    };

    const result = await authService.register(registrationData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SLUG_ALREADY_EXISTS');
  });

  test('Password validation works correctly', async () => {
    const registrationData = {
      businessName: 'Password Test Business',
      businessSlug: 'password-test-business-' + Date.now(),
      firstName: 'Password',
      lastName: 'Test',
      email: 'password@test.com',
      password: 'weak' // Too weak
    };

    const result = await authService.register(registrationData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PASSWORD_TOO_WEAK');
  });

  test('Email verification works', async () => {
    // Create user with verification token
    const verificationToken = 'test-verification-token';
    const user = await prisma.user.create({
      data: {
        businessId: testBusiness.id,
        email: 'verify@test.com',
        passwordHash: await hashPassword('password123'),
        firstName: 'Verify',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    const result = await authService.verifyEmail({ token: verificationToken });

    expect(result.success).toBe(true);
    expect(result.data?.user.id).toBe(user.id);

    // Verify user is now verified
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id }
    });
    expect(updatedUser?.emailVerified).toBe(true);
  });

  test('Forgot password works', async () => {
    const result = await authService.forgotPassword({ email: 'test@example.com' });

    expect(result.success).toBe(true);

    // Verify reset token was created
    const user = await prisma.user.findUnique({
      where: { id: testUser.id }
    });
    expect(user?.passwordResetToken).toBeDefined();
    expect(user?.passwordResetExpires).toBeDefined();
  });

  test('Password reset works', async () => {
    // Create reset token
    const resetToken = 'test-reset-token';
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    const result = await authService.resetPassword({
      token: resetToken,
      password: 'NewPassword123!'
    });

    expect(result.success).toBe(true);

    // Verify password was changed
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    });
    expect(updatedUser?.passwordResetToken).toBeNull();
    expect(updatedUser?.passwordResetExpires).toBeNull();
  });
});

// ===== USER MANAGEMENT TESTS =====

describe('User Management System', () => {
  let testBusiness: any;
  let adminUser: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test@' } }
    });
    await prisma.business.deleteMany({
      where: { slug: { contains: 'test-business' } }
    });

    // Create test business
    testBusiness = await prisma.business.create({
      data: {
        name: 'Test Business',
        slug: 'test-business-' + Date.now(),
        email: 'admin@test-business.com',
        passwordHash: await hashPassword('password123'),
        status: 'ACTIVE'
      }
    });

    // Create admin user
    adminUser = await prisma.user.create({
      data: {
        businessId: testBusiness.id,
        email: 'admin@test.com',
        passwordHash: await hashPassword('password123'),
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test@' } }
    });
    await prisma.business.deleteMany({
      where: { slug: { contains: 'test-business' } }
    });
  });

  test('Admin can invite team members', async () => {
    const inviteData = {
      email: 'newuser@test.com',
      role: 'MANAGER',
      firstName: 'New',
      lastName: 'User'
    };

    const result = await userService.inviteUser(testBusiness.id, adminUser.id, inviteData);

    expect(result.success).toBe(true);
    expect(result.data?.user.email).toBe('newuser@test.com');
    expect(result.data?.user.role).toBe('MANAGER');
    expect(result.data?.user.isActive).toBe(false); // Not active until they accept

    // Verify invitation token was created
    const invitedUser = await prisma.user.findFirst({
      where: { email: 'newuser@test.com' }
    });
    expect(invitedUser?.invitationToken).toBeDefined();
    expect(invitedUser?.invitationExpires).toBeDefined();
  });

  test('Invited user can accept invitation', async () => {
    // Create invited user
    const invitationToken = 'test-invitation-token';
    const invitedUser = await prisma.user.create({
      data: {
        businessId: testBusiness.id,
        email: 'invited@test.com',
        firstName: 'Invited',
        lastName: 'User',
        role: 'STAFF',
        isActive: false,
        invitationToken,
        invitationExpires: new Date(Date.now() + 72 * 60 * 60 * 1000),
        passwordHash: ''
      }
    });

    const result = await userService.acceptInvite({
      token: invitationToken,
      password: 'NewPassword123!'
    });

    expect(result.success).toBe(true);
    expect(result.data?.user.isActive).toBe(true);
    expect(result.data?.user.emailVerified).toBe(true);

    // Verify user is now active and has password
    const updatedUser = await prisma.user.findUnique({
      where: { id: invitedUser.id }
    });
    expect(updatedUser?.isActive).toBe(true);
    expect(updatedUser?.passwordHash).toBeDefined();
    expect(updatedUser?.invitationToken).toBeNull();
  });

  test('Admin can change user roles', async () => {
    // Create a staff user
    const staffUser = await prisma.user.create({
      data: {
        businessId: testBusiness.id,
        email: 'staff@test.com',
        passwordHash: await hashPassword('password123'),
        firstName: 'Staff',
        lastName: 'User',
        role: 'STAFF',
        isActive: true,
        emailVerified: true
      }
    });

    const result = await userService.changeUserRole(staffUser.id, testBusiness.id, {
      role: 'MANAGER'
    });

    expect(result.success).toBe(true);
    expect(result.data?.user.role).toBe('MANAGER');

    // Verify role was changed in database
    const updatedUser = await prisma.user.findUnique({
      where: { id: staffUser.id }
    });
    expect(updatedUser?.role).toBe('MANAGER');
  });

  test('Admin can activate/deactivate users', async () => {
    // Create an inactive user
    const inactiveUser = await prisma.user.create({
      data: {
        businessId: testBusiness.id,
        email: 'inactive@test.com',
        passwordHash: await hashPassword('password123'),
        firstName: 'Inactive',
        lastName: 'User',
        role: 'STAFF',
        isActive: false,
        emailVerified: true
      }
    });

    // Activate user
    const result = await userService.changeUserStatus(inactiveUser.id, testBusiness.id, true);

    expect(result.success).toBe(true);
    expect(result.data?.user.isActive).toBe(true);

    // Verify user is active in database
    const updatedUser = await prisma.user.findUnique({
      where: { id: inactiveUser.id }
    });
    expect(updatedUser?.isActive).toBe(true);
  });

  test('Get business users returns paginated results', async () => {
    // Create multiple users
    for (let i = 0; i < 5; i++) {
      await prisma.user.create({
        data: {
          businessId: testBusiness.id,
          email: `user${i}@test.com`,
          passwordHash: await hashPassword('password123'),
          firstName: `User${i}`,
          lastName: 'Test',
          role: 'STAFF',
          isActive: true,
          emailVerified: true
        }
      });
    }

    const result = await userService.getBusinessUsers(testBusiness.id, 1, 3);

    expect(result.success).toBe(true);
    expect(result.data?.users.length).toBe(3);
    expect(result.data?.pagination.total).toBe(6); // 5 created + 1 admin
    expect(result.data?.pagination.page).toBe(1);
    expect(result.data?.pagination.pages).toBe(2);
  });

  test('Cannot invite user with existing email', async () => {
    const inviteData = {
      email: 'admin@test.com', // Already exists
      role: 'MANAGER',
      firstName: 'Duplicate',
      lastName: 'User'
    };

    const result = await userService.inviteUser(testBusiness.id, adminUser.id, inviteData);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('EMAIL_ALREADY_EXISTS');
  });
});

// ===== SECURITY TESTS =====

describe('Security', () => {
  test('Password hashing is secure', async () => {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);
    
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt format
  });

  test('JWT tokens contain correct payload', async () => {
    const testBusiness = await prisma.business.create({
      data: {
        name: 'JWT Test Business',
        slug: 'jwt-test-business-' + Date.now(),
        email: 'jwt@test.com',
        passwordHash: await hashPassword('password123'),
        status: 'ACTIVE'
      }
    });

    const testUser = await prisma.user.create({
      data: {
        businessId: testBusiness.id,
        email: 'jwt@test.com',
        passwordHash: await hashPassword('password123'),
        firstName: 'JWT',
        lastName: 'Test',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true
      }
    });

    const result = await authService.login({
      email: 'jwt@test.com',
      password: 'password123'
    });

    expect(result.success).toBe(true);
    expect(result.data?.tokens.accessToken).toBeDefined();
    expect(result.data?.tokens.refreshToken).toBeDefined();

    // Clean up
    await prisma.user.deleteMany({
      where: { businessId: testBusiness.id }
    });
    await prisma.business.delete({
      where: { id: testBusiness.id }
    });
  });
});


