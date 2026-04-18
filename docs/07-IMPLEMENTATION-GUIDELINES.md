# Implementation Guidelines & Best Practices

## Overview

This document provides concrete guidelines for implementing features in the platform following SDE3 standards: type safety, testability, maintainability, and performance.

---

## Code Organization

### File Structure Template

```
packages/api/src/
├── controllers/
│   ├── __tests__/
│   │   └── IssueController.test.ts
│   └── IssueController.ts
├── services/
│   ├── __tests__/
│   │   └── IssueService.test.ts
│   └── IssueService.ts
├── repositories/
│   ├── __tests__/
│   │   └── IssueRepository.test.ts
│   └── IssueRepository.ts
├── middleware/
│   ├── __tests__/
│   │   └── auth.test.ts
│   └── auth.ts
├── routes/
│   └── issues.ts
├── schemas/
│   └── issues.ts
└── utils/
    └── response.ts
```

**Rule**: One file per class/major function; group related tests in `__tests__` directory.

---

## Coding Standards

### 1. TypeScript Strict Mode

**Always run with strict mode enabled**:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

**This means**:

- No `any` types (use generics or `unknown`)
- Declare all function return types explicitly
- No optional parameters without defaults
- Every code path must return a value

### 2. Error Handling

Create custom error classes:

```typescript
// shared/utils/errors.ts

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = "INTERNAL_ERROR",
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, `${resource} not found: ${id}`, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = "CONFLICT") {
    super(409, message, code);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, code: string = "UNPROCESSABLE_ENTITY") {
    super(422, message, code);
  }
}
```

**Never use naked `throw new Error()`; always throw typed AppError subclass.**

### 3. Logging

Use structured logging:

```typescript
// shared/utils/logger.ts
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.json(),
  defaultMeta: { service: "pms-api" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
});

// Usage
logger.info("Process started", { pid: process.pid });
logger.error("Database error", { error: err.message, userId: user.id });
logger.warn("High memory usage", { memoryUsage: process.memoryUsage() });
```

### 4. Function Documentation

All functions must have JSDoc comments:

```typescript
/**
 * Creates a new issue in the project.
 *
 * @param input - Issue creation input with validation
 * @param workspaceId - Workspace context for authorization
 * @param userId - User performing the action
 * @returns Promise<Issue> - Created issue with full details
 * @throws ValidationError if input is invalid
 * @throws UnauthorizedError if user not in workspace
 * @throws ConflictError if parent issue type hierarchy violated
 *
 * @example
 * const issue = await issueService.createIssue(
 *   { type: 'story', title: '...' },
 *   'ws_123',
 *   'user_456'
 * );
 */
async createIssue(
  input: CreateIssueInput,
  workspaceId: string,
  userId: string
): Promise<Issue> {
  // Implementation
}
```

### 5. Naming Conventions

| Type            | Pattern                                          | Example                                         |
| --------------- | ------------------------------------------------ | ----------------------------------------------- |
| Class           | PascalCase                                       | `IssueService`, `UserRepository`                |
| Method          | camelCase                                        | `createIssue()`, `findById()`                   |
| Variable        | camelCase                                        | `const issueId = '...'`                         |
| Constant        | UPPER_SNAKE_CASE                                 | `const MAX_BATCH_SIZE = 100`                    |
| File            | kebab-case for utilities, PascalCase for classes | `issue.service.ts`, `config/express.ts`         |
| Database column | snake_case                                       | `created_at`, `user_id`                         |
| API endpoint    | kebab-case                                       | `/api/projects/{projectId}/sprints`             |
| TypeScript type | PascalCase                                       | `type IssueStatus = '...'`, `interface User {}` |

---

## Dependency Injection Pattern

All services should accept dependencies in constructor:

```typescript
// services/IssueService.ts

export class IssueService {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger,
    private issueRepository: IssueRepository,
    private eventPublisher: EventPublisher,
    private workflowEngine: WorkflowEngine,
  ) {}

  async createIssue(input: CreateIssueInput): Promise<Issue> {
    // Service uses injected dependencies
    this.logger.info("Creating issue", { title: input.title });
    const issue = await this.issueRepository.create(input);
    await this.eventPublisher.emit("issue_created", issue);
    return issue;
  }
}

// In controller
export const issueService = new IssueService(
  prisma,
  logger,
  new IssueRepository(prisma),
  new EventPublisher(redis),
  new WorkflowEngine(prisma),
);

// OR use DI container
const issueService = diContainer.get<IssueService>("IssueService");
```

**Benefits**:

- Easy to mock in tests
- Services not coupled to implementation details
- Can swap implementations (e.g., Redis → RabbitMQ)

---

## Service Layer Pattern

Services contain business logic; never put logic in controllers.

