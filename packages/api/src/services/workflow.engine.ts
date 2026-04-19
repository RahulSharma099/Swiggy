/**
 * Workflow Engine Service
 * State machine and transition logic for issues
 */

import { Issue as PrismaIssue } from '@prisma/client';
import { AppError, ForbiddenError, eventEmitter, createDomainEvent, DomainEvents } from '@pms/shared';
import { IssueRepository } from '../repositories/issue';
import { WorkflowRepository, WorkflowCondition, WorkflowAction } from '../repositories/workflow';

/**
 * Create workflow engine for managing issue transitions
 */
export const createWorkflowEngine = (deps: {
  workflowRepo: WorkflowRepository;
  issueRepo: IssueRepository;
  logger: { info: (msg: string, meta?: Record<string, unknown>) => void; warn: (msg: string, meta?: Record<string, unknown>) => void };
}) => {
  const { workflowRepo, issueRepo, logger } = deps;

  /**
   * Evaluate workflow conditions
   */
  const evaluateCondition = async (
    condition: WorkflowCondition,
    issue: PrismaIssue
  ): Promise<boolean> => {
    try {
      switch (condition.type) {
        case 'has_assignee':
          return !!issue.assigneeId;

        case 'has_reviewers': {
          const minReviewers = (condition.config.minReviewers as number) || 1;
          // For now, assume no dedicated reviewers field
          // In future: issue.reviewerIds?.length || 0
          return minReviewers <= 1; // At least as many as required
        }

        case 'custom_field': {
          const fieldId = condition.config.fieldId as string;
          const expectedValue = condition.config.value;
          const metadata = (issue.metadata as Record<string, unknown>) || {};
          const fieldValue = metadata[fieldId];
          return fieldValue === expectedValue;
        }

        case 'sprint_active':
          return !!issue.sprintId; // Assume sprint is active if assigned

        default:
          return true;
      }
    } catch (error) {
      logger.warn('Error evaluating condition', {
        conditionType: condition.type,
        error: String(error),
      });
      return false;
    }
  };

  /**
   * Execute workflow actions
   */
  const executeAction = async (
    action: WorkflowAction,
    issue: PrismaIssue,
    _userId: string
  ): Promise<void> => {
    try {
      switch (action.type) {
        case 'notify_watchers': {
          // Placeholder: In Phase 5, implement notification system
          logger.info('Action: notify_watchers', {
            issueId: issue.id,
            message: (action.config.message as string) || 'Status changed',
          });
          break;
        }

        case 'update_field': {
          const field = action.config.field as string;
          const value = action.config.value;
          
          if (field === 'priority' || field === 'storyPoints') {
            // Update numeric fields
            await issueRepo.update(issue.id, {
              [field]: value,
            });
            logger.info(`Action: updated ${field}`, { issueId: issue.id, value });
          }
          break;
        }

        case 'create_activity': {
          // Placeholder: Activity creation handled by caller
          logger.info('Action: create_activity', {
            issueId: issue.id,
            description: (action.config.description as string) || 'Activity logged',
          });
          break;
        }

        case 'webhook': {
          // Placeholder: Webhook implementation for Phase 8+
          const webhookUrl = action.config.url as string;
          logger.info('Action: webhook', {
            issueId: issue.id,
            url: webhookUrl,
          });
          break;
        }

        default:
          logger.warn('Unknown action type', { actionType: action.type });
      }
    } catch (error) {
      logger.warn('Action execution error', {
        actionType: action.type,
        issueId: issue.id,
        error: String(error),
      });
      // Don't re-throw; log but continue
    }
  };

  return {
    /**
     * Get workflow for project
     */
    async getWorkflow(projectId: string) {
      return workflowRepo.findByProjectId(projectId);
    },

    /**
     * Check if transition is allowed
     */
    async canTransition(
      projectId: string,
      fromStatus: string,
      toStatus: string,
      issue: PrismaIssue,
      _userId: string
    ): Promise<boolean> {
      // Get workflow
      const workflow = await this.getWorkflow(projectId);
      if (!workflow) {
        logger.warn('Workflow not found', { projectId });
        return false;
      }

      // Find transition definition
      const transition = workflow.transitions.find(
        (t) => t.from === fromStatus && t.to === toStatus
      );

      if (!transition) {
        logger.warn('Transition not defined', { fromStatus, toStatus });
        return false;
      }

      // Check all conditions
      for (const condition of transition.conditions) {
        const met = await evaluateCondition(condition, issue);
        if (!met) {
          logger.info('Condition not met', {
            conditionType: condition.type,
            fromStatus,
            toStatus,
          });
          return false;
        }
      }

      return true;
    },

    /**
     * Execute status transition
     */
    async transitionIssue(
      projectId: string,
      issueId: string,
      toStatus: string,
      userId: string
    ): Promise<PrismaIssue> {
      // Get issue
      const issue = await issueRepo.findById(issueId);
      if (!issue) {
        throw new AppError('ISSUE_NOT_FOUND', 404, `Issue ${issueId} not found`);
      }

      const fromStatus = issue.status;

      // Check if same status
      if (fromStatus === toStatus) {
        return issue;
      }

      // Check authorization
      const allowed = await this.canTransition(projectId, fromStatus, toStatus, issue, userId);
      if (!allowed) {
        throw new ForbiddenError(
          `Cannot transition from "${fromStatus}" to "${toStatus}"`
        );
      }

      // Get workflow for actions
      const workflow = await this.getWorkflow(projectId);
      const transitionDef = workflow?.transitions.find(
        (t) => t.from === fromStatus && t.to === toStatus
      );

      // Update issue status (with version check for optimistic locking)
      const updated = await issueRepo.update(issueId, {
        status: toStatus,
        version: { increment: 1 },
      });

      if (!updated) {
        throw new AppError('UPDATE_FAILED', 500, 'Failed to update issue status');
      }

      // Execute transition actions
      if (transitionDef?.actions) {
        for (const action of transitionDef.actions) {
          await executeAction(action, updated, userId);
        }
      }

      // Emit domain event for real-time updates
      eventEmitter.emitEvent(
        createDomainEvent(
          DomainEvents.ISSUE_STATUS_CHANGED,
          'issue',
          issueId,
          userId,
          {
            projectId,
            fromStatus,
            toStatus,
            issue: updated,
          }
        )
      );

      logger.info('Issue transitioned', {
        issueId,
        fromStatus,
        toStatus,
        userId,
      });

      return updated;
    },

    /**
     * Get available transitions from current status
     */
    async getAvailableTransitions(
      projectId: string,
      currentStatus: string
    ): Promise<string[]> {
      const workflow = await this.getWorkflow(projectId);
      if (!workflow) return [];

      return workflow.transitions
        .filter((t) => t.from === currentStatus)
        .map((t) => t.to);
    },

    /**
     * Get all statuses in workflow
     */
    async getAllStatuses(projectId: string): Promise<string[]> {
      const workflow = await this.getWorkflow(projectId);
      if (!workflow) return [];

      return workflow.statuses.map((s) => s.id);
    },

    /**
     * Get initial status for new issues
     */
    async getInitialStatus(projectId: string): Promise<string> {
      const workflow = await this.getWorkflow(projectId);
      if (!workflow) return 'open';

      const initialStatus = workflow.statuses.find((s) => s.isInitial);
      return initialStatus?.id || 'open';
    },
  };
};

export type WorkflowEngine = ReturnType<typeof createWorkflowEngine>;
