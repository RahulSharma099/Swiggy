export { createIssueRepository } from './issue';
export type { IssueRepository } from './issue';

export { createProjectRepository } from './project';
export type { ProjectRepository } from './project';

export { createWorkspaceRepository } from './workspace';
export type { WorkspaceRepository } from './workspace';

export { createUserRepository } from './user';
export type { UserRepository } from './user';

export { createWorkflowRepository } from './workflow';
export type { WorkflowRepository } from './workflow';

export { createSprintRepository } from './sprint';
export type { SprintRepository } from './sprint';

export { createCommentRepository } from './comment';
export type { CommentRepository } from './comment';

export { createSearchRepository } from './search';
export type { SearchRepository } from './search';

export { createSearchAnalyticsRepository } from './search-analytics';
export type { SearchAnalyticsRepository } from './search-analytics';

/**
 * Create all repositories with dependency injection
 */
export const createRepositories = (prisma: any) => ({
  issue: require('./issue').createIssueRepository(prisma),
  project: require('./project').createProjectRepository(prisma),
  workspace: require('./workspace').createWorkspaceRepository(prisma),
  user: require('./user').createUserRepository(prisma),
});
