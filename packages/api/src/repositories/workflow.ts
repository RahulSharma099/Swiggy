/**
 * Workflow Repository
 * Data access functions for workflow definitions and transitions
 */

import { PrismaClient } from '@prisma/client';

/**
 * Workflow definition type
 */
export interface WorkflowStatus {
  id: string;
  name: string;
  isInitial: boolean;
  isFinal: boolean;
}

export interface WorkflowCondition {
  type: 'has_assignee' | 'has_reviewers' | 'custom_field' | 'sprint_active';
  config: Record<string, unknown>;
}

export interface WorkflowAction {
  type: 'notify_watchers' | 'update_field' | 'create_activity' | 'webhook';
  config: Record<string, unknown>;
}

export interface WorkflowTransition {
  id: string;
  from: string;
  to: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  requiredRole?: 'viewer' | 'developer' | 'maintainer';
}

export interface WorkflowDefinition {
  id: string;
  projectId: string;
  name: string;
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

/**
 * Create workflow repository
 */
export const createWorkflowRepository = (prisma: PrismaClient) => ({
  /**
   * Get or create default workflow for project
   */
  async findByProjectId(projectId: string): Promise<WorkflowDefinition | null> {
    // For now, return default agile workflow
    // In future, this will query from database
    const transitions = await prisma.issueStatusTransition.findMany({
      where: { projectId },
    });

    if (transitions.length === 0) {
      return null;
    }

    // Build workflow from transitions
    const statuses: Set<string> = new Set();
    transitions.forEach((t) => {
      statuses.add(t.fromStatus);
      statuses.add(t.toStatus);
    });

    return {
      id: `workflow_${projectId}`,
      projectId,
      name: 'Default Workflow',
      statuses: Array.from(statuses).map((status) => ({
        id: status,
        name: status.replace(/_/g, ' '),
        isInitial: status === 'open' || status === 'backlog',
        isFinal: status === 'done' || status === 'closed',
      })),
      transitions: transitions.map((t) => ({
        id: t.id,
        from: t.fromStatus,
        to: t.toStatus,
        conditions: (t.conditions as unknown as WorkflowCondition[]) || [],
        actions: (t.actions as unknown as WorkflowAction[]) || [],
      })),
    };
  },

  /**
   * Create or update workflow transition
   */
  async createTransition(data: {
    projectId: string;
    fromStatus: string;
    toStatus: string;
    conditions?: WorkflowCondition[];
    actions?: WorkflowAction[];
  }) {
    return prisma.issueStatusTransition.create({
      data: {
        projectId: data.projectId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        conditions: (data.conditions || []) as any,
        actions: (data.actions || []) as any,
      },
    });
  },

  /**
   * Update workflow transition
   */
  async updateTransition(
    transitionId: string,
    data: {
      conditions?: WorkflowCondition[];
      actions?: WorkflowAction[];
    }
  ) {
    return prisma.issueStatusTransition.update({
      where: { id: transitionId },
      data: {
        conditions: data.conditions ? (data.conditions as any) : undefined,
        actions: data.actions ? (data.actions as any) : undefined,
      },
    });
  },

  /**
   * Delete workflow transition
   */
  async deleteTransition(transitionId: string) {
    return prisma.issueStatusTransition.delete({
      where: { id: transitionId },
    });
  },

  /**
   * Get all transitions for project
   */
  async findTransitionsByProjectId(projectId: string) {
    return prisma.issueStatusTransition.findMany({
      where: { projectId },
    });
  },

  /**
   * Get transitions from a specific status
   */
  async findTransitionsFromStatus(projectId: string, status: string) {
    return prisma.issueStatusTransition.findMany({
      where: {
        projectId,
        fromStatus: status,
      },
    });
  },

  /**
   * Check if transition exists
   */
  async transitionExists(
    projectId: string,
    fromStatus: string,
    toStatus: string
  ): Promise<boolean> {
    const transition = await prisma.issueStatusTransition.findFirst({
      where: {
        projectId,
        fromStatus,
        toStatus,
      },
    });
    return !!transition;
  },
});

export type WorkflowRepository = ReturnType<typeof createWorkflowRepository>;
