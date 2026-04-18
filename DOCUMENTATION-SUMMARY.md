# Complete Documentation & Development Guide (Functional Programming Edition)

## What Has Been Created

This repository now has comprehensive documentation and development guidelines for building the Project Management Platform backend using **functional programming patterns** instead of class-based approaches.

## 🤖 GitHub Copilot Integration

All instruction files (`.instructions-*.md`) are designed to work seamlessly with GitHub Copilot Chat:

### Using with Copilot

1. **Open Copilot Chat** in VS Code (`Ctrl+Shift+I`)
2. **Ask Copilot** to help implement a feature (e.g., "Create an issue service")
3. **Copilot automatically references** the relevant `.instructions-*.md` files
4. **Follow the pattern templates** in the skill files
5. **Let Copilot generate code** that adheres to the guidelines

### Copilot-Aware Skills

- `.instructions-service-development.md` - Service factory patterns
- `.instructions-api-development.md` - HTTP handler factories
- `.instructions-repository-development.md` - Data access functions
- `.instructions-websocket-realtime.md` - Real-time event patterns
- `.instructions-workflow-engine.md` - State machine implementations
- `.instructions-testing-patterns.md` - Functional test examples

Each skill file includes:

- 📋 Complete code examples Copilot can build upon
- 🎯 Clear pattern templates
- ✅ Checklists for validation
- ❌ Anti-patterns to avoid
- 📝 JSDoc comment templates

---

All code in this project follows **functional programming principles**, not object-oriented class-based patterns:

### Services = Factory Functions

- Services are created via factory functions: `createIssueService(deps)`
- Returns an object with pure functions: `{ createIssue, updateIssue, deleteIssue }`
- All dependencies passed explicitly as parameters
- No `this` binding, no class instantiation overhead

### Handlers = Higher-Order Functions

- Handlers created via factories: `createCreateIssueHandler(issueService)`
- Returns Express middleware functions
- Explicit dependency injection
- Easy to mock and test

### Repositories = Function Collections

- Factory functions returning objects with query functions
- No class methods, just pure DB query functions
- Composable and testable

### Benefits

✅ Pure functions are easier to test
✅ No hidden state from class instances
✅ Explicit dependency passing (less magic)
✅ Better functional composition
✅ Easier to understand data flow
✅ Naturally works with async/await
✅ Aligned with Express middleware patterns

---

## 📚 Documentation Structure

### Core Project Documentation (`/docs/`)

1. **[01-PROJECT-OVERVIEW.md](/docs/01-PROJECT-OVERVIEW.md)** _(Start here)_
   - Project goals and problem statement
   - Key features overview
   - Tech stack decisions
   - Success metrics
   - Quick navigation guide

2. **[02-ARCHITECTURE.md](/docs/02-ARCHITECTURE.md)**
   - High-level system design (3-tier architecture)
   - Component responsibilities
   - Data flow scenarios
   - Scalability approach
   - Failure handling & resilience
   - Security considerations

3. **[03-TECH-STACK.md](/docs/03-TECH-STACK.md)** _(Deep dive)_
   - Express.js configuration & middleware patterns
   - TypeScript setup and strict mode guidelines
   - Prisma ORM patterns and best practices
   - Zod validation strategy and custom validators
   - Dependency injection pattern
   - Performance optimizations

4. **[04-TURBOREPO-STRUCTURE.md](/docs/04-TURBOREPO-STRUCTURE.md)** _(Workspace organization)_
   - Monorepo architecture explained
   - Package responsibilities:
     - `packages/shared` - Types & utilities
     - `packages/api` - REST API server
     - `packages/websocket` - Real-time server
     - `packages/database` - Prisma schema
   - TypeScript path aliases
   - Build and development workflows
   - Inter-package communication

5. **[05-PRISMA-DATABASE.md](/docs/05-PRISMA-DATABASE.md)** _(Database design)_
   - Complete schema definition with all models
   - Design decisions explained:
     - Optimistic locking (`version` column)
     - JSONB for configuration
     - Soft deletes
     - Hierarchical relationships
     - Composite indexes
   - Common query patterns
   - Migration strategy
   - Maintenance & optimization

