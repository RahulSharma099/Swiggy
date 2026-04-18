# Tech Stack Deep Dive

## Overview

This platform is built on a modern, type-safe JavaScript stack optimized for scalability and developer experience. Each technology was selected for specific strengths and how well they integrate with each other.

---

## 1. Express.js (Web Framework)

### Why Express?

**Strengths**:

- Minimal, unopinionated framework that doesn't force architectural decisions
- Battle-tested in production at companies like Uber, Airbnb, Netflix
- Excellent middleware ecosystem
- Very fast (no heavy abstractions; direct HTTP handling)
- Easy to learn and debug (thin layer over Node.js HTTP)

**Weaknesses**:

- Routing can become unwieldy without discipline
- Requires manual setup for best practices
- No built-in validation or ORM (solved by Zod + Prisma)

### Express Configuration

```typescript
// src/config/express.ts
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "../middleware/errorHandler";
import { authMiddleware } from "../middleware/auth";

export function setupExpress(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin:
        process.env.ALLOWED_ORIGINS?.split(",") || "http://localhost:3000",
      credentials: true,
    }),
  );

  // Request logging
  app.use(morgan("combined"));

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Authentication middleware (applied to protected routes)
  app.use("/api", authMiddleware);

  // Routes
  app.use("/api/projects", projectRoutes);
  app.use("/api/issues", issueRoutes);
  app.use("/api/sprints", sprintRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/search", searchRoutes);

  // Health check (no auth required)
  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found", path: req.path });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

// src/index.ts
import { setupExpress } from "./config/express";
import { PrismaClient } from "@prisma/client";

const app = setupExpress();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});
```

### Middleware Patterns

#### Authentication Middleware

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface AuthRequest extends Request {
  user?: { id: string; workspaceId: string; email: string };
  token?: string;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      workspaceId: string;
      email: string;
    };

    req.user = {
      id: decoded.userId,
      workspaceId: decoded.workspaceId,
      email: decoded.email,
    };
    req.token = token;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

function extractToken(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
```

#### Validation Middleware

```typescript
// src/middleware/validate.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateRequest(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await schema.parseAsync(req.body);
      req.body = data; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          issues: error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
            code: e.code,
          })),
        });
      }
      next(error);
    }
  };
}
```

#### Error Handler Middleware

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  logger.error({
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
  }

  // Default to 500
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}

export { AppError };
```

### Request-Response Pattern

```typescript
// src/controllers/IssueController.ts
import { Router, Request, Response, NextFunction } from "express";
import { validateRequest } from "../middleware/validate";
import { CreateIssueSchema } from "../schemas/issues";
import { IssueService } from "../services/IssueService";

const router = Router();

interface AuthRequest extends Request {
  user: { id: string; workspaceId: string };
}

// POST /api/projects/:projectId/issues
router.post(
  "/:projectId/issues",
  validateRequest(CreateIssueSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const issueService = getIssueService(); // DI container

      const issue = await issueService.createIssue({
        projectId,
        workspaceId: req.user.workspaceId,
        userId: req.user.id,
        data: req.body, // Already validated
      });

      res.status(201).json({
        success: true,
        data: issue,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
```

---

## 2. TypeScript (Type Safety)

### Why TypeScript?

**Strengths**:

- Catches type errors at compile time (before runtime failures)
- Excellent IDE autocomplete and inline documentation
- Makes refactoring safe (rename safe with full coverage)
- Self-documenting code (types as living documentation)

**Weaknesses**:

- Build step required (compilation)
- Learning curve for new developers
- Can introduce false sense of security (runtime data still needs validation)

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true, // Enable all strict checks
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["packages/shared/src/*"]
    }
  },
  "include": ["src", "packages/shared/src"],
  "exclude": ["node_modules", "dist"]
}
```

### Type Organization

```typescript
// packages/shared/src/types/index.ts
// Central location for shared types

