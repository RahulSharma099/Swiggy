import { PrismaClient, User, Prisma } from '@prisma/client';

/**
 * User Repository Factory
 * Provides data access functions for User operations
 */
export const createUserRepository = (prisma: PrismaClient) => ({
  /**
   * Create a new user
   */
  create: async (data: Prisma.UserCreateInput): Promise<User> => {
    return prisma.user.create({ data });
  },

  /**
   * Find user by ID
   */
  findById: async (id: string): Promise<User | null> => {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  /**
   * Find user by email
   */
  findByEmail: async (email: string): Promise<User | null> => {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  /**
   * Update user
   */
  update: async (id: string, data: Prisma.UserUpdateInput): Promise<User> => {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  /**
   * Delete user (cascade deletes memberships)
   */
  delete: async (id: string): Promise<User> => {
    return prisma.user.delete({
      where: { id },
    });
  },

  /**
   * Get users by IDs
   */
  findByIds: async (ids: string[]): Promise<User[]> => {
    return prisma.user.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  },

  /**
   * Get all users (paginate)
   */
  findAll: async (limit: number = 10, offset: number = 0): Promise<User[]> => {
    return prisma.user.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Count users
   */
  count: async (): Promise<number> => {
    return prisma.user.count();
  },

  /**
   * Search users by name or email
   */
  search: async (query: string): Promise<User[]> => {
    return prisma.user.findMany({
      where: {
        OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }],
      },
      take: 20,
    });
  },
});

// Type export for service layer
export type UserRepository = ReturnType<typeof createUserRepository>;
