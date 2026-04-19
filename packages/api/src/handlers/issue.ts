import { Request, Response } from 'express';
import { PrismaClient } from '@pms/database';
import { z } from 'zod';
import { AppError } from '@pms/shared';

/**
 * Create handler factory for creating a new issue
 */
export const createCreateIssueHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const schema = z.object({
      projectId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(['story', 'task', 'bug', 'epic', 'sub-task']).default('task'),
      priority: z.number().int().min(1).max(5).default(2),
      storyPoints: z.number().optional(),
      reporterId: z.string().optional(),
      assigneeId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid request body');
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
    });

    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const createData = {
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      priority: parsed.data.priority,
      storyPoints: parsed.data.storyPoints,
      assigneeId: parsed.data.assigneeId,
    };

    const issue = await prisma.issue.create({
      data: createData,
      include: {
        reporter: true,
        assignee: true,
      },
    });

    res.status(201).json({
      success: true,
      data: issue,
    });
  };
};

/**
 * Create handler factory for fetching issues in a project
 */
export const createGetIssuesHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const { status, assigneeId, type } = req.query;

    const where: any = { projectId };
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (type) where.type = type;

    const issues = await prisma.issue.findMany({
      where,
      include: {
        reporter: true,
        assignee: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: issues,
    });
  };
};

/**
 * Create handler factory for fetching a single issue
 */
export const createGetIssueHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { issueId } = req.params;

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        reporter: true,
        assignee: true,
        comments: {
          include: {
            author: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!issue) {
      throw new AppError('NOT_FOUND', 404, 'Issue not found');
    }

    res.status(200).json({
      success: true,
      data: issue,
    });
  };
};

/**
 * Create handler factory for updating an issue
 */
export const createUpdateIssueHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { issueId } = req.params;
    const schema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      status: z.enum(['open', 'in-progress', 'review', 'done', 'closed']).optional(),
      priority: z.number().int().min(1).max(5).optional(),
      assigneeId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid request body');
    }

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: {
        ...parsed.data,
        version: { increment: 1 },
      },
    });

    res.status(200).json({
      success: true,
      data: issue,
    });
  };
};

/**
 * Create handler factory for deleting an issue (soft delete)
 */
export const createDeleteIssueHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { issueId } = req.params;

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: { deletedAt: new Date() },
    });

    res.status(200).json({
      success: true,
      data: issue,
    });
  };
};