6. **[06-API-DESIGN.md](/docs/06-API-DESIGN.md)** _(API specifications)_
   - REST conventions and HTTP status codes
   - Authentication (JWT tokens)
   - Pagination (offset & cursor-based)
   - Standard response format (success & error)
   - Complete endpoint reference:
     - Authentication (`/api/auth`)
     - Projects (`/api/projects`)
     - Issues (`/api/projects/:projectId/issues`)
     - Sprints (`/api/projects/:projectId/sprints`)
     - Comments (`/api/issues/:issueId/comments`)
     - Search (`/api/search`)
     - Activity feeds (`/api/projects/:projectId/activity`)
   - Error codes and responses
   - Rate limiting

7. **[07-IMPLEMENTATION-GUIDELINES.md](/docs/07-IMPLEMENTATION-GUIDELINES.md)** _(Coding standards)_
   - TypeScript strict mode requirements
   - Error handling patterns
   - Logging standards
   - Function documentation (JSDoc)
   - Naming conventions
   - Dependency injection
   - Service layer pattern
   - Repository pattern
   - Testing strategy with examples
   - Performance considerations
   - Security best practices
   - Code review checklist
   - Git workflow

---

## 🎯 Development Instructions

### Main Instructions File (`.instructions.md`)

Contains **non-negotiable development principles**:

- Type safety requirements
- Layered architecture rules
- Error handling standards
- Authorization guardrails
- Dependency injection pattern
- Audit & compliance requirements
- File organization rules
- Code patterns (service, controller, repository)
- Validation rules
- Testing requirements
- Database query patterns
- Logging standards
- API response format
- Security checklist
- Performance guardrails

**Use this** when starting ANY new feature or fixing bugs.

---

### Specialized Instruction Files

#### `.instructions-service-development.md`

**Focus**: Building service layer (business logic)

- Service class pattern template
- Method implementation pattern (7-step flow):
  1. Authorization
  2. Fetching
  3. Validation
  4. Mutation
  5. Side effects
  6. Event emission
  7. Audit logging
- Error handling patterns
- Testing patterns for services
- Common service classes
- Performance patterns
- Testing checklist

**Use this** when creating new service classes or methods.

---

#### `.instructions-api-development.md`

**Focus**: Building REST API endpoints

- Controller method template
- Standard response formats:
  - Success (200, 201, 204)
  - List with pagination
  - Error responses (400, 4xx, 5xx)
- Common endpoint patterns:
  - CRUD (Create, Read, Update, Delete)
  - Nested resources
  - Custom actions
- Validation middleware pattern
- Pagination strategies (offset & cursor-based)
- Filtering & sorting conventions
- Query parameter validation
- Error handling in controllers
- Endpoint checklist

**Use this** when creating new API endpoints or controllers.

---

#### `.instructions-repository-development.md`

**Focus**: Building data access layers (functional)

- Repository factory pattern
- Query patterns (efficient loading, pagination, transactions)
- Workspace authorization in queries
- Complex filtering with JSONB
- Aggregations and full-text search
- Batch operations
- Soft delete support
- Best practices and checklist

**Use this** when creating repository functions for database access.

---

#### `.instructions-websocket-realtime.md`

**Focus**: Building real-time features

- Event publisher factory pattern
- WebSocket server implementation
- Event types and channels
- Emitting events from services
- Client WebSocket patterns
- Disconnection and reconnection handling
- Presence tracking
- Event buffering and replay
- Error handling

**Use this** when building real-time features with WebSocket and Redis Pub/Sub.

---

#### `.instructions-workflow-engine.md`

**Focus**: Building state machines for workflows

- Workflow configuration and transitions
- Workflow engine factory pattern
- Condition evaluation for transitions
- Action execution after transitions
- Default workflow templates (Agile, Kanban)
- Integration with issue service
- Workflow checklist