// User & Authentication
export interface User {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
  role: "owner" | "lead" | "developer" | "viewer";
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContext {
  userId: string;
  workspaceId: string;
  email: string;
  role: User["role"];
}

// Issue & Project
export type IssueType = "epic" | "story" | "task" | "bug" | "subtask";
export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done";

export interface Issue {
  id: string;
  projectId: string;
  type: IssueType;
  status: IssueStatus;
  title: string;
  description?: string;
  assigneeId?: string;
  reporterId: string;
  parentId?: string;
  epicId?: string;
  sprintId?: string;
  storyPoints?: number;
  priority: "low" | "medium" | "high" | "critical";
  version: number; // Optimistic locking
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateIssueInput {
  type: IssueType;
  title: string;
  description?: string;
  parentId?: string;
  epicId?: string;
  storyPoints?: number;
  priority?: Issue["priority"];
  customFields?: Record<string, unknown>;
}

// Service layer return types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// API request/response types
export interface ApiRequest<T = unknown> {
  body: T;
  params: Record<string, string>;
  query: Record<string, string>;
  user: AuthContext;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: Date;
}
```

### Generic Types for Services

```typescript
// src/services/BaseService.ts
import { PrismaClient } from "@prisma/client";

export abstract class BaseService {
  protected prisma: PrismaClient;
  protected logger: Logger;

  constructor(prisma: PrismaClient, logger: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  // Common authorization check
  protected async validateWorkspaceAccess(
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        workspaceId,
      },
    });
    return !!user;
  }

  // Common error handling
  protected handleError(error: unknown, context: string): never {
    this.logger.error({ error, context });
    throw error; // Re-thrown for controller to handle
  }
}

// Usage in service
export class IssueService extends BaseService {
  async createIssue(
    input: CreateIssueInput,
    workspaceId: string,
    userId: string,
  ): Promise<Issue> {
    // Authorization check
    await this.validateWorkspaceAccess(userId, workspaceId);

    // Validation, creation, etc.
    const issue = await this.prisma.issue.create({
      data: {
        ...input,
        projectId: input.projectId,
        reporterId: userId,
      },
    });

    return issue;
  }
}
```

---

## 3. Prisma (Object-Relational Mapping)

### Why Prisma?

**Strengths**:

- **Type-safe queries**: Generated Prisma Client is fully typed
- **Schema as code**: Single source of truth for data model
- **Migrations**: Type-safe schema changes with rollback
- **Relations**: Powerful include/select for nested queries
- **Introspection**: Can generate Prisma schema from existing database

**Weaknesses**:

- Can generate N+1 queries if not careful with relations
- Complex queries sometimes easier to write raw SQL
- Relatively new (less battle-tested than Sequelize)

### Prisma Schema Structure

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// User and Workspace
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  passwordHash  String
  workspaceId   String
  role          String   @default("developer") // owner, lead, developer, viewer
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?

  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  issues        Issue[]   @relation("assignee")
  createdIssues Issue[]   @relation("reporter")
  comments      Comment[]
  watchers      Watcher[]
  activityLogs  ActivityLog[]

  @@index([workspaceId])
  @@index([email])
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  ownerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users    User[]
  projects Project[]

  @@index([ownerId])
}

// Project Management
model Project {
  id            String   @id @default(cuid())
  name          String
  description   String?
  workspaceId   String
  keyPrefix     String   @unique // e.g., "PROJ", "ENG"
  settings      Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workspace             Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  issues                Issue[]
  sprints               Sprint[]
  customFields          CustomField[]
  issueTransitions      IssueTransition[]

  @@index([workspaceId])
  @@unique([workspaceId, keyPrefix])
}

model Sprint {
  id            String   @id @default(cuid())
  projectId     String
  name          String
  startDate     DateTime
  endDate       DateTime
  status        String   @default("active") // active, completed, cancelled
  velocityTarget Int?
  actualVelocity Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  issues  Issue[]

  @@index([projectId])
  @@index([status])
}

model Issue {
  id            String        @id @default(cuid())
  projectId     String
  type          String        // epic, story, task, bug, subtask
  status        String        @default("backlog")
  title         String
  description   String?
  assigneeId    String?
  reporterId    String
  parentId      String?
  epicId        String?
  sprintId      String?
  storyPoints   Int?
  priority      String        @default("medium")
  version       Int           @default(1) // Optimistic locking
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?

  project               Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee              User?          @relation("assignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  reporter              User           @relation("reporter", fields: [reporterId], references: [id], onDelete: Restrict)
  parent                Issue?         @relation("parent", fields: [parentId], references: [id], onDelete: Cascade)
  children              Issue[]        @relation("parent")
  epic                  Issue?         @relation("epic", fields: [epicId], references: [id], onDelete: SetNull)
  epicChildren          Issue[]        @relation("epic")
  sprint                Sprint?        @relation(fields: [sprintId], references: [id], onDelete: SetNull)
  comments              Comment[]
  watchers              Watcher[]
  customFieldValues     CustomFieldValue[]
  activityLogs          ActivityLog[]

  @@index([projectId])
  @@index([status])
  @@index([assigneeId])
  @@index([sprintId])
  @@index([parentId])
  @@index([epicId])
  @@fulltext([title, description])
}

model Comment {
  id        String   @id @default(cuid())
  issueId   String
  authorId  String
  content   String
  mentions  Json     @default("[]") // Array of mentioned user IDs
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  issue  Issue  @relation(fields: [issueId], references: [id], onDelete: Cascade)
  author User   @relation(fields: [authorId], references: [id], onDelete: Restrict)

  @@index([issueId])
  @@index([authorId])
  @@fulltext([content])
}

model Watcher {
  userId    String
  issueId   String
  createdAt DateTime @default(now())

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  issue Issue  @relation(fields: [issueId], references: [id], onDelete: Cascade)

  @@id([userId, issueId])
  @@index([userId])
}

model ActivityLog {
  id            String   @id @default(cuid())
  issueId       String
  projectId     String
  actionType    String   // created, updated, deleted, transitioned
  changedFields Json     // { field: oldValue->newValue, ... }
  actorId       String
  createdAt     DateTime @default(now())

  issue   Issue   @relation(fields: [issueId], references: [id], onDelete: Cascade)
  actor   User    @relation(fields: [actorId], references: [id], onDelete: Restrict)

  @@index([issueId])
  @@index([projectId])
  @@index([createdAt])
}

model CustomField {
  id           String   @id @default(cuid())
  projectId    String
  fieldName    String
  fieldType    String   // text, number, dropdown, date, multiselect
  fieldConfig  Json     // { required: true, options: [...], validation: {...} }
  createdAt    DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  values  CustomFieldValue[]

  @@index([projectId])
  @@unique([projectId, fieldName])
}

model CustomFieldValue {
  id        String @id @default(cuid())
  issueId   String
  fieldId   String
  value     Json

  issue Issue       @relation(fields: [issueId], references: [id], onDelete: Cascade)
  field CustomField @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@unique([issueId, fieldId])
  @@index([issueId])
}

model IssueTransition {
  id           String @id @default(cuid())
  projectId    String
  fromStatus   String
  toStatus     String
  conditions   Json   @default("{}") // { requiresAssignee: true, ... }
  actions      Json   @default("{}") // { autoAssign: "role:lead", ... }

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, fromStatus, toStatus])
  @@index([projectId])
}
```

