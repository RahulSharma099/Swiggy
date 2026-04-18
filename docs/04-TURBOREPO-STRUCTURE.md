# Turborepo Monorepo Structure

## Overview

This project uses **Turborepo**, a high-performance build system for JavaScript and TypeScript monorepos. Turborepo provides:

- **Unified build cache**: Reusable build artifacts across packages; faster builds
- **Parallel task execution**: Run scripts in dependency order automatically
- **Workspace organization**: Clear package boundaries with shared tooling
- **Reduced complexity**: Single `package.json` scripts entry point; one TypeScript config base
- **Developer experience**: Single `npm install`; shared dependencies

---

## Monorepo Architecture

```
pms-platform/                           # Root workspace
├── package.json                        # Root workspace config
├── tsconfig.json                       # Base TypeScript config (extended by packages)
├── turbo.json                          # Turborepo configuration
├── .gitignore
├── README.md
│
├── packages/
│   ├── shared/                         # [PACKAGE] Shared types, utilities, schemas
│   │   ├── src/
│   │   │   ├── types/                  # TypeScript type definitions
│   │   │   ├── schemas/                # Zod validation schemas (shared)
│   │   │   ├── utils/                  # Shared utilities (logger, errors, etc.)
│   │   │   └── constants/              # Constants (HTTP statuses, error codes)
│   │   ├── package.json
│   │   ├── tsconfig.json               # Extends root tsconfig
│   │   └── dist/                       # Built output
│   │
│   ├── api/                            # [PACKAGE] REST API server
│   │   ├── src/
│   │   │   ├── config/                 # Express setup, database connection
│   │   │   ├── controllers/            # HTTP request handlers
│   │   │   ├── routes/                 # Express route definitions
│   │   │   ├── services/               # Business logic layer
│   │   │   ├── repositories/           # Database access layer (Prisma queries)
│   │   │   ├── middleware/             # Express middleware
│   │   │   ├── schemas/                # Zod schemas (API-specific)
│   │   │   ├── utils/                  # API-specific utilities
│   │   │   └── index.ts                # Entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── dist/
│   │
│   ├── websocket/                      # [PACKAGE] WebSocket server for real-time
│   │   ├── src/
│   │   │   ├── server.ts               # WebSocket server initialization
│   │   │   ├── handlers/               # WebSocket event handlers
│   │   │   ├── services/               # Broadcasting, presence tracking
│   │   │   ├── utils/                  # WS-specific utilities
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── dist/
│   │
│   └── database/                       # [PACKAGE] Prisma schema & migrations
│       ├── prisma/
│       │   ├── schema.prisma           # Database schema definition
│       │   └── migrations/             # Auto-generated migrations
│       ├── seed.ts                     # Database seeding script (optional)
│       ├── package.json
│       └── tsconfig.json
│
├── .github/
│   └── workflows/                      # CI/CD pipelines
│       ├── test.yml                    # Run tests on PR
│       ├── build.yml                   # Build on merge
│       └── deploy.yml                  # Deploy to production
│
├── scripts/                            # Utility scripts
│   ├── setup.sh                        # Initial setup
│   ├── migrate.sh                      # Run database migrations
│   └── seed.sh                         # Seed database
│
└── docs/                               # Project documentation
    ├── 01-PROJECT-OVERVIEW.md
    ├── 02-ARCHITECTURE.md
    ├── 03-TECH-STACK.md
    ├── 04-TURBOREPO-STRUCTURE.md
    ├── 05-PRISMA-DATABASE.md
    ├── 06-API-DESIGN.md
    └── 07-IMPLEMENTATION-GUIDELINES.md
```

---

## Package Responsibilities

### 1. `packages/shared` — Shared Utilities & Types

**Purpose**: Central repository for code shared across all other packages.

**Contents**:

```
shared/src/
├── types/
│   ├── index.ts              # User, Issue, Comment, Sprint types
│   ├── api.ts                # API request/response types
│   └── domain.ts             # Domain entities
├── schemas/
│   ├── issues.ts             # Zod schemas for issue validation
│   ├── sprints.ts            # Sprint schemas
│   ├── comments.ts           # Comment schemas
│   └── index.ts              # Re-export all schemas
├── utils/
│   ├── logger.ts             # Winston logger setup
│   ├── errors.ts             # Error classes (AppError, NotFoundError, etc.)
│   ├── jwt.ts                # JWT token generation/validation
│   ├── pagination.ts         # Cursor pagination helpers
│   └── index.ts              # Re-export all utilities
└── constants/
    ├── http-statuses.ts      # HTTP status codes
    ├── error-codes.ts        # Application error codes
    └── magic-numbers.ts      # Config constants (batch size, timeout, etc.)
```

