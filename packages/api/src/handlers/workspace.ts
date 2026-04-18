import { Request, Response } from 'express';
import { PrismaClient } from '@pms/database';
import { z } from 'zod';
import { AppError } from '@pms/shared';

/**
 * Create handler factory for creating a new workspace
 */
export const createCreateWorkspaceHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const schema = z.object({
      name: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid request body');
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.data.name,
      },
    });

    res.status(201).json({
      success: true,
      data: workspace,
    });
  };
};

/**
 * Create handler factory for fetching all workspaces
 */
export const createGetWorkspacesHandler = (prisma: PrismaClient) => {
  return async (_req: Request, res: Response): Promise<void> => {
    const workspaces = await prisma.workspace.findMany({
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: workspaces,
    });
  };
};

/**
 * Create handler factory for fetching a single workspace
 */
export const createGetWorkspaceHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    res.status(200).json({
      success: true,
      data: workspace,
    });
  };
};

/**
 * Create handler factory for updating a workspace
 */
export const createUpdateWorkspaceHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params;
    const schema = z.object({
      name: z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid request body');
    }

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: parsed.data,
    });

    res.status(200).json({
      success: true,
      data: workspace,
    });
  };
};
