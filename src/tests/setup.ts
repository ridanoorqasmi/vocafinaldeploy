import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Global test setup
beforeAll(async () => {
  // Ensure database is connected
  await prisma.$connect();
});

afterAll(async () => {
  // Clean up database connection
  await prisma.$disconnect();
});

// Global test utilities
global.prisma = prisma;