**Dependencies**:

- `zod` (validation schemas)
- `winston` (logging)
- `jsonwebtoken` (JWT)
- `pino` (fast logging, optional)

**exports**:

- Published to npm registry or used locally via path alias

**Usage in other packages**:

```typescript
// In packages/api/src/services/IssueService.ts
import { Issue, CreateIssueInput } from "@shared/types";
import { CreateIssueSchema } from "@shared/schemas";
import { logger } from "@shared/utils";
```

### 2. `packages/api` — REST API Server

**Purpose**: Express.js HTTP server; handles all RESTful endpoints.

**Contents**:

```
api/src/
├── config/
│   ├── express.ts            # Express app setup with middleware
│   ├── database.ts           # Prisma client initialization
│   └── env.ts                # Environment variable validation
├── controllers/              # Request handlers
│   ├── IssueController.ts
│   ├── SprintController.ts
│   ├── ProjectController.ts
│   ├── CommentController.ts
│   └── SearchController.ts
├── routes/                   # Express route definitions
│   ├── issues.ts
│   ├── sprints.ts
│   ├── projects.ts
│   ├── comments.ts
│   ├── search.ts
│   └── index.ts              # Combine all routes
├── services/                 # Business logic
│   ├── IssueService.ts
│   ├── SprintService.ts
│   ├── WorkflowEngine.ts
│   ├── SearchService.ts
│   ├── CommentService.ts
│   ├── AuthService.ts
│   └── NotificationService.ts
├── repositories/             # Database access (Prisma queries)
│   ├── IssueRepository.ts
│   ├── SprintRepository.ts
│   ├── ProjectRepository.ts
│   ├── UserRepository.ts
│   ├── ActvityRepository.ts
│   └── BaseRepository.ts     # Abstract base with common methods
├── middleware/
│   ├── auth.ts               # JWT authentication
│   ├── errorHandler.ts       # Global error handling
│   ├── validate.ts           # Zod schema validation
│   ├── logging.ts            # Request/response logging
│   └── cors.ts               # CORS configuration
├── schemas/                  # API-specific validation schemas
│   ├── issues.ts
│   ├── sprints.ts
│   └── index.ts
├── utils/
│   ├── response.ts           # Standard response formatting
│   ├── di-container.ts       # Dependency injection
│   └── typeGuards.ts         # Runtime type checking
└── index.ts                  # Entry point: starts Express server
```

**Key Files**:

```typescript
// api/src/index.ts
import { setupExpress } from "./config/express";

const app = setupExpress();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`API running on port ${PORT}`));
```

**Dependencies**:

- `express` (HTTP framework)
- `@prisma/client` (ORM client)
- `zod` (validation)
- `@shared/*` (shared types and utils)
- `jsonwebtoken` (auth)
- `winston` (logging)
- `helmet` (security headers)
- `cors` (CORS)

### 3. `packages/websocket` — Real-Time WebSocket Server

**Purpose**: WebSocket server for broadcasting real-time updates to connected clients.

**Contents**:

```
websocket/src/
├── server.ts                 # WebSocket server initialization
├── handlers/
│   ├── connectionHandler.ts  # Handle new connections
│   ├── messageHandler.ts     # Handle incoming messages
│   └── disconnectionHandler.ts
├── services/
│   ├── BroadcastService.ts   # Emit events to clients
│   ├── PresenceManager.ts    # Track who's viewing what
│   ├── EventBufferService.ts # Buffer events for replay
│   ├── RedisService.ts       # Redis Pub/Sub integration
│   └── ConnectionManager.ts  # Manage client connections
├── middleware/
│   └── auth.ts               # WebSocket auth via token
└── index.ts                  # Entry point: starts WS server
```

**Key Files**:

```typescript
// websocket/src/server.ts
import express from "express";
import { WebSocket } from "ws";
import { setupAuthMiddleware } from "./middleware/auth";
import { BroadcastService } from "./services/BroadcastService";
import { redis } from "@shared/utils/redis";

const app = express();
const wss = new WebSocket.Server({ port: 3001 });

// Subscribe to Redis for broadcasts
const broadcast = new BroadcastService(wss, redis);
redis.subscribe("events:*", (msg) => {
  broadcast.emit(JSON.parse(msg));
});

wss.on("connection", (ws) => {
  // Handle connection...
});
```

**Dependencies**:

- `ws` (WebSocket library)
- `redis` (Redis client for pub/sub)
- `@shared/*` (shared types)
- `jsonwebtoken` (auth validation)
- `uuid` (connection IDs)

### 4. `packages/database` — Prisma Schema & Migrations

**Purpose**: Central database schema definition; version-controlled migrations.