### Prisma Query Patterns

```typescript
// src/repositories/IssueRepository.ts
import { PrismaClient, Prisma } from "@prisma/client";

export class IssueRepository {
  constructor(private prisma: PrismaClient) {}

  // Simple CRUD
  async findById(issueId: string) {
    return this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        reporter: { select: { id: true, email: true, name: true } },
        comments: { select: { id: true, content: true, createdAt: true } },
        watchers: { select: { userId: true } },
      },
    });
  }

  // Nested hierarchical query
  async getIssueWithHierarchy(issueId: string) {
    return this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        parent: true,
        children: { include: { children: true } }, // 2-level nesting
        epic: true,
        epicChildren: true,
      },
    });
  }

  // Complex filtering with cursor pagination
  async listIssuesByProject(
    projectId: string,
    filters: {
      status?: string;
      assigneeId?: string;
      sprintId?: string | null;
    },
    pagination: { cursor?: string; take: number },
  ) {
    const where: Prisma.IssueWhereInput = {
      projectId,
      deletedAt: null,
      ...(filters.status && { status: filters.status }),
      ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters.sprintId !== undefined && { sprintId: filters.sprintId }),
    };

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
        skip: pagination.cursor ? 1 : 0,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
        include: { assignee: true, sprint: true },
      }),
      this.prisma.issue.count({ where }),
    ]);

    return { issues, total, hasMore: issues.length === pagination.take };
  }

  // Transaction for atomic operations
  async moveIssuesToSprint(
    issueIds: string[],
    sprintId: string,
    workspaceId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Verify sprint exists in correct workspace
      const sprint = await tx.sprint.findFirst({
        where: {
          id: sprintId,
          project: { workspaceId },
        },
      });

      if (!sprint) throw new Error("Sprint not found");

      // Update all issues
      const updatedIssues = await tx.issue.updateMany({
        where: { id: { in: issueIds } },
        data: { sprintId, updatedAt: new Date() },
      });

      // Log activity
      await Promise.all(
        issueIds.map((issueId) =>
          tx.activityLog.create({
            data: {
              issueId,
              projectId: sprint.projectId,
              actionType: "moved",
              changedFields: {
                sprintId: { from: null, to: sprintId },
              },
              actorId: userId,
            },
          }),
        ),
      );

      return updatedIssues;
    });
  }

  // Full-text search
  async searchIssues(projectId: string, query: string) {
    return this.prisma.issue.findMany({
      where: {
        projectId,
        OR: [{ title: { search: query } }, { description: { search: query } }],
      },
      select: { id: true, title: true, status: true },
    });
  }

  // Optimistic locking
  async updateWithVersionCheck(
    issueId: string,
    expectedVersion: number,
    data: Prisma.IssueUpdateInput,
  ) {
    const result = await this.prisma.issue.updateMany({
      where: {
        id: issueId,
        version: expectedVersion, // Only update if version matches
      },
      data: {
        ...data,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new ConflictError("Issue was modified by another user");
    }

    return this.prisma.issue.findUnique({ where: { id: issueId } });
  }
}
```