**Use this** when implementing status transitions and workflow enforcement.

---

#### `.instructions-testing-patterns.md`

**Focus**: Testing functional code at all layers

- Unit testing services with mocked dependencies
- Unit testing repositories with test databases
- Integration testing handlers
- End-to-end testing complete flows
- Mocking strategies (services, databases, events)
- Testing checklist for each layer
- Best practices

**Use this** when writing tests for any layer (target: 80%+ coverage for services).

---

### 1. Understand the Requirements

- Read relevant documentation from `/docs/`
- Check `/docs/01-PROJECT-OVERVIEW.md` for context
- Review architecture from `/docs/02-ARCHITECTURE.md`

### 2. Use Instructions for Implementation

- **For services**: Follow `.instructions-service-development.md`
- **For API handlers**: Follow `.instructions-api-development.md`
- **For repositories**: Follow `.instructions-repository-development.md`
- **For real-time features**: Follow `.instructions-websocket-realtime.md`
- **For workflows/transitions**: Follow `.instructions-workflow-engine.md`
- **For testing**: Follow `.instructions-testing-patterns.md`
- **For everything else**: Follow `.instructions.md`

### 3. Follow the Patterns

- Copy pattern templates from instructions
- Fill in specific business logic
- Keep structure and conventions consistent

### 4. Test Your Code

- Write tests while implementing
- Aim for 80%+ coverage on services
- Test error cases and edge cases

### 5. Review Against Checklist

- Use the checklist at end of each instruction file
- Ensure TypeScript types are correct
- Verify security and authorization
- Check logging and error handling

### 6. Commit with Conventional Messages

```
feat(issues): add custom fields support
fix(auth): handle token refresh properly
refactor(repo): consolidate query methods
```

---

## 🎓 Learning Path

**For someone new to the project**:

1. Read [01-PROJECT-OVERVIEW.md](/docs/01-PROJECT-OVERVIEW.md) (15 min)
2. Skim [02-ARCHITECTURE.md](/docs/02-ARCHITECTURE.md) (15 min)
3. Read [04-TURBOREPO-STRUCTURE.md](/docs/04-TURBOREPO-STRUCTURE.md) (20 min)
4. Read `.instructions.md` (thorough) (20 min)
5. Pick a feature, read relevant `/docs/` section
6. Follow appropriate `.instructions-*.md` file
7. Reference implementation guidelines as needed

**Estimated total**: 2-3 hours for complete understanding

---

## 📋 This Covers

✅ **Architecture & Design**

- System components and interactions
- Data flow scenarios
- Scalability approach
- Security model

✅ **Tech Stack Deep Dive**

- Express.js setup and patterns
- TypeScript strict mode
- Prisma ORM usage
- Zod validation
- Dependency injection

✅ **Project Organization**

- Monorepo structure (Turborepo)
- Package responsibilities
- Build and dev workflows

✅ **Database Design**

- Complete schema
- Design patterns
- Query examples
- Migration strategy

✅ **API Specifications**

- RESTful conventions
- Authentication
- All endpoints documented
- Error handling

✅ **Coding Standards**

- Type safety requirements
- Layered architecture rules
- Error handling patterns
- Testing strategy
- Security best practices

✅ **Development Instructions**

- Specific patterns for services
- Specific patterns for API endpoints
- Checklists for each layer
- Security guardrails

---

## 🚀 Quick Start

```bash
# 1. Set up development environment
npm install
npm run db:generate

# 2. Configure environment
cp .env.example .env.local
# Edit DATABASE_URL, JWT_SECRET, etc.

# 3. Run migrations
npm run db:migrate

# 4. Start all services
npm run dev

# 5. Read documentation
# Start with /docs/01-PROJECT-OVERVIEW.md
# Then follow the learning path above

# 6. Create your first feature
# 1. Read .instructions.md
# 2. Pick appropriate `.instructions-*.md`
# 3. Follow the pattern
# 4. Write tests
# 5. Commit with conventional message
```

