export { createIssueService } from './issue';
export type { IssueService } from './issue';

export { createProjectService } from './project';
export type { ProjectService } from './project';

export { createWorkspaceService } from './workspace';
export type { WorkspaceService } from './workspace';

export { createWorkflowEngine } from './workflow.engine';
export type { WorkflowEngine } from './workflow.engine';

export { createSprintService } from './sprint';
export type { SprintService } from './sprint';

export { createCommentService } from './comment';
export type { CommentService } from './comment';

export { createSearchService } from './search';
export type { SearchService } from './search';

export { createSearchAggregator } from './search-aggregator';
export type { SearchAggregator } from './search-aggregator';

export { createSearchCache } from './search-cache';
export type { SearchCache } from './search-cache';

export { createSearchAnalyticsService } from './search-analytics';
export type { SearchAnalyticsService } from './search-analytics';

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
