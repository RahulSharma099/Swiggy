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

### Quick Start with Docker Compose (Recommended) 🐳

**Prerequisites**: Docker & Docker Compose

```bash
# 1. Clone repository
git clone https://github.com/RahulSharma099/Swiggy.git
cd Swiggy

# 2. Start all services (PostgreSQL, Redis, API, WebSocket)
docker-compose up -d

# 3. Verify
curl http://localhost:3000/health
```

**Access Points:**
- API: http://localhost:3000
- WebSocket: http://localhost:3001
- Adminer (Database UI): http://localhost:8080
- Redis Commander (Redis UI): http://localhost:8081

**Credentials:**
- Database: `pms_user` / `pms_password`
- Redis: `redis_password`

---

### Traditional Local Setup ⚙️

**Prerequisites:**
- Node.js 20+
- PostgreSQL 12+
- npm 9+

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
   cd ../..
   ```

5. **Run development servers**
   ```bash
   npm run dev
   ```
   
   This will start both API (port 3000) and WebSocket (port 3001) servers with hot-reload.

---

**See [SETUP.md](./SETUP.md) for detailed setup instructions for both methods.**

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

**Local Setup:**
```bash
npm test
```

**Docker Setup:**
```bash
# Run tests inside container
docker-compose exec api npm test

# Or from host
docker-compose run --rm api npm test
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

### Manual Testing with cURL

```bash
# Health check
curl http://localhost:3000/health

# Create workspace
curl -X POST http://localhost:3000/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Workspace"}'

# Create project
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": "<workspace-id>", "name": "Test Project"}'

# Create issue
curl -X POST http://localhost:3000/issues \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<project-id>",
    "title": "Test Issue",
    "type": "task",
    "priority": 2
  }'
```

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

## � Docker & Container Setup

### Quick Start with Docker Compose

Start all services (PostgreSQL, Redis, API, WebSocket):

```bash
docker-compose up -d
```

This creates:
- **PostgreSQL** (port 5432) - Primary database
- **Redis** (port 6379) - Caching & Pub/Sub
- **API Server** (port 3000) - REST API
- **WebSocket Server** (port 3001) - Real-time updates
- **Adminer** (port 8080) - Database UI
- **Redis Commander** (port 8081) - Redis UI

### Docker Compose Commands

```bash
# View running services
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api

# Stop services
docker-compose down

# Stop and remove data
docker-compose down -v

# Restart service
docker-compose restart api

# Rebuild image
docker-compose build --no-cache
```

### Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| API Health | http://localhost:3000/health | - |
| Adminer (DB UI) | http://localhost:8080 | pms_user / pms_password |
| Redis Commander | http://localhost:8081 | - |
| Postman Workflow | postman_workflow.json | - |

### Docker Environment Variables

Configure `.env` file (copy from `.env.docker`):
```env
DB_USER=pms_user
DB_PASSWORD=pms_password
REDIS_PASSWORD=redis_password
LOG_LEVEL=info
```

**See [SETUP.md](./SETUP.md) for complete Docker Compose documentation.**

## �📖 Documentation

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
**Version**: 2.0.0 (with Docker Compose support)
**Status**: Ready for Submission ✅
