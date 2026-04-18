# Phase 2: Repository & Service Layers - Implementation Plan

## Overview
Phase 2 builds the business logic layer using functional programming patterns. We'll implement:
1. **Repository Layer** - Data access factories
2. **Service Layer** - Business logic factories with dependency injection
3. **Authorization** - Permission checks on every operation
4. **Audit Logging** - Track all mutations

## Architecture Pattern

```
Request → Handler (validates + auth) 
  ↓
Service (business logic, DI)
  ↓
Repository (data access)
  ↓
Prisma (database)
```

### Functional Pattern Example

```typescript
// Repository factory
const createIssueRepository = (prisma: PrismaClient) => ({
  create: async (data) => prisma.issue.create({ data }),
  findById: async (id) => prisma.issue.findUnique({ where: { id } }),
  update: async (id, data) => prisma.issue.update({ where: { id }, data }),
});

// Service factory
const createIssueService = (deps: { repo: IssueRepo, prisma: PrismaClient }) => ({
  createIssue: async (input, userId) => {
    // Validate
    // Check authorization
    // Log activity
    return deps.repo.create(input);
  },
});
```

## Phase 2.1: Repository Layer

### Structure
```
packages/api/src/repositories/
├── index.ts
├── issue.ts
├── project.ts
├── workspace.ts
└── user.ts
```

### What to Implement

#### IssueRepository
- `create(data)` - Create new issue
- `findById(id)` - Get single issue
- `findByProjectId(projectId, filters)` - Get issues in project
- `update(id, data)` - Update issue
- `delete(id)` - Soft delete issue
- `findByStatus(projectId, status)` - Query by status
- `findAssigned(userId)` - Get user's assigned issues
- `updateVersion(id, version)` - Optimistic locking

#### ProjectRepository
- `create(data)` - Create new project
- `findById(id)` - Get single project
- `findByWorkspaceId(workspaceId)` - List projects
- `update(id, data)` - Update project
- `delete(id)` - Delete project

#### WorkspaceRepository
- `create(data)` - Create workspace
- `findById(id)` - Get workspace
- `findAll()` - List all workspaces
- `update(id, data)` - Update workspace
- `addMember(workspaceId, userId, role)` - Add user
- `removeMember(workspaceId, userId)` - Remove user

### Key Patterns
- Pure functions (no side effects)
- Explicit parameter passing (no `this`)
- Error handling: throw domain errors from reposreturn  
- No authorization logic (handled by services)

## Phase 2.2: Service Layer

### Structure
```
packages/api/src/services/
├── index.ts
├── issue.ts
├── project.ts
├── workspace.ts
└── auth.ts
```

### What to Implement

#### IssueService
```typescript
createIssueService(deps: {
  repo: IssueRepository,
  projectRepo: ProjectRepository,
  prisma: PrismaClient,
  logger: Logger
}) => ({
  createIssue: async (input, userId) => {
    // 1. Validate input (Zod)
    // 2. Check authorization (user is project member)
    // 3. Verify project exists
    // 4. Create issue
    // 5. Log activity
    // 6. Return result
  },
  
  updateIssue: async (issueId, updates, userId) => {
    // 1. Get current issue
    // 2. Check authorization (assignee or lead)
    // 3. Validate version (optimistic locking)
    // 4. Update issue
    // 5. Log changes
    // 6. Return updated issue
  },
  
  deleteIssue: async (issueId, userId) => {
    // 1. Get issue
    // 2. Check authorization
    // 3. Soft delete
    // 4. Log deletion
  },
  
  assignIssue: async (issueId, assigneeId, userId) => {
    // 1. Get issue
    // 2. Check authorization (project lead+)
    // 3. Verify assignee is project member
    // 4. Update assignee
    // 5. Log assignment
  },
});
```

#### ProjectService & WorkspaceService
Similar pattern - authorization + business logic

## Phase 2.3: Authorization Checks

### Patterns
```typescript
// Check workspace membership
const checkWorkspaceMember = async (
  workspaceId: string,
  userId: string,
  prisma: PrismaClient
) => {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } }
  });
  if (!member) throw new ForbiddenError('Not a workspace member');
  return member;
};

// Check project membership
const checkProjectMember = async (
  projectId: string,
  userId: string,
  prisma: PrismaClient
) => {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  });
  if (!member) throw new ForbiddenError('Not a project member');
  return member;
};

// Check role
const checkRole = (member: ProjectMember, required: string[]) => {
  if (!required.includes(member.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }
};
```

## Phase 2.4: Audit Logging

### ActivityLog Schema
- `actionType`: 'created', 'updated', 'status_changed', 'assigned', 'deleted'
- `changedFields`: JSON diff of what changed
- `actorId`: Who made the change
- `timestamp`: When it happened

### Implementation
```typescript
const logActivity = async (
  prisma: PrismaClient,
  issueId: string,
  workspaceId: string,
  actionType: string,
  changedFields: Record<string, any>,
  actorId: string
) => {
  await prisma.activityLog.create({
    data: {
      issueId,
      workspaceId,
      actionType,
      changedFields,
      actorId,
    }
  });
};
```

## Phase 2.5: Handler Integration

### Updated Handler Pattern
```typescript
export const createUpdateIssueHandler = (service: IssueService) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { issueId } = req.params;
    const userId = req.user.id; // From auth middleware (Phase 3)
    
    const updated = await service.updateIssue(issueId, req.body, userId);
    
    res.json({ success: true, data: updated });
  };
};
```

## Testing Strategy

### Unit Tests
- Repository functions with mocked Prisma
- Service business logic with mocked repos
- Authorization check functions

### Integration Tests
- Service + Repository with real database
- Full workflow: create → update → list → delete

### Coverage Targets
- Repositories: 70% coverage
- Services: 80% coverage
- Handlers: 60% coverage

## Estimated Timeline
- Phase 2.1 (Repositories): 1-2 days
- Phase 2.2 (Services): 2-3 days
- Phase 2.3 (Authorization): 1 day
- Phase 2.4 (Audit Logging): 1 day
- Phase 2.5 (Testing): 1-2 days

## Files to Create
- `packages/api/src/repositories/*.ts` (5 files)
- `packages/api/src/services/*.ts` (4 files)
- `packages/api/src/utils/auth.ts` - Auth helpers
- `packages/api/src/utils/activity.ts` - Logging helpers
- Test files for each module
- Integration test suite

## Next Steps
1. Start with `IssueRepository` factory
2. Move to `ProjectRepository` and `WorkspaceRepository`
3. Implement `IssueService` with full business logic
4. Add authorization checks throughout
5. Wire services into existing handlers
6. Add comprehensive tests
