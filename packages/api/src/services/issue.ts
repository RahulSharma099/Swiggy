import { PrismaClient } from "@prisma/client";
import {
  AppError,
  ForbiddenError,
  eventEmitter,
  createDomainEvent,
  DomainEvents,
} from "@pms/shared";
import { IssueRepository } from "../repositories/issue";
import { ProjectRepository } from "../repositories/project";
import { WorkspaceRepository } from "../repositories/workspace";
import { AuditService } from "./audit";
import { z } from "zod";
import {
  getEventBus,
  IssueCreatedEvent,
  IssueUpdatedEvent,
  IssueDeletedEvent,
  IssueAssignedEvent,
  generateEventId,
  generateCorrelationId,
} from "../domain/events";

/**
 * Issue Service Factory
 * Business logic for Issue operations with authorization and audit logging
 *
 * Emits domain events for:
 * - Activity log persistence
 * - WebSocket broadcasting
 * - Search index updates
 * - Notification queuing
 */
export const createIssueService = (deps: {
  issueRepo: IssueRepository;
  projectRepo: ProjectRepository;
  workspaceRepo: WorkspaceRepository;
  auditService: AuditService;
  prisma: PrismaClient;
  correlationId?: string; // Optional from request context
}) => ({
  /**
   * Create a new issue in a project
   * Authorization: User must be a project member
   */
  createIssue: async (
    input: {
      projectId: string;
      title: string;
      description?: string;
      type?: string;
      priority?: number;
      storyPoints?: number;
      reporterId: string;
      assigneeId?: string;
    },
    userId: string,
  ) => {
    // Validate input
    const schema = z.object({
      projectId: z.string(),
      title: z.string().min(1).max(255),
      description: z.string().max(5000).optional(),
      type: z
        .enum(["story", "task", "bug", "epic", "sub-task"])
        .default("task"),
      priority: z.number().int().min(1).max(5).default(2),
      storyPoints: z.number().positive().optional(),
      reporterId: z.string(),
      assigneeId: z.string().optional(),
    });

    const validated = schema.parse(input);

    // Check authorization: User must be project member
    const isMember = await deps.projectRepo.isMember(
      validated.projectId,
      userId,
    );
    if (!isMember) {
      throw new ForbiddenError("Not a project member");
    }

    // Verify project exists
    const project = await deps.projectRepo.findById(validated.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", 404, "Project not found");
    }

    // Check assignee if provided
    if (validated.assigneeId) {
      const assigneeIsMember = await deps.projectRepo.isMember(
        validated.projectId,
        validated.assigneeId,
      );
      if (!assigneeIsMember) {
        throw new AppError(
          "INVALID_ASSIGNEE",
          400,
          "Assignee is not a project member",
        );
      }
    }

    // Create issue
    const issue = await deps.issueRepo.create({
      project: { connect: { id: validated.projectId } },
      title: validated.title,
      description: validated.description,
      type: validated.type,
      priority: validated.priority,
      storyPoints: validated.storyPoints,
      reporter: { connect: { id: validated.reporterId } },
      ...(validated.assigneeId && {
        assignee: { connect: { id: validated.assigneeId } },
      }),
    });

    // Log activity
    await deps.auditService.logIssueAction(
      issue.id,
      project.workspaceId,
      "created",
      userId,
      { created: true },
      `Issue "${validated.title}" created`,
    );

    // Emit legacy domain event for backward compatibility
    eventEmitter.emitEvent(
      createDomainEvent(DomainEvents.ISSUE_CREATED, "issue", issue.id, userId, {
        projectId: project.id,
        workspaceId: project.workspaceId,
        title: issue.title,
        type: issue.type,
        reporterId: issue.reporterId,
        description: issue.description,
      }),
    );

    // Emit new domain event to EventBus
    const eventBus = getEventBus();
    const issueDomainEvent: IssueCreatedEvent = {
      id: generateEventId(),
      type: "issue.created",
      aggregateId: issue.id,
      aggregateType: "Issue",
      correlationId: deps.correlationId || generateCorrelationId(),
      timestamp: new Date(),
      actorId: userId,
      workspaceId: project.workspaceId,
      projectId: project.id,
      payload: {
        title: validated.title,
        description: validated.description,
        type: validated.type as any,
        priority: validated.priority,
        assigneeId: validated.assigneeId,
      },
      metadata: {
        source: "api",
      },
    };
    await eventBus.publish(issueDomainEvent);

    return issue;
  },

  /**
   * Update an issue
   * Authorization: User must be project member or assignee
   */
  updateIssue: async (
    issueId: string,
    updates: {
      title?: string;
      description?: string;
      status?: string;
      priority?: number;
      assigneeId?: string;
    },
    userId: string,
  ) => {
    // Get current issue
    const issue = await deps.issueRepo.findById(issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }

    // Check authorization: User must be project member or assignee
    const isMember = await deps.projectRepo.isMember(issue.projectId, userId);
    if (!isMember && issue.assigneeId !== userId) {
      throw new ForbiddenError("Not authorized to update this issue");
    }

    // Validate updates
    const schema = z.object({
      title: z.string().min(1).max(255).optional(),
      description: z.string().max(5000).optional(),
      status: z
        .enum(["open", "in-progress", "review", "done", "closed"])
        .optional(),
      priority: z.number().int().min(1).max(5).optional(),
      assigneeId: z.string().optional(),
    });

    const validated = schema.parse(updates);

    // Check new assignee if changing
    if (validated.assigneeId && validated.assigneeId !== issue.assigneeId) {
      const assigneeIsMember = await deps.projectRepo.isMember(
        issue.projectId,
        validated.assigneeId,
      );
      if (!assigneeIsMember) {
        throw new AppError(
          "INVALID_ASSIGNEE",
          400,
          "New assignee is not a project member",
        );
      }
    }

    // Track changes for audit log
    const changedFields: Record<string, any> = {};
    if (validated.title && validated.title !== issue.title)
      changedFields.title = validated.title;
    if (validated.status && validated.status !== issue.status)
      changedFields.status = validated.status;
    if (validated.priority && validated.priority !== issue.priority)
      changedFields.priority = validated.priority;
    if (validated.assigneeId && validated.assigneeId !== issue.assigneeId)
      changedFields.assigneeId = validated.assigneeId;

    if (Object.keys(changedFields).length === 0) {
      // No changes
      return issue;
    }

    // Update issue and increment version
    const updateData: any = { ...validated };
    if (validated.assigneeId) {
      updateData.assignee = { connect: { id: validated.assigneeId } };
      delete updateData.assigneeId;
    }
    updateData.version = { increment: 1 };

    const updated = await deps.issueRepo.update(issueId, updateData);

    // Log activity
    const project = await deps.projectRepo.findById(issue.projectId);
    if (project) {
      await deps.auditService.logIssueAction(
        issueId,
        project.workspaceId,
        "updated",
        userId,
        changedFields,
        `Issue updated with changes: ${Object.keys(changedFields).join(", ")}`,
      );

      // Emit legacy domain event for backward compatibility
      eventEmitter.emitEvent(
        createDomainEvent(
          DomainEvents.ISSUE_UPDATED,
          "issue",
          issueId,
          userId,
          {
            projectId: project.id,
            workspaceId: project.workspaceId,
            changes: changedFields,
          },
        ),
      );

      // Emit new domain event to EventBus
      const eventBus = getEventBus();
      const updateDomainEvent: IssueUpdatedEvent = {
        id: generateEventId(),
        type: "issue.updated",
        aggregateId: issueId,
        aggregateType: "Issue",
        correlationId: deps.correlationId || generateCorrelationId(),
        timestamp: new Date(),
        actorId: userId,
        workspaceId: project.workspaceId,
        projectId: project.id,
        payload: {
          changes: Object.entries(changedFields).reduce(
            (acc, [key, value]) => {
              acc[key] = {
                old: (issue as any)[key],
                new: value,
              };
              return acc;
            },
            {} as Record<string, { old: any; new: any }>,
          ),
        },
        metadata: {
          source: "api",
        },
      };
      await eventBus.publish(updateDomainEvent);
    }

    return updated;
  },

  /**
   * Assign issue to user
   * Authorization: User must be project lead or higher
   */
  assignIssue: async (issueId: string, assigneeId: string, userId: string) => {
    // Get issue
    const issue = await deps.issueRepo.findById(issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }

    // Check authorization: must be project lead or owner
    const userRole = await deps.projectRepo.getUserRole(
      issue.projectId,
      userId,
    );
    if (!userRole || !["lead", "owner"].includes(userRole)) {
      throw new ForbiddenError("Only project lead can assign issues");
    }

    // Verify assignee is project member
    const assigneeIsMember = await deps.projectRepo.isMember(
      issue.projectId,
      assigneeId,
    );
    if (!assigneeIsMember) {
      throw new AppError(
        "INVALID_ASSIGNEE",
        400,
        "Assignee is not a project member",
      );
    }

    // Update assignee
    const updated = await deps.issueRepo.update(issueId, {
      assignee: { connect: { id: assigneeId } },
      version: { increment: 1 },
    });

    // Log activity
    const project = await deps.projectRepo.findById(issue.projectId);
    if (project) {
      await deps.auditService.logIssueAction(
        issueId,
        project.workspaceId,
        "assigned",
        userId,
        { assigneeId },
        `Issue assigned to ${assigneeId}`,
      );

      // Emit legacy domain event for backward compatibility
      eventEmitter.emitEvent(
        createDomainEvent(
          DomainEvents.ISSUE_ASSIGNED,
          "issue",
          issueId,
          userId,
          {
            projectId: project.id,
            workspaceId: project.workspaceId,
            assigneeId,
          },
        ),
      );

      // Emit new domain event to EventBus
      const eventBus = getEventBus();
      const assignDomainEvent: IssueAssignedEvent = {
        id: generateEventId(),
        type: "issue.assigned",
        aggregateId: issueId,
        aggregateType: "Issue",
        correlationId: deps.correlationId || generateCorrelationId(),
        timestamp: new Date(),
        actorId: userId,
        workspaceId: project.workspaceId,
        projectId: project.id,
        payload: {
          assigneeId,
          previousAssigneeId: issue.assigneeId || undefined,
        },
        metadata: {
          source: "api",
        },
      };
      await eventBus.publish(assignDomainEvent);
    }

    return updated;
  },

  /**
   * Delete issue (soft delete)
   * Authorization: User must be project lead or issue reporter
   */
  deleteIssue: async (issueId: string, userId: string) => {
    // Get issue
    const issue = await deps.issueRepo.findById(issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }

    // Check authorization: must be reporter, assignee, or project lead
    const userRole = await deps.projectRepo.getUserRole(
      issue.projectId,
      userId,
    );
    const isAuthority =
      userRole === "lead" ||
      userRole === "owner" ||
      issue.reporterId === userId;

    if (!isAuthority) {
      throw new ForbiddenError("Not authorized to delete this issue");
    }

    // Soft delete
    const deleted = await deps.issueRepo.delete(issueId);

    // Log activity
    const project = await deps.projectRepo.findById(issue.projectId);
    if (project) {
      await deps.auditService.logIssueAction(
        issueId,
        project.workspaceId,
        "deleted",
        userId,
        { deleted: true },
        `Issue deleted`,
      );

      // Emit legacy domain event for backward compatibility
      eventEmitter.emitEvent(
        createDomainEvent(
          DomainEvents.ISSUE_DELETED,
          "issue",
          issueId,
          userId,
          {
            projectId: project.id,
            workspaceId: project.workspaceId,
          },
        ),
      );

      // Emit new domain event to EventBus
      const eventBus = getEventBus();
      const deleteDomainEvent: IssueDeletedEvent = {
        id: generateEventId(),
        type: "issue.deleted",
        aggregateId: issueId,
        aggregateType: "Issue",
        correlationId: deps.correlationId || generateCorrelationId(),
        timestamp: new Date(),
        actorId: userId,
        workspaceId: project.workspaceId,
        projectId: project.id,
        payload: {
          title: issue.title,
          reason: "user_initiated",
        },
        metadata: {
          source: "api",
        },
      };
      await eventBus.publish(deleteDomainEvent);
    }

    return deleted;
  },

  /**
   * Get issues for project with optional filters
   */
  getProjectIssues: async (
    projectId: string,
    filters?: {
      status?: string;
      assigneeId?: string;
      type?: string;
    },
  ) => {
    return deps.issueRepo.findByProjectId(projectId, filters);
  },

  /**
   * Get issues assigned to user
   */
  getUserIssues: async (userId: string) => {
    return deps.issueRepo.findAssignedToUser(userId);
  },

  /**
   * Get single issue by ID
   */
  getIssue: async (issueId: string) => {
    const issue = await deps.issueRepo.findById(issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }
    return issue;
  },
});

// Type export
export type IssueService = ReturnType<typeof createIssueService>;
