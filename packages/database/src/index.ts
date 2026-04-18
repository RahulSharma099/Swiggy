import { PrismaClient } from '@prisma/client';

// Singleton instance of Prisma Client
let prismaInstance: PrismaClient | null = null;

/**
 * Factory function to get or create Prisma Client instance
 * Ensures singleton pattern for database connections
 */
export const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
};

// Default export for backward compatibility
export const prisma = getPrismaClient();

// Export Prisma types for convenience
export * from '@prisma/client';
