export { createIssueService } from './issue';
export type { IssueService } from './issue';

export { createProjectService } from './project';
export type { ProjectService } from './project';

export { createWorkspaceService } from './workspace';
export type { WorkspaceService } from './workspace';

/**
 * Create all services with dependency injection
 */
export const createServices = (deps: any) => ({
  issue: require('./issue').createIssueService({
    issueRepo: deps.repositories.issue,
    projectRepo: deps.repositories.project,
    workspaceRepo: deps.repositories.workspace,
    prisma: deps.prisma,
  }),
  project: require('./project').createProjectService({
    projectRepo: deps.repositories.project,
    workspaceRepo: deps.repositories.workspace,
    prisma: deps.prisma,
  }),
  workspace: require('./workspace').createWorkspaceService({
    workspaceRepo: deps.repositories.workspace,
    prisma: deps.prisma,
  }),
});
