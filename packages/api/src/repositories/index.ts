export { createIssueRepository } from './issue';
export type { IssueRepository } from './issue';

export { createProjectRepository } from './project';
export type { ProjectRepository } from './project';

export { createWorkspaceRepository } from './workspace';
export type { WorkspaceRepository } from './workspace';

export { createUserRepository } from './user';
export type { UserRepository } from './user';

/**
 * Create all repositories with dependency injection
 */
export const createRepositories = (prisma: any) => ({
  issue: require('./issue').createIssueRepository(prisma),
  project: require('./project').createProjectRepository(prisma),
  workspace: require('./workspace').createWorkspaceRepository(prisma),
  user: require('./user').createUserRepository(prisma),
});
