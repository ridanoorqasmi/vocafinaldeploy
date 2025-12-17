/**
 * Schema Validation Tests
 * Comprehensive test suite for database schema, RLS, and performance
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

describe('Database Schema Tests', () => {
  let testBusiness1: any;
  let testBusiness2: any;

  beforeAll(async () => {
    // Ensure database is clean
    await prisma.business.deleteMany({
      where: {
        slug: { in: ['test-business-1', 'test-business-2', 'isolation-test-1', 'isolation-test-2'] }
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.business.deleteMany({
      where: {
        slug: { in: ['test-business-1', 'test-business-2', 'isolation-test-1', 'isolation-test-2'] }
      }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test businesses for each test
    testBusiness1 = await prisma.business.create({
      data: {
        name: 'Test Business 1',
        slug: 'test-business-1',
        email: 'test1@example.com',
        passwordHash: 'hashed1',
        status: 'ACTIVE'
      }
    });

    testBusiness2 = await prisma.business.create({
      data: {
        name: 'Test Business 2',
        slug: 'test-business-2',
        email: 'test2@example.com',
        passwordHash: 'hashed2',
        status: 'ACTIVE'
      }
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should prevent cross-tenant data access via RLS', async () => {
      // Create users for each business
      const user1 = await prisma.user.create({
        data: {
          businessId: testBusiness1.id,
          email: 'user1@test1.com',
          passwordHash: 'hashed1',
          firstName: 'User',
          lastName: 'One',
          role: 'OWNER'
        }
      });

      const user2 = await prisma.user.create({
        data: {
          businessId: testBusiness2.id,
          email: 'user2@test2.com',
          passwordHash: 'hashed2',
          firstName: 'User',
          lastName: 'Two',
          role: 'OWNER'
        }
      });

      // Set context for business 1
      await prisma.$executeRaw`SELECT set_current_business_id(${testBusiness1.id})`;

      // Business 1 should not see Business 2's data
      const business2Data = await prisma.$queryRaw`
        SELECT * FROM businesses WHERE id = ${testBusiness2.id};
      `;
      expect(business2Data).toHaveLength(0);

      // Business 1 should not see Business 2's users
      const user2Data = await prisma.$queryRaw`
        SELECT * FROM users WHERE id = ${user2.id};
      `;
      expect(user2Data).toHaveLength(0);

      // Business 1 should see its own data
      const business1Data = await prisma.$queryRaw`
        SELECT * FROM businesses WHERE id = ${testBusiness1.id};
      `;
      expect(business1Data).toHaveLength(1);

      // Business 1 should see its own users
      const user1Data = await prisma.$queryRaw`
        SELECT * FROM users WHERE id = ${user1.id};
      `;
      expect(user1Data).toHaveLength(1);
    });

    it('should isolate menu items between businesses', async () => {
      // Create menu items for each business
      const menuItem1 = await prisma.menuItem.create({
        data: {
          businessId: testBusiness1.id,
          name: 'Business 1 Item',
          price: 10.99
        }
      });

      const menuItem2 = await prisma.menuItem.create({
        data: {
          businessId: testBusiness2.id,
          name: 'Business 2 Item',
          price: 15.99
        }
      });

      // Set context for business 1
      await prisma.$executeRaw`SELECT set_current_business_id(${testBusiness1.id})`;

      // Business 1 should only see its own menu items
      const menuItems = await prisma.$queryRaw`
        SELECT * FROM menu_items WHERE business_id = ${testBusiness1.id};
      `;
      expect(menuItems).toHaveLength(1);
      expect((menuItems as any)[0].name).toBe('Business 1 Item');

      // Business 1 should not see Business 2's menu items
      const business2Items = await prisma.$queryRaw`
        SELECT * FROM menu_items WHERE business_id = ${testBusiness2.id};
      `;
      expect(business2Items).toHaveLength(0);
    });

    it('should isolate orders between businesses', async () => {
      // Create orders for each business
      const order1 = await prisma.order.create({
        data: {
          businessId: testBusiness1.id,
          customerName: 'Customer 1',
          customerContact: 'contact1@test.com',
          totalPrice: 25.99
        }
      });

      const order2 = await prisma.order.create({
        data: {
          businessId: testBusiness2.id,
          customerName: 'Customer 2',
          customerContact: 'contact2@test.com',
          totalPrice: 35.99
        }
      });

      // Set context for business 1
      await prisma.$executeRaw`SELECT set_current_business_id(${testBusiness1.id})`;

      // Business 1 should only see its own orders
      const orders = await prisma.$queryRaw`
        SELECT * FROM orders WHERE business_id = ${testBusiness1.id};
      `;
      expect(orders).toHaveLength(1);
      expect((orders as any)[0].customer_name).toBe('Customer 1');

      // Business 1 should not see Business 2's orders
      const business2Orders = await prisma.$queryRaw`
        SELECT * FROM orders WHERE business_id = ${testBusiness2.id};
      `;
      expect(business2Orders).toHaveLength(0);
    });
  });

  describe('Cascade Deletion', () => {
    it('should cascade delete related records when business is deleted', async () => {
      // Create business with related data
      const business = await prisma.business.create({
        data: {
          name: 'Cascade Test Business',
          slug: 'cascade-test',
          email: 'cascade@test.com',
          passwordHash: 'hashed',
          status: 'ACTIVE',
          users: {
            create: {
              email: 'cascade-user@test.com',
              passwordHash: 'hashed',
              firstName: 'Cascade',
              lastName: 'User',
              role: 'OWNER'
            }
          },
          menuItems: {
            create: {
              name: 'Cascade Test Item',
              description: 'Test Description',
              price: 10.99
            }
          },
          policies: {
            create: {
              type: 'delivery',
              title: 'Cascade Test Policy',
              content: 'Test Content'
            }
          },
          orders: {
            create: {
              customerName: 'Cascade Customer',
              customerContact: 'cascade@customer.com',
              totalPrice: 25.99
            }
          }
        },
        include: {
          users: true,
          menuItems: true,
          policies: true,
          orders: true
        }
      });

      const userId = business.users[0].id;
      const menuItemId = business.menuItems[0].id;
      const policyId = business.policies[0].id;
      const orderId = business.orders[0].id;

      // Delete the business
      await prisma.business.delete({
        where: { id: business.id }
      });

      // Verify cascade deletion
      const remainingUser = await prisma.user.findUnique({ where: { id: userId } });
      const remainingMenuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
      const remainingPolicy = await prisma.policy.findUnique({ where: { id: policyId } });
      const remainingOrder = await prisma.order.findUnique({ where: { id: orderId } });

      expect(remainingUser).toBeNull();
      expect(remainingMenuItem).toBeNull();
      expect(remainingPolicy).toBeNull();
      expect(remainingOrder).toBeNull();
    });

    it('should handle soft deletes properly', async () => {
      // Create a business
      const business = await prisma.business.create({
        data: {
          name: 'Soft Delete Test',
          slug: 'soft-delete-test',
          email: 'softdelete@test.com',
          passwordHash: 'hashed',
          status: 'ACTIVE'
        }
      });

      // Soft delete the business
      await prisma.business.update({
        where: { id: business.id },
        data: { deletedAt: new Date() }
      });

      // Business should still exist but be marked as deleted
      const deletedBusiness = await prisma.business.findUnique({
        where: { id: business.id }
      });

      expect(deletedBusiness).not.toBeNull();
      expect(deletedBusiness?.deletedAt).not.toBeNull();

      // Hard delete should remove the record
      await prisma.business.delete({
        where: { id: business.id }
      });

      const hardDeletedBusiness = await prisma.business.findUnique({
        where: { id: business.id }
      });

      expect(hardDeletedBusiness).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    it('should complete queries within 100ms for seeded data', async () => {
      // Create test data
      const business = await prisma.business.create({
        data: {
          name: 'Performance Test Business',
          slug: 'perf-test',
          email: 'perf@test.com',
          passwordHash: 'hashed',
          status: 'ACTIVE'
        }
      });

      // Create multiple menu items
      const menuItems = [];
      for (let i = 0; i < 100; i++) {
        menuItems.push({
          businessId: business.id,
          name: `Performance Test Item ${i}`,
          description: `Description for performance test item ${i}`,
          price: 10.99 + i
        });
      }
      await prisma.menuItem.createMany({ data: menuItems });

      // Test query performance
      const start = Date.now();
      const result = await prisma.menuItem.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: 'desc' }
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result).toHaveLength(100);

      // Clean up
      await prisma.business.delete({ where: { id: business.id } });
    });

    it('should use indexes for common query patterns', async () => {
      // Create test data
      const business = await prisma.business.create({
        data: {
          name: 'Index Test Business',
          slug: 'index-test',
          email: 'index@test.com',
          passwordHash: 'hashed',
          status: 'ACTIVE'
        }
      });

      // Create orders with different statuses
      const orders = [];
      for (let i = 0; i < 50; i++) {
        orders.push({
          businessId: business.id,
          customerName: `Customer ${i}`,
          customerContact: `customer${i}@test.com`,
          status: i % 2 === 0 ? 'PENDING' : 'CONFIRMED',
          totalPrice: 10.99 + i
        });
      }
      await prisma.order.createMany({ data: orders });

      // Test index usage for status + created_at query
      const start = Date.now();
      const result = await prisma.$queryRaw`
        SELECT * FROM orders 
        WHERE business_id = ${business.id} 
        AND status = 'PENDING' 
        ORDER BY created_at DESC;
      `;
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result).toHaveLength(25); // Half should be PENDING

      // Clean up
      await prisma.business.delete({ where: { id: business.id } });
    });
  });

  describe('Data Integrity Tests', () => {
    it('should enforce unique constraints', async () => {
      // Create business with unique email
      await prisma.business.create({
        data: {
          name: 'Unique Test 1',
          slug: 'unique-test-1',
          email: 'unique@test.com',
          passwordHash: 'hashed',
          status: 'ACTIVE'
        }
      });

      // Try to create another business with same email (should fail)
      await expect(
        prisma.business.create({
          data: {
            name: 'Unique Test 2',
            slug: 'unique-test-2',
            email: 'unique@test.com', // Duplicate email
            passwordHash: 'hashed',
            status: 'ACTIVE'
          }
        })
      ).rejects.toThrow();

      // Try to create another business with same slug (should fail)
      await expect(
        prisma.business.create({
          data: {
            name: 'Unique Test 3',
            slug: 'unique-test-1', // Duplicate slug
            email: 'unique3@test.com',
            passwordHash: 'hashed',
            status: 'ACTIVE'
          }
        })
      ).rejects.toThrow();
    });

    it('should enforce check constraints', async () => {
      // Test negative price constraint
      await expect(
        prisma.menuItem.create({
          data: {
            businessId: testBusiness1.id,
            name: 'Negative Price Item',
            price: -10.99 // Should fail
          }
        })
      ).rejects.toThrow();

      // Test negative order total constraint
      await expect(
        prisma.order.create({
          data: {
            businessId: testBusiness1.id,
            customerName: 'Test Customer',
            customerContact: 'test@customer.com',
            totalPrice: -5.99 // Should fail
          }
        })
      ).rejects.toThrow();

      // Test invalid tax rate constraint
      await expect(
        prisma.businessPolicy.create({
          data: {
            businessId: testBusiness1.id,
            deliveryZones: [],
            taxRate: 150.00 // Should fail (>100%)
          }
        })
      ).rejects.toThrow();
    });

    it('should enforce email format validation', async () => {
      // Test invalid email format
      await expect(
        prisma.business.create({
          data: {
            name: 'Invalid Email Test',
            slug: 'invalid-email-test',
            email: 'invalid-email', // Invalid format
            passwordHash: 'hashed',
            status: 'ACTIVE'
          }
        })
      ).rejects.toThrow();
    });

    it('should enforce phone format validation', async () => {
      // Test invalid phone format
      await expect(
        prisma.business.create({
          data: {
            name: 'Invalid Phone Test',
            slug: 'invalid-phone-test',
            email: 'phone@test.com',
            passwordHash: 'hashed',
            status: 'ACTIVE',
            phone: '123' // Too short
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Full-Text Search', () => {
    it('should perform full-text search on menu items', async () => {
      // Create menu items with searchable content
      const business = await prisma.business.create({
        data: {
          name: 'Search Test Business',
          slug: 'search-test',
          email: 'search@test.com',
          passwordHash: 'hashed',
          status: 'ACTIVE'
        }
      });

      await prisma.menuItem.createMany({
        data: [
          {
            businessId: business.id,
            name: 'Delicious Pizza',
            description: 'A mouth-watering pizza with fresh ingredients',
            price: 15.99
          },
          {
            businessId: business.id,
            name: 'Spicy Burger',
            description: 'A hot and spicy burger with jalapeños',
            price: 12.99
          },
          {
            businessId: business.id,
            name: 'Fresh Salad',
            description: 'A healthy salad with fresh vegetables',
            price: 8.99
          }
        ]
      });

      // Test full-text search
      const searchResults = await prisma.$queryRaw`
        SELECT name, description, ts_rank(to_tsvector('english', name || ' ' || COALESCE(description, '')), plainto_tsquery('english', 'spicy')) as rank
        FROM menu_items 
        WHERE business_id = ${business.id}
        AND to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', 'spicy')
        ORDER BY rank DESC;
      `;

      expect(searchResults).toHaveLength(1);
      expect((searchResults as any)[0].name).toBe('Spicy Burger');

      // Clean up
      await prisma.business.delete({ where: { id: business.id } });
    });
  });
});