```typescript
// ❌ BAD: Logic in controller
app.post("/issues", async (req, res) => {
  const issue = await prisma.issue.create({ data: req.body });
  const watchers = await prisma.watcher.findMany({
    where: { issueId: issue.id },
  });
  for (const watcher of watchers) {
    await sendNotification(watcher.userId, `New issue: ${issue.title}`);
  }
  res.json(issue);
});

// ✅ GOOD: Logic in service, callable from anywhere
class IssueService {
  async createIssue(input: CreateIssueInput): Promise<Issue> {
    const issue = await this.issueRepository.create(input);
    await this.notificationService.notifyWatchers(
      issue.id,
      `New issue: ${issue.title}`,
    );
    await this.eventPublisher.emit("issue_created", issue);
    return issue;
  }
}

// Controller just calls service
app.post("/issues", async (req, res, next) => {
  try {
    const issue = await issueService.createIssue(req.body);
    res.status(201).json({ success: true, data: issue });
  } catch (error) {
    next(error);
  }
});
```

---

## Repository Pattern

Repositories encapsulate all database queries. Services never call `prisma` directly.

```typescript
// ❌ BAD: Service calls prisma directly
class IssueService {
  async getIssue(issueId: string) {
    return prisma.issue.findUnique({ where: { id: issueId } });
  }
}

// ✅ GOOD: Service uses repository
class IssueService {
  constructor(private issueRepository: IssueRepository) {}

  async getIssue(issueId: string) {
    const issue = await this.issueRepository.findById(issueId);
    if (!issue) throw new NotFoundError("Issue", issueId);
    return issue;
  }
}

class IssueRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(issueId: string): Promise<Issue | null> {
    return this.prisma.issue.findUnique({ where: { id: issueId } });
  }
}
```

**Why**:

- Easy to mock repository in service tests
- Query optimization centralized
- Consistent error handling

---

## Testing Strategy

### Unit Tests (Service Layer)

```typescript
// services/__tests__/IssueService.test.ts
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { IssueService } from "../IssueService";
import { IssueRepository } from "../../repositories/IssueRepository";
import { EventPublisher } from "../EventPublisher";

describe("IssueService", () => {
  let issueService: IssueService;
  let mockRepository: jest.Mocked<IssueRepository>;
  let mockPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    // Mock dependencies
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    mockPublisher = {
      emit: jest.fn(),
    };

    issueService = new IssueService(mockRepository, mockPublisher);
  });

  it("should create issue and emit event", async () => {
    // Arrange
    const input = { type: "story", title: "Test" };
    const createdIssue = { id: "issue_123", ...input };
    mockRepository.create.mockResolvedValue(createdIssue);

    // Act
    const result = await issueService.createIssue(input, "user_123");

    // Assert
    expect(result).toEqual(createdIssue);
    expect(mockRepository.create).toHaveBeenCalledWith(input);
    expect(mockPublisher.emit).toHaveBeenCalledWith(
      "issue_created",
      createdIssue,
    );
  });

  it("should throw ValidationError for invalid input", async () => {
    const input = { type: "invalid", title: "" };

    await expect(issueService.createIssue(input, "user_123")).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw error if parent hierarchy invalid", async () => {
    const input = { type: "epic", parentId: "parent_123" };

    await expect(issueService.createIssue(input, "user_123")).rejects.toThrow(
      "Epics cannot have parents",
    );
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/issues.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { setupExpress } from "../../config/express";
import request from "supertest";

describe("Issues API Integration", () => {
  let prisma: PrismaClient;
  let app: Express;
  let token: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    app = setupExpress();

    // Create test user and get token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password" });

    token = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create issue and retrieve it", async () => {
    // Create issue
    const createRes = await request(app)
      .post("/api/projects/proj_123/issues")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "story",
        title: "Integration test issue",
        storyPoints: 5,
      });

    expect(createRes.status).toBe(201);
    const issueId = createRes.body.data.id;

    // Retrieve issue
    const getRes = await request(app)
      .get(`/api/issues/${issueId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.title).toBe("Integration test issue");
  });
});
```

### Test Coverage Goals

- **Services**: 80%+ coverage
- **Repositories**: 70%+ coverage (focus on complex queries)
- **API endpoints**: Critical paths (CRUD, workflow transitions)
- **Utilities**: 90%+ coverage (error handling, validators)

---

## Performance Considerations

### Query Optimization

```typescript
// ❌ BAD: N+1 queries
async function getProjectIssues(projectId: string) {
  const issues = await prisma.issue.findMany({
    where: { projectId },
  });

  // This queries for each issue's assignee separately (N+1)
  for (const issue of issues) {
    issue.assignee = await prisma.user.findUnique({
      where: { id: issue.assigneeId },
    });
  }

  return issues;
}

