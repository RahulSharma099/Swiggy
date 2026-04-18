import { Request, Response } from 'express';
import { PrismaClient } from '@pms/database';
import { z } from 'zod';
import { AppError } from '@pms/shared';

/**
 * Create handler factory for creating a comment on an issue
 */
export const createCreateCommentHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const schema = z.object({
      issueId: z.string(),
      authorId: z.string(),
      content: z.string().min(1),
      mentions: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid request body');
    }

    // Verify issue exists
    const issue = await prisma.issue.findUnique({
      where: { id: parsed.data.issueId },
    });

    if (!issue) {
      throw new AppError('NOT_FOUND', 404, 'Issue not found');
    }

    const comment = await prisma.comment.create({
      data: {
        issueId: parsed.data.issueId,
        authorId: parsed.data.authorId,
        content: parsed.data.content,
        mentions: parsed.data.mentions || [],
      },
      include: {
        author: true,
      },
    });

    res.status(201).json({
      success: true,
      data: comment,
    });
  };
};

/**
 * Create handler factory for fetching comments on an issue
 */
export const createGetCommentsHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { issueId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { issueId },
      include: {
        author: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: comments,
    });
  };
};
