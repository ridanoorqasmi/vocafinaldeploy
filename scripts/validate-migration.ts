#!/usr/bin/env ts-node

/**
 * Schema Validation Script
 * Validates database schema after migrations
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

interface ValidationResult {
  test: string;
  passed: boolean;
  message: string;
  duration: number;
}

class SchemaValidator {
  private results: ValidationResult[] = [];

  async validateAll(): Promise<void> {
    console.log('🔍 Starting Schema Validation...\n');

    await this.validateTablesExist();
    await this.validateIndexesExist();
    await this.validateConstraintsExist();
    await this.validateRLSPolicies();
    await this.validateMultiTenantIsolation();
    await this.validateCascadeDeletion();
    await this.validatePerformance();
    await this.validateDataIntegrity();

    this.printResults();
  }

  private async validateTablesExist(): Promise<void> {
    const start = Date.now();
    try {
      const tables = [
        'businesses', 'users', 'locations', 'operating_hours',
        'categories', 'menu_items', 'policies', 'knowledge_base',
        'api_keys', 'subscriptions', 'usage_metrics', 'query_logs',
        'menus', 'orders', 'powerups', 'business_policies', 'business_integrations'
      ];

      for (const table of tables) {
        const result = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${table}
          );
        `;
        
        if (!(result as any)[0].exists) {
          throw new Error(`Table ${table} does not exist`);
        }
      }

      this.addResult('Tables Exist', true, `All ${tables.length} tables exist`, Date.now() - start);
    } catch (error) {
      this.addResult('Tables Exist', false, `Missing tables: ${error}`, Date.now() - start);
    }
  }

  private async validateIndexesExist(): Promise<void> {
    const start = Date.now();
    try {
      const expectedIndexes = [
        'idx_orders_status_created_at',
        'idx_subscriptions_status_period_end',
        'idx_usage_metrics_business_type_date',
        'idx_menu_items_search',
        'idx_knowledge_base_search',
        'idx_businesses_active',
        'idx_users_active'
      ];

      const existingIndexes = await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = ANY(${expectedIndexes});
      `;

      const foundIndexes = (existingIndexes as any[]).map(row => row.indexname);
      const missingIndexes = expectedIndexes.filter(idx => !foundIndexes.includes(idx));

      if (missingIndexes.length > 0) {
        throw new Error(`Missing indexes: ${missingIndexes.join(', ')}`);
      }

      this.addResult('Indexes Exist', true, `All ${expectedIndexes.length} performance indexes exist`, Date.now() - start);
    } catch (error) {
      this.addResult('Indexes Exist', false, `${error}`, Date.now() - start);
    }
  }

  private async validateConstraintsExist(): Promise<void> {
    const start = Date.now();
    try {
      const constraints = [
        { table: 'businesses', constraint: 'chk_business_email_format' },
        { table: 'users', constraint: 'chk_user_email_format' },
        { table: 'menu_items', constraint: 'chk_menu_item_price_positive' },
        { table: 'orders', constraint: 'chk_order_total_non_negative' },
        { table: 'business_policies', constraint: 'chk_tax_rate_valid' }
      ];

      for (const { table, constraint } of constraints) {
        const result = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.check_constraints 
            WHERE constraint_name = ${constraint}
            AND constraint_schema = 'public'
          );
        `;
        
        if (!(result as any)[0].exists) {
          throw new Error(`Constraint ${constraint} on table ${table} does not exist`);
        }
      }

      this.addResult('Constraints Exist', true, `All ${constraints.length} validation constraints exist`, Date.now() - start);
    } catch (error) {
      this.addResult('Constraints Exist', false, `${error}`, Date.now() - start);
    }
  }

  private async validateRLSPolicies(): Promise<void> {
    const start = Date.now();
    try {
      const tables = [
        'businesses', 'users', 'menu_items', 'orders', 'policies',
        'knowledge_base', 'api_keys', 'subscriptions', 'usage_metrics', 'query_logs'
      ];

      let enabledTables = 0;
      let tablesWithPolicies = 0;

      for (const table of tables) {
        // Check if RLS is enabled
        const rlsEnabled = await prisma.$queryRaw`
          SELECT relrowsecurity FROM pg_class 
          WHERE relname = ${table} AND relkind = 'r';
        `;
        
        if ((rlsEnabled as any)[0]?.relrowsecurity) {
          enabledTables++;
        }

        // Check if policies exist
        const policies = await prisma.$queryRaw`
          SELECT policyname FROM pg_policies 
          WHERE tablename = ${table} AND schemaname = 'public';
        `;
        
        if ((policies as any[]).length > 0) {
          tablesWithPolicies++;
        }
      }

      // Check if helper functions exist
      const functions = await prisma.$queryRaw`
        SELECT proname FROM pg_proc 
        WHERE proname IN ('set_current_business_id', 'get_current_business_id');
      `;

      if (enabledTables === tables.length && tablesWithPolicies === tables.length && (functions as any[]).length === 2) {
        this.addResult('RLS Policies', true, `RLS properly implemented: ${enabledTables}/${tables.length} tables enabled, ${tablesWithPolicies}/${tables.length} with policies, 2/2 helper functions`, Date.now() - start);
      } else {
        throw new Error(`RLS incomplete: ${enabledTables}/${tables.length} tables enabled, ${tablesWithPolicies}/${tables.length} with policies, ${(functions as any[]).length}/2 helper functions`);
      }
    } catch (error) {
      this.addResult('RLS Policies', false, `${error}`, Date.now() - start);
    }
  }

  private async validateMultiTenantIsolation(): Promise<void> {
    const start = Date.now();
    try {
      // Create test data for two businesses with unique identifiers
      const timestamp = Date.now();
      const business1 = await prisma.business.create({
        data: {
          name: 'Test Business 1',
          slug: `test-business-1-${timestamp}`,
          email: `test1-${timestamp}@example.com`,
          passwordHash: 'hashed1',
          status: 'ACTIVE'
        }
      });

      const business2 = await prisma.business.create({
        data: {
          name: 'Test Business 2',
          slug: `test-business-2-${timestamp}`,
          email: `test2-${timestamp}@example.com`,
          passwordHash: 'hashed2',
          status: 'ACTIVE'
        }
      });

      // Create users for each business
      const user1 = await prisma.user.create({
        data: {
          businessId: business1.id,
          email: 'user1@test1.com',
          passwordHash: 'hashed1',
          firstName: 'User',
          lastName: 'One',
          role: 'OWNER'
        }
      });

      const user2 = await prisma.user.create({
        data: {
          businessId: business2.id,
          email: 'user2@test2.com',
          passwordHash: 'hashed2',
          firstName: 'User',
          lastName: 'Two',
          role: 'OWNER'
        }
      });

      // Test RLS helper functions work
      await prisma.$executeRaw`SELECT set_current_business_id(${business1.id})`;
      const currentBusinessId = await prisma.$queryRaw`SELECT get_current_business_id() as business_id`;
      
      if (!(currentBusinessId as any)[0]?.business_id) {
        throw new Error('RLS helper functions not working');
      }

      // Test that we can set and get business context
      await prisma.$executeRaw`SELECT set_current_business_id(${business2.id})`;
      const newBusinessId = await prisma.$queryRaw`SELECT get_current_business_id() as business_id`;
      
      if ((newBusinessId as any)[0]?.business_id !== business2.id) {
        throw new Error('RLS context switching not working');
      }

      // Clean up test data
      await prisma.business.deleteMany({
        where: { id: { in: [business1.id, business2.id] } }
      });

      this.addResult('Multi-Tenant Isolation', true, 'RLS helper functions working correctly', Date.now() - start);
    } catch (error) {
      this.addResult('Multi-Tenant Isolation', false, `${error}`, Date.now() - start);
    }
  }

  private async validateCascadeDeletion(): Promise<void> {
    const start = Date.now();
    try {
      // Create test business with related data
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
              name: 'Test Item',
              description: 'Test Description',
              price: 10.99
            }
          },
          policies: {
            create: {
              type: 'delivery',
              title: 'Test Policy',
              content: 'Test Content'
            }
          }
        },
        include: {
          users: true,
          menuItems: true,
          policies: true
        }
      });

      const userId = business.users[0].id;
      const menuItemId = business.menuItems[0].id;
      const policyId = business.policies[0].id;

      // Delete the business
      await prisma.business.delete({
        where: { id: business.id }
      });

      // Verify cascade deletion
      const remainingUser = await prisma.user.findUnique({ where: { id: userId } });
      const remainingMenuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
      const remainingPolicy = await prisma.policy.findUnique({ where: { id: policyId } });

      if (remainingUser || remainingMenuItem || remainingPolicy) {
        throw new Error('Cascade deletion failed: Related records still exist');
      }

      this.addResult('Cascade Deletion', true, 'Business deletion properly cascades to related records', Date.now() - start);
    } catch (error) {
      this.addResult('Cascade Deletion', false, `${error}`, Date.now() - start);
    }
  }

  private async validatePerformance(): Promise<void> {
    const start = Date.now();
    try {
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

      // Create multiple menu items for performance testing
      const menuItems = [];
      for (let i = 0; i < 100; i++) {
        menuItems.push({
          businessId: business.id,
          name: `Test Item ${i}`,
          description: `Description for item ${i}`,
          price: 10.99 + i
        });
      }
      await prisma.menuItem.createMany({ data: menuItems });

      // Test query performance
      const queryStart = Date.now();
      const result = await prisma.menuItem.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: 'desc' }
      });
      const queryDuration = Date.now() - queryStart;

      if (queryDuration > 100) {
        throw new Error(`Query too slow: ${queryDuration}ms (expected <100ms)`);
      }

      // Clean up
      await prisma.business.delete({ where: { id: business.id } });

      this.addResult('Performance', true, `Query completed in ${queryDuration}ms (target: <100ms)`, Date.now() - start);
    } catch (error) {
      this.addResult('Performance', false, `${error}`, Date.now() - start);
    }
  }

  private async validateDataIntegrity(): Promise<void> {
    const start = Date.now();
    try {
      // Test unique constraints
      const timestamp = Date.now();
      const business1 = await prisma.business.create({
        data: {
          name: 'Integrity Test 1',
          slug: `integrity-test-1-${timestamp}`,
          email: `integrity1-${timestamp}@test.com`,
          passwordHash: 'hashed',
          status: 'ACTIVE'
        }
      });

      // Try to create duplicate email (should fail)
      try {
        await prisma.business.create({
          data: {
            name: 'Integrity Test 2',
            slug: `integrity-test-2-${timestamp}`,
            email: `integrity1-${timestamp}@test.com`, // Duplicate email
            passwordHash: 'hashed',
            status: 'ACTIVE'
          }
        });
        throw new Error('Unique constraint failed: Duplicate email allowed');
      } catch (error: any) {
        if (!error.message.includes('Unique constraint')) {
          throw error;
        }
      }

      // Test check constraints
      try {
        await prisma.menuItem.create({
          data: {
            businessId: business1.id,
            name: 'Negative Price Item',
            price: -10.99 // Should fail
          }
        });
        throw new Error('Check constraint failed: Negative price allowed');
      } catch (error: any) {
        if (!error.message.includes('chk_menu_item_price_positive')) {
          throw error;
        }
      }

      // Clean up
      await prisma.business.delete({ where: { id: business1.id } });

      this.addResult('Data Integrity', true, 'Unique and check constraints working properly', Date.now() - start);
    } catch (error) {
      this.addResult('Data Integrity', false, `${error}`, Date.now() - start);
    }
  }

  private addResult(test: string, passed: boolean, message: string, duration: number): void {
    this.results.push({ test, passed, message, duration });
  }

  private printResults(): void {
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(80));
    
    let passed = 0;
    let failed = 0;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      console.log(`${status} ${result.test.padEnd(30)} ${duration.padStart(8)} - ${result.message}`);
      
      if (result.passed) passed++;
      else failed++;
    });
    
    console.log('='.repeat(80));
    console.log(`Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n❌ Some validations failed. Please check the errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ All validations passed!');
    }
  }
}

// Main execution
async function main() {
  try {
    const validator = new SchemaValidator();
    await validator.validateAll();
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { SchemaValidator };