**Contents**:

```
database/
├── prisma/
│   ├── schema.prisma         # Complete database schema
│   └── migrations/           # Generated migration files
│       ├── migration_lock.toml
│       ├── 20240101120000_init
│       └── 20240102120000_add_custom_fields
├── seed.ts                   # Optional: seed database with test data
├── package.json
└── tsconfig.json
```

**Key File**:

```prisma
// database/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// All models defined here
model User { ... }
model Project { ... }
model Issue { ... }
// ... etc
```

**Usage**:

```bash
# In root directory:
npm run db:migrate      # Run pending migrations
npm run db:generate     # Regenerate Prisma client
npm run db:seed         # Seed test data (optional)
npm run db:studio       # Open Prisma Studio UI
```

**Dependencies**:

- `@prisma/cli` (migration tools)
- `prisma` (schema validation)

---

## Root `package.json` Scripts

```json
{
  "name": "pms-platform",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:watch": "turbo run test:watch",
    "lint": "turbo run lint",
    "format": "turbo run format",
    "type-check": "turbo run type-check",
    "db:migrate": "turbo run db:migrate",
    "db:generate": "cd packages/database && npx prisma generate",
    "db:studio": "cd packages/database && npx prisma studio",
    "db:seed": "cd packages/database && npx ts-node seed.ts",
    "clean": "turbo run clean && rm -rf node_modules",
    "install-deps": "npm install && npm run db:generate"
  },
  "workspaces": ["packages/*"],
  "devDependencies": {
    "turbo": "^1.X.X",
    "typescript": "^5.X.X",
    "@types/node": "^20.X.X",
    "tsx": "^4.X.X"
  }
}
```

---

## Package-Specific `package.json` Examples

### `packages/shared/package.json`

```json
{
  "name": "@pms/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "type-check": "tsc --noEmit",
    "lint": "eslint src",
    "format": "prettier --write src"
  },
  "dependencies": {
    "zod": "^3.X.X",
    "winston": "^3.X.X",
    "jsonwebtoken": "^9.X.X",
    "redis": "^4.X.X"
  }
}
```

### `packages/api/package.json`

```json
{
  "name": "@pms/api",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.X.X",
    "@prisma/client": "^5.X.X",
    "zod": "^3.X.X",
    "@pms/shared": "*"
  },
  "devDependencies": {
    "tsx": "^4.X.X",
    "@types/express": "^4.X.X",
    "jest": "^29.X.X",
    "typescript": "^5.X.X"
  }
}
```

### `packages/websocket/package.json`

```json
{
  "name": "@pms/websocket",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "lint": "eslint src"
  },
  "dependencies": {
    "ws": "^8.X.X",
    "redis": "^4.X.X",
    "express": "^4.X.X",
    "@pms/shared": "*"
  }
}
```

### `packages/database/package.json`

```json
{
  "name": "@pms/database",
  "version": "1.0.0",
  "scripts": {
    "db:migrate": "prisma migrate deploy",
    "db:dev": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "db:seed": "ts-node seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.X.X"
  },
  "devDependencies": {
    "prisma": "^5.X.X",
    "ts-node": "^10.X.X"
  }
}
```

---

## TypeScript Configuration Hierarchy

### Root `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["packages/shared/src/*/index.ts", "packages/shared/src/*"],
      "@api/*": ["packages/api/src/*"],
      "@ws/*": ["packages/websocket/src/*"]
    }
  }
}
```

### Package-Specific `tsconfig.json`

```json
// packages/api/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

## `turbo.json` Configuration

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "globalDependencies": ["**/.env.local"],
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "cache": true,
      "dependsOn": ["^build", "type-check"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "outputs": ["coverage/**"],
      "cache": true,
      "inputs": ["src/**", "tests/**", "package.json"],
      "env": ["NODE_ENV=test"]
    },
    "lint": {
      "cache": true,
      "outputs": []
    },
    "type-check": {
      "cache": true,
      "outputs": []
    },
    "db:migrate": {
      "cache": false,
      "env": ["DATABASE_URL"]
    }
  }
}
```

---

## Development Workflow

### Local Setup

```bash
# 1. Clone repository
git clone <repo>
cd pms-platform

# 2. Install dependencies (installs for all packages)
npm install

# 3. Generate Prisma client
npm run db:generate

# 4. Set up environment variables
cp .env.example .env.local
# Edit DATABASE_URL, JWT_SECRET, etc.

# 5. Run database migrations
npm run db:migrate

# 6. Seed database (optional)
npm run db:seed

# 7. Start all servers in development mode
npm run dev
# This starts:
# - API on http://localhost:3000
# - WebSocket on ws://localhost:3001
# - Both with hot reload
```

### Build Process

```bash
# Build all packages (respects dependency order)
npm run build

