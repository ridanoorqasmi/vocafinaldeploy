/**
 * Test Setup File
 * Global test configuration and utilities
 */

import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Global test timeout
beforeAll(() => {
  // Set global test timeout
  process.env.TEST_TIMEOUT = '30000';
});

afterAll(async () => {
  // Clean up any global resources
  const prisma = new PrismaClient();
  await prisma.$disconnect();
});
