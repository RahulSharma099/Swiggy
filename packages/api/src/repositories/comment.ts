/**
 * Comment Repository
 * Data access layer for comment operations
 */

import { PrismaClient, Comment } from '@prisma/client';

export type CommentRepository = ReturnType<typeof createCommentRepository>;

/**
 * Create comment repository with data access functions
 */
export const createCommentRepository = (prisma: PrismaClient) => ({
  /**
   * Create a new comment on an issue
   */
  async create(
    issueId: string,
    authorId: string,
    content: string,
    mentions: string[] = []
  ): Promise<Comment> {
    return prisma.comment.create({
      data: {
        issueId,
        authorId,
        content,
        mentions: mentions as any,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  /**
   * Find comment by ID with author info
   */
  async findById(commentId: string): Promise<Comment | null> {
    return prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  /**
   * Get all comments for an issue
   */
  async findByIssueId(
    issueId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ comments: Comment[]; total: number }> {
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { issueId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.comment.count({ where: { issueId } }),
    ]);

    return { comments, total };
  },

  /**
   * Update comment content
   */
  async update(
    commentId: string,
    content: string,
    mentions: string[] = []
  ): Promise<Comment> {
    return prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
        mentions: mentions as any,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  /**
   * Delete a comment
   */
  async delete(commentId: string): Promise<void> {
    await prisma.comment.delete({
      where: { id: commentId },
    });
  },

  /**
   * Get comments by author
   */
  async findByAuthorId(
    authorId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Comment[]> {
    return prisma.comment.findMany({
      where: { authorId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
            projectId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  },

  /**
   * Get recent comments across workspace (activity feed)
   */
  async findRecentByWorkspace(
    workspaceId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Comment[]> {
    return prisma.comment.findMany({
      where: {
        issue: {
          project: {
            workspaceId,
          },
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
            projectId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  },

  /**
   * Search comments by content (simple substring match)
   */
  async search(
    issueId: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<Comment[]> {
    return prisma.comment.findMany({
      where: {
        issueId,
        content: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  /**
   * Get comment count for issue
   */
  async countByIssueId(issueId: string): Promise<number> {
    return prisma.comment.count({ where: { issueId } });
  },

  /**
   * Check if user is comment author
   */
  async isCommentAuthor(commentId: string, userId: string): Promise<boolean> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });
    return comment?.authorId === userId;
  },
});
