/**
 * Comment Service
 * Business logic for comments with authorization and event emission
 */

import { PrismaClient, Comment } from "@prisma/client";
import {
  AppError,
  ForbiddenError,
  eventEmitter,
  DomainEvents,
} from "@pms/shared";
import { CommentRepository } from "../repositories/comment";
import { IssueRepository } from "../repositories/issue";
import { ProjectRepository } from "../repositories/project";
import { WorkspaceRepository } from "../repositories/workspace";
import { AuditService } from "./audit";
import { z } from "zod";
import {
  getEventBus,
  CommentAddedEvent,
  CommentDeletedEvent,
  generateEventId,
  generateCorrelationId,
} from "../domain/events";

export type CommentService = ReturnType<typeof createCommentService>;

/**
 * Create comment service
 */
export const createCommentService = (deps: {
  commentRepo: CommentRepository;
  issueRepo: IssueRepository;
  projectRepo: ProjectRepository;
  workspaceRepo: WorkspaceRepository;
  auditService: AuditService;
  prisma: PrismaClient;
  correlationId?: string;
}) => ({
  /**
   * Add comment to issue
   * Authorization: User must be project member
   */
  async addComment(
    issueId: string,
    content: string,
    userId: string,
    mentions: string[] = [],
  ): Promise<Comment> {
    // Validate input
    const schema = z.object({
      content: z.string().min(1).max(5000),
      mentions: z.array(z.string()).optional(),
    });

    const validated = schema.parse({
      content,
      mentions: mentions || [],
    });

    // Get issue with project info
    const issue = await deps.issueRepo.findById(issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }

    // Check authorization - user must be project member
    const isMember = await deps.projectRepo.isMember(issue.projectId, userId);
    if (!isMember) {
      throw new ForbiddenError("Not a project member");
    }

    // Get project for workspace info
    const project = await deps.projectRepo.findById(issue.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", 404, "Project not found");
    }

    // Create comment
    const comment = await deps.commentRepo.create(
      issueId,
      userId,
      validated.content,
      validated.mentions,
    );

    // Log activity
    await deps.auditService.logIssueAction(
      issueId,
      project.workspaceId,
      "commented",
      userId,
      { mentionedUsers: validated.mentions || [] },
      `New comment with ${(validated.mentions || []).length} mentions`,
    );

    // Emit legacy event for backward compatibility
    eventEmitter.emitEvent({
      type: DomainEvents.COMMENT_ADDED,
      aggregateType: "comment",
      aggregateId: comment.id,
      actorId: userId,
      timestamp: new Date(),
      data: {
        issueId,
        projectId: issue.projectId,
        workspaceId: project.workspaceId,
        content: validated.content,
        mentionedUsers: validated.mentions || [],
        authorName: (comment as any).author?.name,
      },
    });

    // Emit new domain event to EventBus
    const eventBus = getEventBus();
    const commentDomainEvent: CommentAddedEvent = {
      id: generateEventId(),
      type: "comment.added",
      aggregateId: comment.id,
      aggregateType: "Comment",
      correlationId: deps.correlationId || generateCorrelationId(),
      timestamp: new Date(),
      actorId: userId,
      workspaceId: project.workspaceId,
      projectId: issue.projectId,
      payload: {
        issueId,
        content: validated.content,
        mentionedUserIds: validated.mentions,
      },
      metadata: {
        source: "api",
      },
    };
    await eventBus.publish(commentDomainEvent);

    return comment;

    return comment;
  },

  /**
   * Update comment
   * Authorization: User must be comment author
   */
  async updateComment(
    commentId: string,
    content: string,
    userId: string,
    mentions: string[] = [],
  ): Promise<Comment> {
    // Validate input
    const schema = z.object({
      content: z.string().min(1).max(5000),
      mentions: z.array(z.string()).optional(),
    });

    const validated = schema.parse({ content, mentions: mentions || [] });

    // Get comment
    const comment = await deps.commentRepo.findById(commentId);
    if (!comment) {
      throw new AppError("COMMENT_NOT_FOUND", 404, "Comment not found");
    }

    // Check authorization - only author can edit
    if (comment.authorId !== userId) {
      throw new ForbiddenError("Only comment author can edit comments");
    }

    // Get issue for audit logging
    const issue = await deps.issueRepo.findById(comment.issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }

    const project = await deps.projectRepo.findById(issue.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", 404, "Project not found");
    }

    // Update comment
    const updated = await deps.commentRepo.update(
      commentId,
      validated.content,
      validated.mentions,
    );

    // Log activity
    await deps.auditService.logIssueAction(
      comment.issueId,
      project.workspaceId,
      "comment_updated",
      userId,
      {
        oldMentions: (comment.mentions as string[]) || [],
        newMentions: validated.mentions,
      },
      "Comment edited",
    );

    // Emit event
    eventEmitter.emitEvent({
      type: DomainEvents.COMMENT_ADDED,
      aggregateType: "comment",
      aggregateId: commentId,
      actorId: userId,
      timestamp: new Date(),
      data: {
        issueId: comment.issueId,
        projectId: issue.projectId,
        workspaceId: project.workspaceId,
        content: validated.content,
        action: "updated",
      },
    });

    return updated;
  },

  /**
   * Delete comment
   * Authorization: Only author or project lead can delete
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    // Get comment
    const comment = await deps.commentRepo.findById(commentId);
    if (!comment) {
      throw new AppError("COMMENT_NOT_FOUND", 404, "Comment not found");
    }

    // Get issue for authorization and audit
    const issue = await deps.issueRepo.findById(comment.issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }

    // Check authorization
    const isAuthor = comment.authorId === userId;
    const userRole = await deps.projectRepo.getUserRole(
      issue.projectId,
      userId,
    );
    const isLead = userRole && ["lead", "owner"].includes(userRole);

    if (!isAuthor && !isLead) {
      throw new ForbiddenError(
        "Only comment author or project lead can delete comments",
      );
    }

    // Get project for audit
    const project = await deps.projectRepo.findById(issue.projectId);
    if (!project) {
      throw new AppError("PROJECT_NOT_FOUND", 404, "Project not found");
    }

    // Delete comment
    await deps.commentRepo.delete(commentId);

    // Log activity
    await deps.auditService.logIssueAction(
      comment.issueId,
      project.workspaceId,
      "comment_deleted",
      userId,
      { deletedCommentId: commentId },
      "Comment deleted",
    );

    // Emit legacy event for backward compatibility
    eventEmitter.emitEvent({
      type: DomainEvents.COMMENT_DELETED,
      aggregateType: "comment",
      aggregateId: commentId,
      actorId: userId,
      timestamp: new Date(),
      data: {
        issueId: comment.issueId,
        projectId: issue.projectId,
        workspaceId: project.workspaceId,
      },
    });

    // Emit new domain event to EventBus
    const eventBus = getEventBus();
    const deleteCommentEvent: CommentDeletedEvent = {
      id: generateEventId(),
      type: "comment.deleted",
      aggregateId: commentId,
      aggregateType: "Comment",
      correlationId: deps.correlationId || generateCorrelationId(),
      timestamp: new Date(),
      actorId: userId,
      workspaceId: project.workspaceId,
      projectId: issue.projectId,
      payload: {
        issueId: comment.issueId,
        content: comment.content,
      },
      metadata: {
        source: "api",
      },
    };
    await eventBus.publish(deleteCommentEvent);
  },

  /**
   * Get comments for issue with pagination
   */
  async getCommentsForIssue(
    issueId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ comments: Comment[]; total: number }> {
    // Verify issue exists and user can access it
    const issue = await deps.issueRepo.findById(issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }

    // Verify user is project member
    const isMember = await deps.projectRepo.isMember(issue.projectId, userId);
    if (!isMember) {
      throw new ForbiddenError("Not a project member");
    }

    return deps.commentRepo.findByIssueId(issueId, limit, offset);
  },

  /**
   * Get user's comment history
   */
  async getUserComments(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Comment[]> {
    return deps.commentRepo.findByAuthorId(userId, limit, offset);
  },

  /**
   * Search comments in issue
   */
  async searchComments(
    issueId: string,
    searchTerm: string,
    userId: string,
    limit: number = 20,
  ): Promise<Comment[]> {
    // Verify issue exists
    const issue = await deps.issueRepo.findById(issueId);
    if (!issue) {
      throw new AppError("ISSUE_NOT_FOUND", 404, "Issue not found");
    }

    // Verify user is project member
    const isMember = await deps.projectRepo.isMember(issue.projectId, userId);
    if (!isMember) {
      throw new ForbiddenError("Not a project member");
    }

    return deps.commentRepo.search(issueId, searchTerm, limit);
  },

  /**
   * Get activity feed with recent comments
   */
  async getActivityFeed(
    workspaceId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Comment[]> {
    // Verify user is workspace member
    const isMember = await deps.workspaceRepo.isMember(workspaceId, userId);
    if (!isMember) {
      throw new ForbiddenError("Not a workspace member");
    }

    return deps.commentRepo.findRecentByWorkspace(workspaceId, limit, offset);
  },
});