# Output structure:
# packages/shared/dist/
# packages/api/dist/
# packages/websocket/dist/
# packages/database/dist/  (mostly .prisma files)
```

### Testing

```bash
# Run all tests across all packages
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests for specific package
npm run test -F @pms/api

# Coverage across all packages
npm run test -- --coverage
```

### Dependency Relationships

```
Dependency Graph:
api → shared
websocket → shared
database → (standalone; generates Prisma client used by api/websocket)

Build Order:
1. shared (no dependencies)
2. database (no dependencies; generates client)
3. api (depends on shared + database)
4. websocket (depends on shared + database)
```

---

## Inter-Package Communication

### Shared Types Flow

```typescript
// packages/shared/src/types/index.ts
export interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  // ...
}

// packages/api/src/services/IssueService.ts
import { Issue } from "@shared/types";

async function getIssue(id: string): Promise<Issue> {
  // ...
}

// packages/websocket/src/handlers/messageHandler.ts
import { Issue } from "@shared/types";

function handleIssueUpdate(issue: Issue) {
  // Broadcast to clients
}
```

### Shared Utilities

```typescript
// packages/shared/src/utils/logger.ts
export const logger = createLogger();

// packages/api/src/services/IssueService.ts
import { logger } from "@shared/utils";
logger.info("Creating issue...");

// packages/websocket/src/services/BroadcastService.ts
import { logger } from "@shared/utils";
logger.info("Broadcasting event...");
```

### Shared Schemas

```typescript
// packages/shared/src/schemas/issues.ts
export const CreateIssueSchema = z.object(/* ... */);

// packages/api/src/middleware/validate.ts
import { CreateIssueSchema } from "@shared/schemas";

// packages/websocket/src/handlers/messageHandler.ts (validate incoming WS messages)
import { CreateIssueSchema } from "@shared/schemas";
```

---

## Monorepo Best Practices

### 1. Clear Package Boundaries

**DO**:

- Keep packages focused on single responsibility
- Expose only necessary exports via `index.ts`
- Use clear internal/external file organization

**DON'T**:

- Import from deep package paths (`@pms/api/src/services/IssueService`)
- Create circular dependencies between packages
- Share implementation details; only share interfaces

### 2. Version Management

**Single Version Policy**:

- All packages use `*` as dependency version for internal packages
- External packages pinned in root `package.json`
- Versions managed in root for consistency

### 3. Build Caching

Turborepo tracks:

- Source files (`src/**`)
- Configuration (`tsconfig.json`, `package.json`)
- Environment variables listed in `turbo.json`

**Optimize cache hits**:

- Don't commit `dist/` (always rebuilt)
- Keep `turbo.json` accurate about file inputs
- Use `.turboignore` for non-source files

### 4. Testing Strategy

**Package-level tests**:

- Unit tests live in each package
- API tests in `@pms/api/src/__tests__`
- WebSocket tests in `@pms/websocket/src/__tests__`

**Integration tests** (optional):

- Create separate `packages/integration-tests` package if needed
- Tests against running servers (API + WebSocket)

### 5. Documentation

**Where**:

- Root `README.md`: Overview, setup, architecture
- `/docs/`: Detailed guides (this directory)
- `packages/*/README.md`: Package-specific details
- Code comments: Complex logic, non-obvious decisions

---

## Scaling Considerations

### Adding New Packages

When adding a new feature that's self-contained (e.g., async job processor):

```bash
# Create new package
mkdir packages/jobs
cd packages/jobs

# Create package structure
touch package.json tsconfig.json
mkdir -p src/__tests__

# Update root turbo.json to include new tasks
# Update root package.json if new workspace
npm install
```

### Monorepo to Microservices Migration

If individual packages need to become separate services:

1. Extract package to standalone repository
2. Update import paths from `@pms/package` to external package
3. Publish package to npm registry
4. Update all consumers to use `npm` instead of monorepo path

**Example**:

```json
// Before: monorepo path
{ "dependencies": { "@pms/shared": "*" } }

// After: published package
{ "dependencies": { "@pms/shared": "^1.0.0" } }
```

---

## Troubleshooting

### No modules found error

```bash
# Regenerate deps
rm -rf node_modules package-lock.json
npm install
npm run db:generate
```

### Cache issues

```bash
# Clear Turborepo cache
npx turbo prune --scope=@pms/api --docker
```

### Type errors across packages

```bash
# Rebuild all packages from scratch
npm run clean
npm install
npm run type-check
```

---

**Next**: [05-PRISMA-DATABASE.md](./05-PRISMA-DATABASE.md) for complete database schema documentation.