---

## 📖 Documentation at a Glance

| Document                             | Focus           | Duration | When to Read         |
| ------------------------------------ | --------------- | -------- | -------------------- |
| 01-PROJECT-OVERVIEW.md               | Context & goals | 15 min   | First                |
| 02-ARCHITECTURE.md                   | System design   | 20 min   | Understanding system |
| 03-TECH-STACK.md                     | Tech details    | 30 min   | Tech reference       |
| 04-TURBOREPO-STRUCTURE.md            | Monorepo setup  | 20 min   | Project organization |
| 05-PRISMA-DATABASE.md                | Database schema | 20 min   | DB questions         |
| 06-API-DESIGN.md                     | API specs       | 20 min   | API reference        |
| 07-IMPLEMENTATION-GUIDELINES.md      | Standards       | 20 min   | Code guidelines      |
| .instructions.md                     | Core principles | 20 min   | Before any code      |
| .instructions-service-development.md | Services        | 15 min   | Building services    |
| .instructions-api-development.md     | Endpoints       | 15 min   | Building APIs        |

---

## ❓ FAQ

**Q: Where do I start?**
A: Read `01-PROJECT-OVERVIEW.md` then `.instructions.md`.

**Q: How do I implement a new service?**
A: Follow `.instructions-service-development.md` pattern.

**Q: How do I create a new API endpoint?**
A: Follow `.instructions-api-development.md` pattern.

**Q: What's the architecture?**
A: Read `02-ARCHITECTURE.md`.

**Q: How do I set up the database?**
A: See `04-TURBOREPO-STRUCTURE.md` and `05-PRISMA-DATABASE.md`.

**Q: What are the API endpoints?**
A: See `06-API-DESIGN.md`.

**Q: What code standards do I need to follow?**
A: Read `.instructions.md` and `07-IMPLEMENTATION-GUIDELINES.md`.

**Q: How do I run tests?**
A: `npm run test` and `npm run test:watch`.

**Q: How does the monorepo work?**
A: Read `04-TURBOREPO-STRUCTURE.md`.

---

## 🎯 Key Guardrails

These are **non-negotiable**:

1. **Type Safety**: TypeScript strict mode always; no `any` types
2. **Authorization**: Every query includes workspace context
3. **Validation**: All external inputs validated with Zod
4. **Error Handling**: Throw typed AppError subclasses, never bare Error
5. **Architecture**: Controllers → Services → Repositories → Prisma
6. **Audit Trail**: Every mutation logged to ActivityLog
7. **Testing**: 80%+ coverage for services
8. **Security**: No sensitive data in logs; password hashing; CORS configured
9. **Patterns**: Follow templates from instruction files exactly
10. **Documentation**: Every function has JSDoc comments

---

## 🔗 Related Resources

- **Prisma Docs**: https://www.prisma.io/docs/
- **Express Docs**: https://expressjs.com/
- **TypeScript Docs**: https://www.typescriptlang.org/docs/
- **Zod Docs**: https://zod.dev/
- **Turborepo Docs**: https://turbo.build/repo/docs

---

## 📞 Support

When stuck:

1. **Check the docs**: Is there a guide in `/docs/`?
2. **Check the instructions**: Is there a pattern in `.instructions*.md`?
3. **Look at existing code**: Check similar implementations in codebase
4. **Run tests**: `npm run test` to see what's failing
5. **Check types**: `npm run type-check` for TypeScript errors

---

**Created**: April 18, 2026
**Version**: 1.0.0
**Status**: Complete & Production-Ready

---

## What's NOT In This Scope

These are for future phases:

- ❌ Frontend implementation
- ❌ Mobile client
- ❌ Reporting/dashboards (burndown charts)
- ❌ Jira/GitHub integrations
- ❌ SSO/LDAP (JWT is foundation)
- ❌ Advanced analytics
- ❌ Load testing infrastructure
- ❌ Production deployment automation
