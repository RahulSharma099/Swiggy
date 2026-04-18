# Prisma Database Design

## Database Schema Overview

The project uses PostgreSQL with Prisma ORM. The schema is organized around core domains: users, workspaces, projects, issues (hierarchical), sprints, comments, and audit trails.

---

## Complete Schema Definition

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}

// ============================================================================
// USERS & WORKSPACES
// ============================================================================

model User {
  id            String            @id @default(cuid())
  email         String            @unique
  name          String
  passwordHash  String            @map("password_hash")
  workspaceId   String            @map("workspace_id")
  role          String            @default("developer") // owner, lead, developer, viewer

  // Timestamps
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")
  deletedAt     DateTime?         @map("deleted_at")

  // Relations
  workspace     Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  // Issue relations
  assignedIssues    Issue[]       @relation("assignee")
  reportedIssues    Issue[]       @relation("reporter")

  // Comment/Activity relations
  comments      Comment[]
  activityLogs  ActivityLog[]
  watchers      Watcher[]

  // Indexes
  @@index([workspaceId])
  @@index([email])
  @@map("users")
}

model Workspace {
  id            String            @id @default(cuid())
  name          String
  ownerId       String

  // Settings stored as JSONB
  settings      Json              @default("{}")

  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  // Relations
  users         User[]
  projects      Project[]

  @@index([ownerId])
  @@map("workspaces")
}

// ============================================================================
// PROJECT & ISSUE MANAGEMENT
// ============================================================================

model Project {
  id            String            @id @default(cuid())
  workspaceId   String            @map("workspace_id")
  name          String
  description   String?
  keyPrefix     String            @map("key_prefix")  // e.g., "PROJ", "ENG"

  // Project configuration
  settings      Json              @default("{}")     // { defaultStatus, statusWorkflow, fieldDefinitions }

  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  // Relations
  workspace     Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  issues        Issue[]
  sprints       Sprint[]
  customFields  CustomField[]
  transitions   IssueTransition[]

  // Constraints & Indexes
  @@unique([workspaceId, keyPrefix])
  @@index([workspaceId])
  @@map("projects")
}

model Sprint {
  id              String          @id @default(cuid())
  projectId       String          @map("project_id")
  name            String
  status          String          @default("active")  // active, completed, cancelled

  // Date range
  startDate       DateTime        @map("start_date")
  endDate         DateTime        @map("end_date")

  // Velocity tracking
  velocityTarget  Int?            @map("velocity_target")
  actualVelocity  Int?            @map("actual_velocity")  // Calculated from completed issues

  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  // Relations
  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  issues          Issue[]

  // Indexes
  @@index([projectId])
  @@index([status])
  @@map("sprints")
}

