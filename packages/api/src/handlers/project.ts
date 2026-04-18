import { Request, Response } from 'express';
import { PrismaClient } from '@pms/database';
import { z } from 'zod';
import { AppError } from '@pms/shared';

/**
 * Create handler factory for creating a new project
 */
export const createCreateProjectHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const schema = z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      keyPrefix: z.string().default('PROJ'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid request body');
    }

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: parsed.data.workspaceId },
    });

    if (!workspace) {
      throw new AppError('NOT_FOUND', 404, 'Workspace not found');
    }

    const project = await prisma.project.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        description: parsed.data.description,
        keyPrefix: parsed.data.keyPrefix,
      },
    });

    res.status(201).json({
      success: true,
      data: project,
    });
  };
};

/**
 * Create handler factory for fetching projects in a workspace
 */
export const createGetProjectsHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params;

    const projects = await prisma.project.findMany({
      where: { workspaceId },
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
      data: projects,
    });
  };
};

/**
 * Create handler factory for fetching a single project
 */
export const createGetProjectHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  };
};

/**
 * Create handler factory for updating a project
 */
export const createUpdateProjectHandler = (prisma: PrismaClient) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      keyPrefix: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid request body');
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: parsed.data,
    });

    res.status(200).json({
      success: true,
      data: project,
    });
  };
};
