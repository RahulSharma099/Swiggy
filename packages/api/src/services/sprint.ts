/**
 * Sprint Service
 * Business logic for sprint management
 */

import { PrismaClient } from '@prisma/client';
import { AppError, ForbiddenError, eventEmitter, DomainEvents } from '@pms/shared';
import { SprintRepository } from '../repositories/sprint';
import { ProjectRepository } from '../repositories/project';
import { AuditService } from './audit';
import { z } from 'zod';

/**
 * Create sprint service
 */
export const createSprintService = (deps: {
  sprintRepo: SprintRepository;
  projectRepo: ProjectRepository;
  auditService: AuditService;
  prisma: PrismaClient;
}) => ({
  /**
   * Create a new sprint
   * Authorization: User must be project lead or owner
   */
  createSprint: async (
    input: {
      projectId: string;
      name: string;
      startDate: Date;
      endDate: Date;
    },
    userId: string
  ) => {
    // Validate input
    const schema = z.object({
      projectId: z.string(),
      name: z.string().min(1).max(255),
      startDate: z.instanceof(Date),
      endDate: z.instanceof(Date),
    });

    const validated = schema.parse(input);

    // Check authorization
    const userRole = await deps.projectRepo.getUserRole(validated.projectId, userId);
    if (!userRole || !['lead', 'owner'].includes(userRole)) {
      throw new ForbiddenError('Only project lead can create sprints');
    }

    // Verify project exists
    const project = await deps.projectRepo.findById(validated.projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 404, 'Project not found');
    }

    // Validate dates
    if (validated.endDate <= validated.startDate) {
      throw new AppError('INVALID_DATES', 400, 'End date must be after start date');
    }

    // Create sprint
    const sprint = await deps.sprintRepo.create({
      projectId: validated.projectId,
      name: validated.name,
      startDate: validated.startDate,
      endDate: validated.endDate,
    });

    // Log activity
    await deps.auditService.logProjectAction(
      project.id,
      project.workspaceId,
      'sprint_created',
      userId,
      { sprintName: validated.name },
      `Sprint "${validated.name}" created`
    );

    // Emit event
    eventEmitter.emitEvent({
      type: DomainEvents.SPRINT_CREATED,
      aggregateType: 'project',
      aggregateId: project.id,
      actorId: userId,
      timestamp: new Date(),
      data: {
        projectId: project.id,
        workspaceId: project.workspaceId,
        sprintId: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate.toISOString(),
        endDate: sprint.endDate.toISOString(),
      },
    });

    return sprint;
  },

  /**
   * Update sprint
   * Authorization: User must be project lead or owner
   */
  updateSprint: async (
    sprintId: string,
    updates: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
    },
    userId: string
  ) => {
    // Get sprint
    const sprint = await deps.sprintRepo.findById(sprintId);
    if (!sprint) {
      throw new AppError('SPRINT_NOT_FOUND', 404, 'Sprint not found');
    }

    // Check authorization
    const userRole = await deps.projectRepo.getUserRole(sprint.projectId, userId);
    if (!userRole || !['lead', 'owner'].includes(userRole)) {
      throw new ForbiddenError('Only project lead can update sprints');
    }

    // Validate updates
    const schema = z.object({
      name: z.string().min(1).max(255).optional(),
      startDate: z.instanceof(Date).optional(),
      endDate: z.instanceof(Date).optional(),
    });

    const validated = schema.parse(updates);

    // Validate dates if provided
    const finalStartDate = validated.startDate || sprint.startDate;
    const finalEndDate = validated.endDate || sprint.endDate;

    if (finalEndDate <= finalStartDate) {
      throw new AppError('INVALID_DATES', 400, 'End date must be after start date');
    }

    // Track changes
    const changedFields: Record<string, unknown> = {};
    if (validated.name && validated.name !== sprint.name) changedFields.name = validated.name;
    if (validated.startDate && validated.startDate !== sprint.startDate)
      changedFields.startDate = validated.startDate.toISOString();
    if (validated.endDate && validated.endDate !== sprint.endDate)
      changedFields.endDate = validated.endDate.toISOString();

    if (Object.keys(changedFields).length === 0) {
      return sprint; // No changes
    }

    // Update sprint
    const updated = await deps.sprintRepo.update(sprintId, validated);

    // Log activity
    const project = await deps.projectRepo.findById(sprint.projectId);
    if (project) {
      await deps.auditService.logProjectAction(
        sprint.projectId,
        project.workspaceId,
        'sprint_updated',
        userId,
        changedFields,
        `Sprint "${sprint.name}" updated`
      );
    }

    return updated;
  },

  /**
   * Add issue to sprint
   * Authorization: User must be project member
   */
  addIssueToSprint: async (
    sprintId: string,
    issueId: string,
    userId: string
  ) => {
    // Get sprint and issue
    const sprint = await deps.sprintRepo.findById(sprintId);
    if (!sprint) {
      throw new AppError('SPRINT_NOT_FOUND', 404, 'Sprint not found');
    }

    // Check authorization
    const isMember = await deps.projectRepo.isMember(sprint.projectId, userId);
    if (!isMember) {
      throw new ForbiddenError('Not a project member');
    }

    // Add issue to sprint
    const updated = await deps.sprintRepo.addIssue(sprintId, issueId);

    // Emit event
    const project = await deps.projectRepo.findById(sprint.projectId);
    if (project) {
      eventEmitter.emitEvent({
        type: DomainEvents.ISSUE_ADDED_TO_SPRINT,
        aggregateType: 'project',
        aggregateId: project.id,
        actorId: userId,
        timestamp: new Date(),
        data: {
          projectId: project.id,
          workspaceId: project.workspaceId,
          issueId,
          sprintId,
          sprintName: sprint.name,
        },
      });
    }

    return updated;
  },

  /**
   * Remove issue from sprint
   * Authorization: User must be project member
   */
  removeIssueFromSprint: async (issueId: string, _userId: string) => {
    // This is a simple operation - just remove sprint assignment
    return deps.sprintRepo.removeIssue(issueId);
  },

  /**
   * Start sprint (change status to active)
   * Authorization: User must be project lead or owner
   */
  startSprint: async (sprintId: string, userId: string) => {
    const sprint = await deps.sprintRepo.findById(sprintId);
    if (!sprint) {
      throw new AppError('SPRINT_NOT_FOUND', 404, 'Sprint not found');
    }

    // Check authorization
    const userRole = await deps.projectRepo.getUserRole(sprint.projectId, userId);
    if (!userRole || !['lead', 'owner'].includes(userRole)) {
      throw new ForbiddenError('Only project lead can start sprints');
    }

    if (sprint.status === 'active') {
      throw new AppError('ALREADY_ACTIVE', 400, 'Sprint is already active');
    }

    const updated = await deps.sprintRepo.update(sprintId, { status: 'active' });

    // Log activity
    const project = await deps.projectRepo.findById(sprint.projectId);
    if (project) {
      await deps.auditService.logProjectAction(
        sprint.projectId,
        project.workspaceId,
        'sprint_started',
        userId,
        {},
        `Sprint "${sprint.name}" started`
      );
    }

    return updated;
  },

  /**
   * Complete sprint (change status to completed)
   * Authorization: User must be project lead or owner
   */
  completeSprint: async (sprintId: string, userId: string) => {
    const sprint = await deps.sprintRepo.findById(sprintId);
    if (!sprint) {
      throw new AppError('SPRINT_NOT_FOUND', 404, 'Sprint not found');
    }

    // Check authorization
    const userRole = await deps.projectRepo.getUserRole(sprint.projectId, userId);
    if (!userRole || !['lead', 'owner'].includes(userRole)) {
      throw new ForbiddenError('Only project lead can complete sprints');
    }

    const updated = await deps.sprintRepo.update(sprintId, { status: 'completed' });

    // Log activity
    const project = await deps.projectRepo.findById(sprint.projectId);
    if (project) {
      await deps.auditService.logProjectAction(
        sprint.projectId,
        project.workspaceId,
        'sprint_completed',
        userId,
        {},
        `Sprint "${sprint.name}" completed`
      );
    }

    return updated;
  },

  /**
   * Get sprint statistics
   */
  getSprintStats: async (sprintId: string) => {
    return deps.sprintRepo.getStatistics(sprintId);
  },

  /**
   * List sprints for project
   */
  listSprints: async (projectId: string, options?: { status?: string }) => {
    return deps.sprintRepo.findByProjectId(projectId, options);
  },

  /**
   * Get active sprint for project
   */
  getActiveSprint: async (projectId: string) => {
    return deps.sprintRepo.getActiveSprint(projectId);
  },

  /**
   * Delete sprint
   * Authorization: User must be project lead or owner
   */
  deleteSprint: async (sprintId: string, userId: string) => {
    const sprint = await deps.sprintRepo.findById(sprintId);
    if (!sprint) {
      throw new AppError('SPRINT_NOT_FOUND', 404, 'Sprint not found');
    }

    // Check authorization
    const userRole = await deps.projectRepo.getUserRole(sprint.projectId, userId);
    if (!userRole || !['lead', 'owner'].includes(userRole)) {
      throw new ForbiddenError('Only project lead can delete sprints');
    }

    // Remove all issues from sprint first
    const issues = sprint.issues;
    for (const issue of issues) {
      await deps.sprintRepo.removeIssue(issue.id);
    }

    const deleted = await deps.sprintRepo.delete(sprintId);

    // Log activity
    const project = await deps.projectRepo.findById(sprint.projectId);
    if (project) {
      await deps.auditService.logProjectAction(
        sprint.projectId,
        project.workspaceId,
        'sprint_deleted',
        userId,
        {},
        `Sprint "${sprint.name}" deleted`
      );
    }

    return deleted;
  },
});

export type SprintService = ReturnType<typeof createSprintService>;