model Issue {
  id              String          @id @default(cuid())
  projectId       String          @map("project_id")

  // Issue metadata
  type            String          // epic, story, task, bug, subtask
  status          String          @default("backlog")
  priority        String          @default("medium")  // low, medium, high, critical

  // Content
  title           String
  description     String?

  // Relations to users
  assigneeId      String?         @map("assignee_id")
  reporterId      String          @map("reporter_id")

  // Hierarchy
  parentId        String?         @map("parent_id")      // Parent issue (for subtasks)
  epicId          String?         @map("epic_id")        // Epic (for stories/tasks/bugs)

  // Sprint assignment
  sprintId        String?         @map("sprint_id")

  // Estimation
  storyPoints     Int?            @map("story_points")

  // Optimistic locking
  version         Int             @default(1)

  // Timestamps
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  deletedAt       DateTime?       @map("deleted_at")

  // Relations
  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee        User?           @relation("assignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  reporter        User            @relation("reporter", fields: [reporterId], references: [id], onDelete: Restrict)

  // Hierarchy relations
  parent          Issue?          @relation("parent", fields: [parentId], references: [id], onDelete: Cascade)
  children        Issue[]         @relation("parent")
  epic            Issue?          @relation("epic", fields: [epicId], references: [id], onDelete: SetNull)
  epicChildren    Issue[]         @relation("epic")

  sprint          Sprint?         @relation(fields: [sprintId], references: [id], onDelete: SetNull)

  // Other relations
  comments        Comment[]
  watchers        Watcher[]
  customFields    CustomFieldValue[]
  activityLogs    ActivityLog[]

  // Indexes (optimize common queries)
  @@index([projectId])
  @@index([status])
  @@index([assigneeId])
  @@index([sprintId])
  @@index([parentId])
  @@index([epicId])
  @@index([createdAt])

  // Composite indexes for common filters
  @@index([projectId, status])
  @@index([projectId, sprintId])
  @@index([projectId, assigneeId])

  // Full-text search on title and description
  @@fulltext([title, description])
  @@map("issues")
}

// ============================================================================
// COMMENTS & COLLABORATION
// ============================================================================

model Comment {
  id              String          @id @default(cuid())
  issueId         String          @map("issue_id")
  authorId        String          @map("author_id")

  // Content
  content         String

  // Mentions stored as JSON array of user IDs
  mentions        Json            @default("[]")

  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  deletedAt       DateTime?       @map("deleted_at")

  // Relations
  issue           Issue           @relation(fields: [issueId], references: [id], onDelete: Cascade)
  author          User            @relation(fields: [authorId], references: [id], onDelete: Restrict)

  // Indexes
  @@index([issueId])
  @@index([authorId])
  @@fulltext([content])
  @@map("comments")
}

model Watcher {
  userId          String          @map("user_id")
  issueId         String          @map("issue_id")
  createdAt       DateTime        @default(now()) @map("created_at")

  // Relations
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  issue           Issue           @relation(fields: [issueId], references: [id], onDelete: Cascade)

  // Composite primary key
  @@id([userId, issueId])
  @@index([userId])
  @@map("watchers")
}

// ============================================================================
// CUSTOM FIELDS
// ============================================================================

model CustomField {
  id              String          @id @default(cuid())
  projectId       String          @map("project_id")

  // Field definition
  fieldName       String          @map("field_name")
  fieldType       String          @map("field_type")  // text, number, date, dropdown, multiselect

  // Configuration stored as JSON
  // { required: boolean, options: string[], validation: {...}, defaultValue?: any }
  fieldConfig     Json            @default("{}")     @map("field_config")

  createdAt       DateTime        @default(now()) @map("created_at")

  // Relations
  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  values          CustomFieldValue[]

  // Constraints
  @@unique([projectId, fieldName])
  @@index([projectId])
  @@map("custom_fields")
}

model CustomFieldValue {
  id              String          @id @default(cuid())
  issueId         String          @map("issue_id")
  fieldId         String          @map("field_id")

  // Value stored as JSON (accommodates any field type)
  value           Json

  // Relations
  issue           Issue           @relation(fields: [issueId], references: [id], onDelete: Cascade)
  field           CustomField     @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  // Constraints
  @@unique([issueId, fieldId])
  @@index([issueId])
  @@map("custom_field_values")
}

// ============================================================================
// WORKFLOW & TRANSITIONS
// ============================================================================

model IssueTransition {
  id              String          @id @default(cuid())
  projectId       String          @map("project_id")

  // Transition definition
  fromStatus      String          @map("from_status")
  toStatus        String          @map("to_status")

  // Conditions stored as JSON
  // { requiresAssignee: false, requiresStoryPoints: true, ... }
  conditions      Json            @default("{}")

  // Actions stored as JSON
  // { autoAssign: { target: "reviewer" }, notify: ["watchers"], ... }
  actions         Json            @default("{}")

  // Relations
  project         Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Constraint: Can't have duplicate transitions in same project
  @@unique([projectId, fromStatus, toStatus])
  @@index([projectId])
  @@map("issue_transitions")
}

// ============================================================================
// AUDIT & ACTIVITY TRACKING
// ============================================================================

model ActivityLog {
  id              String          @id @default(cuid())
  issueId         String          @map("issue_id")
  projectId       String          @map("project_id")

  // What happened
  actionType      String          @map("action_type")  // created, updated, deleted, transitioned

  // Changed fields stored as JSON
  // { fieldName: { from: oldValue, to: newValue }, ... }
  changedFields   Json            @default("{}")     @map("changed_fields")

  // Who did it
  actorId         String          @map("actor_id")

  createdAt       DateTime        @default(now()) @map("created_at")

  // Relations
  issue           Issue           @relation(fields: [issueId], references: [id], onDelete: Cascade)
  actor           User            @relation(fields: [actorId], references: [id], onDelete: Restrict)

  // Indexes for efficient querying
  @@index([issueId])
  @@index([projectId])
  @@index([createdAt])
  @@map("activity_logs")
}
```

---

## Schema Design Decisions

### 1. Optimistic Locking (`version` column)

**Why**: Handle concurrent updates safely without pessimistic locks.

**How**:

- Every issue has a `version` column (default: 1)
- When updating an issue, include expected version
- Query updates only if `version == expected_version`
- Increment `version` on successful update
- If no rows updated, conflict detected; client retries with new version

**Example**:

```typescript
// Update issue only if version hasn't changed
const result = await prisma.issue.updateMany({
  where: {
    id: issueId,
    version: 5, // Expected version
  },
  data: {
    status: "done",
    version: { increment: 1 }, // Now version = 6
  },
});

if (result.count === 0) {
  // Conflict: another user updated the issue
  // Retry with fresh data
}
```

### 2. JSONB for Configuration

**Why**: Store project-specific, semi-structured configuration flexibly.

**Uses**:

- `Project.settings`: Workflow rules, field definitions, integrations
- `CustomField.fieldConfig`: Field validation, options, defaults
- `IssueTransition.conditions/actions`: Workflow conditions and side-effects
- `Comment.mentions`: Array of mentioned user IDs

**Benefits**:

- No need to create separate tables for every config option
- Still queryable with PostgreSQL JSON operators
- Easy to extend without schema migrations

**Example**:

```sql
-- Query: Find projects with custom field "color"
SELECT * FROM projects
WHERE settings -> 'customFields' @> '[{"name": "color"}]'::jsonb;
```

### 3. Soft Deletes (`deletedAt`)

**Why**: Maintain audit trail; allow recovery; support compliance.

**Pattern**:

- Set `deletedAt` on delete (not actually deleted)
- Queries filter `WHERE deletedAt IS NULL`
- Can recover deleted data within retention period

**Example**:

```typescript
// List active issues
const issues = await prisma.issue.findMany({
  where: { projectId, deletedAt: null },
});

// Restore deleted issue (within retention window)
await prisma.issue.update({
  where: { id: issueId },
  data: { deletedAt: null },
});
```

### 4. Hierarchical Issue Relationships

**Pattern**: Self-referential foreign keys for parent-child relationships.

**Structure**:

```
Epic (type: epic, parentId: null)
├── Story (type: story, parentId: epic.id, epicId: null)
│   └── Subtask (type: subtask, parentId: story.id, epicId: null)
├── Task (type: task, parentId: null, epicId: epic.id)
└── Bug (type: bug, parentId: null, epicId: epic.id)
```

**Note**:

- `parentId` is for direct parent (used for subtasks)
- `epicId` is for epic link (used for stories, tasks, bugs)
- This avoids deep nesting and allows multiple relationship types

### 5. Composite Indexes for Common Queries

**Hot queries** (most frequently used):

- List issues in project by status: `(projectId, status)`
- List issues in sprint: `(projectId, sprintId)`
- List issues by assignee in project: `(projectId, assigneeId)`

**Strategy**: Create composite indexes for these access patterns.

```sql
CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_issues_project_sprint ON issues(project_id, sprint_id);
CREATE INDEX idx_issues_project_assignee ON issues(project_id, assignee_id);
```

### 6. Full-Text Search Indexes

**Setup**: Prisma schema includes `@@fulltext([title, description])`.

**Queries**:

```typescript
// Search issues by full-text
const results = await prisma.issue.findMany({
  where: {
    projectId,
    OR: [
      { title: { search: "memory leak" } },
      { description: { search: "memory leak" } },
    ],
  },
});
```

---

## Common Query Patterns

### Recursive Hierarchy Query

```typescript
// Fetch issue with all its descendants (children, grandchildren, etc.)
async function getIssueHierarchy(issueId: string) {
  return prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      children: {
        include: {
          children: {
            include: { children: true }, // 3 levels deep (adjustable)
          },
        },
      },
      parent: true,
      epic: true,
      epicChildren: {
        include: {
          children: { include: { children: true } },
        },
      },
    },
  });
}
```

### Paginated List with Filters

```typescript
async function listIssuesWithFilters(
  projectId: string,
  filters: { status?: string; assigneeId?: string; sprintId?: string | null },
  pagination: { cursor?: string; take: number },
) {
  const issues = await prisma.issue.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(filters.status && { status: filters.status }),
      ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters.sprintId !== undefined && { sprintId: filters.sprintId }),
    },
    cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
    skip: pagination.cursor ? 1 : 0,
    take: pagination.take,
    orderBy: { createdAt: "desc" },
  });

  return issues;
}
```

### Atomic Transaction (Move Issues to Sprint)

```typescript
async function moveIssuesToSprint(
  issueIds: string[],
  sprintId: string,
  projectId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Verify sprint exists
    const sprint = await tx.sprint.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) throw new Error("Sprint not found");

    // Update issues
    const updated = await tx.issue.updateMany({
      where: { id: { in: issueIds }, projectId },
      data: { sprintId, version: { increment: 1 } },
    });

    // Log activity for each issue
    await tx.activityLog.createMany({
      data: issueIds.map((id) => ({
        issueId: id,
        projectId,
        actionType: "moved",
        changedFields: { sprintId: { from: null, to: sprintId } },
        actorId: userId,
      })),
    });

    return updated;
  });
}
```

### Full-Text Search with Ranking

```typescript
async function searchIssues(projectId: string, query: string) {
  const results = await prisma.issue.findMany({
    where: {
      projectId,
      OR: [
        { title: { search: query } },
        { description: { search: query } },
        { comments: { some: { content: { search: query } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      _relevance: true, // Ranking scores
    },
    orderBy: {
      _relevance: { sort: "desc", search: query },
    },
  });

  return results;
}
```

---

## Migration Strategy

### Creating a New Migration

```bash
# After modifying schema.prisma:
npm run db:migrate -- --name descriptive_name

# Example:
npm run db:migrate -- --name add_custom_fields

# Creates: prisma/migrations/20240418120000_add_custom_fields/migration.sql
```

### Migration Best Practices

1. **Test migrations locally first**

   ```bash
   npm run db:migrate -- --name test_feature
   # Verify it works locally
   ```

2. **Include both schema and data migrations**

   ```sql
   -- Add column with default for existing rows
   ALTER TABLE issues ADD COLUMN priority VARCHAR DEFAULT 'medium';
   -- Remove default for new rows (set explicitly)
   ALTER TABLE issues ALTER COLUMN priority DROP DEFAULT;
   ```

3. **Reversible migrations**

   ```bash
   # If migration fails in production:
   npm run db:migrate:resolve -- --rolled-back 20240418120000_add_custom_fields
   ```

4. **Backup before major migrations**
   ```bash
   pg_dump DATABASE_URL > backup.sql
   npm run db:migrate
   ```

---

## Maintenance & Optimization

### Index Maintenance

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Unused indexes (drop if safe)
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Reindex if fragmented
REINDEX INDEX idx_issues_project_status;
```

### Vacuum & Analyze

```bash
# Run periodically to maintain query performance
VACUUM ANALYZE;

# Or configure autovacuum in postgresql.conf
autovacuum = on
```

### Connection Pooling Configuration

In `.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public&connection_limit=20&pool_timeout=10"
```

---

## Prisma Studio

```bash
# Visual database browser/editor
npm run db:studio

# Opens: http://localhost:5555
```

---

**Next**: [06-API-DESIGN.md](./06-API-DESIGN.md) for RESTful endpoint specifications.
