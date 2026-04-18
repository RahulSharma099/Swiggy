import { PrismaClient } from '@prisma/client';

/**
 * Audit Service Factory
 * Centralized logging for all resource mutations and workspace activities
 */
export const createAuditService = (prisma: PrismaClient) => ({
  /**
   * Log an issue action
   */
  logIssueAction: async (
    issueId: string,
    workspaceId: string,
    actionType: string,
    actorId: string,
    changedFields?: Record<string, any>,
    description?: string
  ) => {
    return prisma.activityLog.create({
      data: {
        resourceType: 'issue',
        resourceId: issueId,
        issueId, // Keep for backward compatibility
        workspaceId,
        actionType,
        changedFields: changedFields || {},
        description,
        actorId,
      },
    });
  },

  /**
   * Log a project action
   */
  logProjectAction: async (
    projectId: string,
    workspaceId: string,
    actionType: string,
    actorId: string,
    changedFields?: Record<string, any>,
    description?: string
  ) => {
    return prisma.activityLog.create({
      data: {
        resourceType: 'project',
        resourceId: projectId,
        workspaceId,
        actionType,
        changedFields: changedFields || {},
        description,
        actorId,
      },
    });
  },

  /**
   * Log a workspace action
   */
  logWorkspaceAction: async (
    workspaceId: string,
    actionType: string,
    actorId: string,
    changedFields?: Record<string, any>,
    description?: string
  ) => {
    return prisma.activityLog.create({
      data: {
        resourceType: 'workspace',
        resourceId: workspaceId,
        workspaceId,
        actionType,
        changedFields: changedFields || {},
        description,
        actorId,
      },
    });
  },

  /**
   * Log a member action (add/remove/role change)
   */
  logMemberAction: async (
    resourceType: 'workspace' | 'project',
    resourceId: string,
    workspaceId: string,
    actionType: string,
    actorId: string,
    memberId?: string,
    oldRole?: string,
    newRole?: string
  ) => {
    const changedFields: Record<string, any> = {};
    if (memberId) changedFields.memberId = memberId;
    if (oldRole) changedFields.oldRole = oldRole;
    if (newRole) changedFields.newRole = newRole;

    return prisma.activityLog.create({
      data: {
        resourceType,
        resourceId,
        workspaceId,
        actionType,
        changedFields,
        description: `${actionType} for ${memberId || 'unknown'}: ${oldRole || ''} -> ${newRole || ''}`.trim(),
        actorId,
      },
    });
  },

  /**
   * Get activity logs for a resource
   */
  getResourceActivity: async (resourceType: string, resourceId: string, limit = 50) => {
    return prisma.activityLog.findMany({
      where: {
        resourceType,
        resourceId,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  },

  /**
   * Get workspace activity logs
   */
  getWorkspaceActivity: async (workspaceId: string, limit = 100) => {
    return prisma.activityLog.findMany({
      where: {
        workspaceId,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  },

  /**
   * Get activity for a specific action type in workspace
   */
  getActivityByType: async (workspaceId: string, actionType: string, limit = 50) => {
    return prisma.activityLog.findMany({
      where: {
        workspaceId,
        actionType,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  },
});

export type AuditService = ReturnType<typeof createAuditService>;