### Prisma Migrations

```bash
# Generate migration after schema change
npx prisma migrate dev --name add_custom_fields

# The migration is type-safe and can be reviewed
# Generated file: prisma/migrations/20240418_add_custom_fields/migration.sql
```

---

## 4. Zod (Input Validation)

### Why Zod?

**Strengths**:

- **Runtime validation**: Validates actual data at runtime (TypeScript types don't)
- **Composable schemas**: Build complex validators from simple ones
- **Great error messages**: Clear, actionable validation feedback
- **Perfect TypeScript integration**: `z.infer<typeof schema>` gets type from schema

**Weaknesses**:

- Validation happens at runtime (performance consideration for large payloads)
- Can be verbose for very complex schemas

### Validation Schema Organization

```typescript
// src/schemas/index.ts
import { z } from "zod";

// Reusable primitive schemas
const id = z.string().cuid();
const email = z.string().email();
const url = z.string().url();
const dateTime = z.date().or(z.string().datetime());

// Issue type and status enums
const issueType = z.enum(["epic", "story", "task", "bug", "subtask"]);
const issueStatus = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
]);
const issuePriority = z.enum(["low", "medium", "high", "critical"]);

// Issue schemas
export const CreateIssueSchema = z.object({
  type: issueType,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  parentId: id.optional(),
  epicId: id.optional(),
  storyPoints: z.number().int().min(1).max(100).optional(),
  priority: issuePriority.optional(),
  customFields: z.record(z.unknown()).optional(),
});

export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;

export const UpdateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: issueStatus.optional(),
  assigneeId: id.optional(),
  storyPoints: z.number().int().min(1).max(100).optional(),
  priority: issuePriority.optional(),
  sprintId: id.nullish(), // Allow null to remove from sprint
  version: z.number(), // For optimistic locking
});

export type UpdateIssueInput = z.infer<typeof UpdateIssueSchema>;

export const TransitionIssueSchema = z.object({
  status: issueStatus,
  version: z.number(),
});

export type TransitionIssueInput = z.infer<typeof TransitionIssueSchema>;

// Sprint schemas
export const CreateSprintSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: dateTime,
  endDate: dateTime,
  velocityTarget: z.number().int().positive().optional(),
});

export type CreateSprintInput = z.infer<typeof CreateSprintSchema>;

// Comment schemas
export const CreateCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  mentions: z.array(id).optional(),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

// Search schemas
export const SearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type SearchInput = z.infer<typeof SearchSchema>;

export const FilterSchema = z.object({
  status: z.string().optional(),
  assigneeId: id.optional(),
  sprintId: id.nullish(),
  priority: issuePriority.optional(),
  type: issueType.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type FilterInput = z.infer<typeof FilterSchema>;
```

### Using Zod in Controllers

```typescript
// src/controllers/IssueController.ts
import { Router, Request, Response, NextFunction } from "express";
import { validateRequest } from "../middleware/validate";
import { CreateIssueSchema, UpdateIssueSchema } from "../schemas";
import { IssueService } from "../services/IssueService";

const router = Router();

// POST /api/projects/:projectId/issues
router.post(
  "/:projectId/issues",
  validateRequest(CreateIssueSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const validated = req.body as z.infer<typeof CreateIssueSchema>;

      const issue = await issueService.createIssue({
        projectId,
        workspaceId: req.user.workspaceId,
        userId: req.user.id,
        ...validated,
      });

      res.status(201).json({ success: true, data: issue });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/issues/:issueId
router.patch(
  "/:issueId",
  validateRequest(UpdateIssueSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { issueId } = req.params;
      const validated = req.body as z.infer<typeof UpdateIssueSchema>;

      const issue = await issueService.updateIssue({
        issueId,
        workspaceId: req.user.workspaceId,
        userId: req.user.id,
        ...validated,
      });

      res.json({ success: true, data: issue });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
```

### Custom Validators

```typescript
// src/schemas/custom.ts
import { z } from "zod";

// Validate parent-child issue hierarchy
export const validateIssueHierarchy = z
  .object({
    type: z.enum(["epic", "story", "task", "bug", "subtask"]),
    parentType: z.enum(["epic", "story", "task", "bug", "subtask"]).optional(),
  })
  .refine(
    (data) => {
      // Subtasks can't have another subtask as parent
      if (data.type === "subtask" && data.parentType === "subtask") {
        return false;
      }
      return true;
    },
    { message: "Subtasks cannot have subtasks as parents" },
  );

// Validate date range
export const validateDateRange = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
  });

// Validate custom field value against field type
export const validateCustomFieldValue = (fieldType: string, value: unknown) => {
  switch (fieldType) {
    case "text":
      return z.string().safeParse(value).success;
    case "number":
      return z.number().safeParse(value).success;
    case "date":
      return z.date().safeParse(value).success;
    case "dropdown":
      return z.string().safeParse(value).success;
    default:
      return false;
  }
};
```

---

## 5. JavaScript Runtime Optimizations

### Dependency Injection

```typescript
// src/di/Container.ts
import { PrismaClient } from "@prisma/client";
import { Logger } from "../utils/logger";
import { IssueService } from "../services/IssueService";
import { SprintService } from "../services/SprintService";

class DIContainer {
  private services: Map<string, unknown> = new Map();

  constructor() {
    this.registerSingletons();
  }

  private registerSingletons() {
    const prisma = new PrismaClient();
    const logger = new Logger();

    this.services.set("prisma", prisma);
    this.services.set("logger", logger);

    // Register service factories
    this.services.set(
      "IssueService",
      () => new IssueService(prisma, logger, this.get("IssueRepository")),
    );
  }

  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) throw new Error(`Service ${key} not found in container`);
    return service as T;
  }

  set<T>(key: string, value: T) {
    this.services.set(key, value);
  }
}

export const container = new DIContainer();
```

### Connection Pooling

```typescript
// src/config/database.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Configure connection pooling in .env
// DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public&connection_limit=20&pool_timeout=10"
```

### Error Handling in Async Operations

```typescript
// src/utils/asyncHandler.ts
import { Request, Response, NextFunction } from "express";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next); // Catches all async errors
  };
}

// Usage
router.post(
  "/issues",
  asyncHandler(async (req, res, next) => {
    const issue = await issueService.createIssue(req.body);
    res.json({ data: issue });
  }),
);
```

---

## Performance Considerations

### Query Optimization

```typescript
// ❌ N+1 problem: queries DB for each comment's author
const issues = await prisma.issue.findMany();
for (const issue of issues) {
  const comments = await prisma.comment.findMany({
    where: { issueId: issue.id },
  });
  for (const comment of comments) {
    // This queries for author separately!
    const author = await prisma.user.findUnique({
      where: { id: comment.authorId },
    });
  }
}

// ✅ Efficient: all data loaded in one query
const issues = await prisma.issue.findMany({
  include: {
    comments: {
      include: {
        author: { select: { id: true, name: true } },
      },
    },
  },
});
```

### Batch Processing

```typescript
// src/services/BatchService.ts
export class BatchService {
  async processIssuesInBatches(
    issueIds: string[],
    processor: (batch: string[]) => Promise<void>,
    batchSize: number = 100,
  ) {
    for (let i = 0; i < issueIds.length; i += batchSize) {
      const batch = issueIds.slice(i, i + batchSize);
      await processor(batch);
    }
  }
}
```

---

## Summary Table

| Technology     | Purpose               | Why This Choice                            |
| -------------- | --------------------- | ------------------------------------------ |
| **Express**    | HTTP server & routing | Lightweight, fast, battle-tested           |
| **TypeScript** | Type safety           | Catches bugs early; excellent IDE support  |
| **Prisma**     | Database access       | Type-safe, migrations, relations           |
| **Zod**        | Input validation      | Runtime validation; TypeScript integration |
| **PostgreSQL** | Relational DB         | ACID, JSONB, FTS, scalable                 |
| **Redis**      | Pub/Sub & cache       | Fast pub/sub; atomic operations            |
| **Jest**       | Testing               | Great TypeScript support; snapshot testing |

---

**Next**: [04-TURBOREPO-STRUCTURE.md](./04-TURBOREPO-STRUCTURE.md) for repository organization.
