# Project Management System (PMS)

A modern, scalable project management application built with TypeScript, Express, Prisma, and PostgreSQL. This system provides comprehensive issue tracking, project management, and real-time collaboration features.

## 🎯 Features

- **Workspace Management** - Create and manage multiple workspaces
- **Project Management** - Organize projects within workspaces
- **Issue Tracking** - Create, update, and track issues with full lifecycle management
- **Sprint Planning** - Plan and execute sprints with burndown tracking
- **Workflow Management** - Define custom workflows and status transitions
- **Search & Analytics** - Full-text search with analytics and trending insights
- **Real-time Updates** - WebSocket-based real-time notifications
- **Comprehensive REST API** - Well-documented API endpoints
- **Activity Logging** - Audit trail for all resource mutations

## 🏗️ Project Structure

```
swiggy/
├── packages/
│   ├── api/              # Express REST API server
│   ├── websocket/        # WebSocket real-time server
│   ├── database/         # Prisma database & migrations
│   └── shared/           # Shared types and utilities
├── docs/                 # Technical documentation
├── postman_workflow.json # API testing collection
└── README.md            # This file
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 23+
- **Language**: TypeScript 5.0
- **Framework**: Express 4.18
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod 3.22
- **Logging**: Winston 3.10
- **Testing**: Jest 29+

### Development
- **Build Tool**: Turbo.build (Monorepo)
- **Watch Mode**: tsc-watch 6.0
- **Module System**: CommonJS (runtime), TypeScript (source)

## 🚀 Getting Started

### Prerequisites
- Node.js 23.x or higher
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/RahulSharma099/Swiggy.git
   cd Swiggy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your configuration:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/pms_dev
   PORT=3000
   WEBSOCKET_PORT=3001
   LOG_LEVEL=info
   ```

4. **Set up the database**
   ```bash
   cd packages/database
   npx prisma db push
   ```

5. **Run development servers**
   ```bash
   npm run dev
   ```
   
   This will start both API (port 3000) and WebSocket (port 3001) servers with hot-reload.

## 📚 API Endpoints

### Health Check
```bash
GET /health
```

### Workspaces
```bash
POST /workspaces              # Create workspace
GET /workspaces              # List all workspaces
GET /workspaces/:id          # Get workspace
PUT /workspaces/:id          # Update workspace
```

### Projects
```bash
POST /projects               # Create project
GET /projects/:id            # Get project
PUT /projects/:id            # Update project
GET /workspaces/:id/projects # List workspace projects
```

### Issues
```bash
POST /issues                 # Create issue
GET /issues/:id              # Get issue
PUT /issues/:id              # Update issue
DELETE /issues/:id           # Delete issue
GET /projects/:id/issues     # List project issues
```

### Workflows
```bash
GET /projects/:id/workflows  # Get workflow definition
POST /issues/:id/transition  # Transition issue state
```

### Search & Analytics
```bash
GET /search?q=term           # Search issues
GET /search-analytics        # Get trending searches
GET /workspaces/:id/analytics # Get workspace analytics
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Test Coverage
```bash
npm test -- --coverage
```

### Integration Testing
Tests are located in `packages/api/src/__tests__/` with:
- Unit tests for handlers and repositories
- Integration tests for workflows
- Test fixtures and factories

### API Testing (Postman)

1. **Import Collection**
   - Open Postman
   - Import `postman_workflow.json`

2. **Set Environment**
   - Configure `baseUrl` to `http://localhost:3000`

3. **Run Full Workflow**
   - Create workspace → Create project → Create issue → Update issue

## 📋 Development

### Build
```bash
npm run build
```

### Watch Mode (Development)
```bash
npm run dev
```

### Lint & Format
```bash
npm run lint
npm run format
```

## 🗄️ Database

### Schema
The database schema includes:
- **Workspaces** - Top-level organizational unit
- **Projects** - Projects within workspaces
- **Issues** - Issues/tasks within projects
- **Users** - System users
- **Comments** - Issue comments
- **Sprints** - Sprint planning
- **Activity Logs** - Audit trail

### Migrations
Prisma migrations are stored in `packages/database/prisma/migrations/`.

To create a new migration:
```bash
cd packages/database
npx prisma migrate dev --name <migration_name>
```

## 📖 Documentation

Comprehensive technical documentation is available in the `/docs` folder:

- [01-PROJECT-OVERVIEW.md](docs/01-PROJECT-OVERVIEW.md) - Introduction and goals
- [02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) - System architecture and design
- [03-TECH-STACK.md](docs/03-TECH-STACK.md) - Technology stack details
- [04-TURBOREPO-STRUCTURE.md](docs/04-TURBOREPO-STRUCTURE.md) - Monorepo setup
- [05-PRISMA-DATABASE.md](docs/05-PRISMA-DATABASE.md) - Database design
- [06-API-DESIGN.md](docs/06-API-DESIGN.md) - REST API specifications
- [07-IMPLEMENTATION-GUIDELINES.md](docs/07-IMPLEMENTATION-GUIDELINES.md) - Development guidelines

## 🔧 API Testing & Examples

Use the provided Postman collection (`postman_workflow.json`) to test all endpoints:

```bash
# Create workspace
curl -X POST http://localhost:3000/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"My Workspace"}'

# Create issue
curl -X POST http://localhost:3000/issues \
  -H "Content-Type: application/json" \
  -d '{
    "projectId":"proj-123",
    "title":"Create feature",
    "description":"Build new feature",
    "type":"feature",
    "priority":2
  }'
```

## 📊 Project Status

✅ **Implemented Features:**
- Workspace and project management
- Issue tracking with full CRUD
- Sprint management
- Workflow state transitions
- Search functionality with full-text search
- Analytics and trending data
- Real-time WebSocket updates
- Comprehensive test coverage (107+ tests)
- Activity logging and audit trails

## 🤝 Contributing

This is an assignment submission. For modifications:

1. Create a feature branch
2. Make changes with passing tests
3. Commit with descriptive messages
4. Push and create a pull request

## 📝 License

This project is submitted as an assignment for academic evaluation.

## 🙋 Support

For issues or questions, refer to the technical documentation in the `/docs` folder or review the test files for usage examples.

---

**Last Updated**: April 19, 2026  
**Version**: 1.0.0  
**Status**: Ready for Submission ✅