// ✅ GOOD: Single query with includes
async function getProjectIssues(projectId: string) {
  return prisma.issue.findMany({
    where: { projectId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      sprint: { select: { id: true, name: true } },
    },
  });
}
```

### Batch Processing

```typescript
// ❌ BAD: Update each issue individually
async function moveIssuesToSprint(issueIds: string[], sprintId: string) {
  for (const issueId of issueIds) {
    await prisma.issue.update({
      where: { id: issueId },
      data: { sprintId },
    });
  }
}

// ✅ GOOD: Batch update in single query
async function moveIssuesToSprint(issueIds: string[], sprintId: string) {
  return prisma.issue.updateMany({
    where: { id: { in: issueIds } },
    data: { sprintId },
  });
}
```

### Caching Strategy

```typescript
// Cache frequently accessed data
class CacheService {
  constructor(private redis: Redis) {}

  async getProjectSettings(projectId: string): Promise<ProjectSettings> {
    const cacheKey = `project:${projectId}:settings`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Fetch from DB
    const settings = await prisma.project.findUnique({
      where: { id: projectId },
    });

    // Store in cache (1 hour TTL)
    await this.redis.setex(cacheKey, 3600, JSON.stringify(settings));

    return settings;
  }

  invalidateProjectSettings(projectId: string): void {
    this.redis.del(`project:${projectId}:settings`);
  }
}
```

---

## Security Best Practices

### 1. Never Log Sensitive Data

```typescript
// ❌ BAD
logger.info("User login", { email, password, token });

// ✅ GOOD
logger.info("User login", { email, userId });
```

### 2. Validate All Inputs

```typescript
// Always use Zod schemas
import { CreateIssueSchema } from "@shared/schemas";

app.post("/issues", async (req, res, next) => {
  try {
    // This throws if invalid
    const validated = await CreateIssueSchema.parseAsync(req.body);
    // Use validated, not req.body
    const issue = await issueService.createIssue(validated);
    res.json(issue);
  } catch (error) {
    next(error); // Zod errors handled by middleware
  }
});
```

### 3. Check Authorization on Every Query

```typescript
// ❌ BAD: Return issue without checking user's workspace
async getIssue(issueId: string) {
  return prisma.issue.findUnique({ where: { id: issueId } });
}

// ✅ GOOD: Verify workspace membership
async getIssue(issueId: string, workspaceId: string) {
  const issue = await prisma.issue.findFirst({
    where: {
      id: issueId,
      project: { workspaceId }  // Ensures workspace isolation
    }
  });

  if (!issue) throw new NotFoundError('Issue', issueId);
  return issue;
}
```

### 4. Use Prepared Statements

Prisma automatically uses prepared statements:

```typescript
// ✅ GOOD: Prisma parameterizes queries
await prisma.issue.findMany({
  where: { title: userInput }, // Safe from SQL injection
});

// ❌ NEVER do raw SQL concatenation
// await prisma.$queryRaw(`SELECT * FROM issues WHERE title = '${userInput}'`)
```

---

## Code Review Checklist

Before submitting PR:

- [ ] TypeScript strict mode passes (`npm run type-check`)
- [ ] All functions have JSDoc comments
- [ ] No `any` types; all types properly declared
- [ ] Error handling: try-catch around async operations
- [ ] Tests: 80%+ coverage for changed code
- [ ] No console.logs; use structured logging
- [ ] No sensitive data in logs
- [ ] Authorization checks on all queries/mutations
- [ ] Request validation with Zod
- [ ] Response formatted with standard envelope
- [ ] Database queries optimized (no N+1)
- [ ] No direct DB calls in controllers/handlers

---

## Commit Message Convention

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

**Examples**:

```
feat(issues): add custom fields support
fix(auth): refresh token expiration handling
refactor(repositories): consolidate query methods
test(workflow): add transition validation tests
docs(api): update endpoint documentation
```

---

## Documentation Requirements

Every module should have:

1. **Package README** (`packages/*/README.md`)
   - Purpose
   - Key exports
   - Development setup

2. **Inline Comments** (for non-obvious logic)

   ```typescript
   // Use optimistic locking to handle concurrent updates
   // If version mismatch, query returns 0 results
   const updated = await prisma.issue.updateMany({
     where: { id, version },
     data: { ...updates, version: { increment: 1 } },
   });
   ```

3. **Architecture Decision Records** (for major decisions)
   - Document in `/docs/adr/` folder
   - Template: Problem → Options → Decision → Consequences

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feat/issue-custom-fields

# Make changes, commit often
git add .
git commit -m "feat(issues): add custom field storage"

# Push and create PR
git push origin feat/issue-custom-fields
# Create PR on GitHub

# After review, squash and merge
git rebase main
git merge --squash feat/issue-custom-fields
git push origin main
```

---

## Deployment Checks

Before deploying:

- [ ] All tests passing
- [ ] No console.logs
- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] Feature flags enabled/disabled appropriately
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

---

**Questions?** Refer to specific documentation files or open an issue.
