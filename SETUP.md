# Setup Instructions

This document provides step-by-step instructions for setting up the PMS (Project Management System) project in two ways:
1. **Traditional Setup** - Install dependencies locally
2. **Docker Setup** - Use Docker Compose for isolated environment (Recommended)

---

## Option 1: Traditional Local Setup ⚙️

### Prerequisites
- **Node.js**: 20.x or higher
- **PostgreSQL**: 12 or higher
- **npm**: 9 or higher
- **Redis**: 7 or higher (optional, for caching)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual configuration:
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/pms_dev?schema=public

# API
PORT=3000
WEBSOCKET_PORT=3001
NODE_ENV=development

# Logging
LOG_LEVEL=info

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

### Step 3: Set Up Database

Start PostgreSQL (if not running):

**macOS with Homebrew:**
```bash
brew services start postgresql
```

**Linux with systemctl:**
```bash
sudo systemctl start postgresql
```

**Docker (alternative):**
```bash
docker run -d --name pms-postgres \
  -e POSTGRES_USER=pms_user \
  -e POSTGRES_PASSWORD=pms_password \
  -e POSTGRES_DB=pms_dev \
  -p 5432:5432 \
  postgres:16-alpine
```

Initialize the database:
```bash
cd packages/database
npx prisma db push
npx prisma generate
cd ../..
```

### Step 4: Start Development Servers

```bash
npm run dev
```

You should see output like:
```
API Server running on http://localhost:3000
WebSocket Server running on http://localhost:3001
```

### Step 5: Verify Installation

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2026-04-19T..."
}
```

---

## Option 2: Docker Compose Setup 🐳 (Recommended)

### Prerequisites
- **Docker**: 20.10 or higher
- **Docker Compose**: 2.0 or higher

**Check versions:**
```bash
docker --version
docker-compose --version
```

### Step 1: Install Docker

**macOS:**
```bash
brew install docker docker-compose
# or download Docker Desktop from https://www.docker.com/products/docker-desktop
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker $USER
```

**Windows:**
Download Docker Desktop from https://www.docker.com/products/docker-desktop

### Step 2: Configure Environment

```bash
cp .env.docker .env
```

The `.env` file contains default configuration for Docker. You can modify:
```env
DB_USER=pms_user
DB_PASSWORD=pms_password
DB_NAME=pms_dev
REDIS_PASSWORD=redis_password
LOG_LEVEL=info
```

### Step 3: Build and Start Services

```bash
docker-compose up -d
```

This will start all services in the background:
- **PostgreSQL** (port 5432)
- **Redis** (port 6379)
- **API Server** (port 3000)
- **WebSocket Server** (port 3001)
- **Adminer** (Database UI - http://localhost:8080)
- **Redis Commander** (Redis UI - http://localhost:8081)

**View logs:**
```bash
docker-compose logs -f
```

**View specific service logs:**
```bash
docker-compose logs -f api
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Step 4: Verify Setup

#### Check services are running:
```bash
docker-compose ps
```

Expected output:
```
CONTAINER ID   IMAGE             STATUS
...
pms_postgres   postgres:16       Up 2 minutes (healthy)
pms_redis      redis:7           Up 2 minutes (healthy)
pms_api        pms:latest        Up 1 minute (healthy)
```

#### Test API health:
```bash
curl http://localhost:3000/health
```

#### Access Database UI:
- **Adminer**: http://localhost:8080
  - Server: `postgres`
  - Username: `pms_user`
  - Password: `pms_password`
  - Database: `pms_dev`

#### Access Redis UI:
- **Redis Commander**: http://localhost:8081

### Step 5: Verify Database Migration

The migration runs automatically on container startup. Check:

```bash
# Check if Prisma migrations ran successfully
docker-compose logs api | grep "prisma"
```

---

## Docker Compose Commands 🐳

### Essential Commands

```bash
# Start all services
docker-compose up -d

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f postgres

# Access service shell
docker-compose exec postgres psql -U pms_user -d pms_dev
docker-compose exec redis redis-cli -a redis_password

# Restart service
docker-compose restart api
docker-compose restart postgres

# View resource usage
docker-compose stats
```

### Rebuild Docker Image

If you modify the code, rebuild:

```bash
# Rebuild image
docker-compose build

# Rebuild and restart
docker-compose up --build -d
```

### Clean Up Everything

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune
```

---

## Testing

### Run Tests (regardless of setup method)

```bash
npm test
```

### Run Specific Test Suite

```bash
npm run test -- --filter="@pms/api"
```

### Watch Mode

```bash
npm run test:watch
```

---

## API Testing

### Using Postman Collection

1. Import `postman_workflow.json` into Postman
2. Set `baseUrl` variable to `http://localhost:3000`
3. Run requests in order

### Using cURL

#### Create Workspace
```bash
curl -X POST http://localhost:3000/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workspace"}'
```

#### Create Project
```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "<workspace-id>",
    "name": "My Project"
  }'
```

#### Create Issue
```bash
curl -X POST http://localhost:3000/issues \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<project-id>",
    "title": "Test Issue",
    "description": "This is a test",
    "type": "task",
    "priority": 2
  }'
```

---

## Database Management

### Using Docker Compose

#### Access PostgreSQL CLI
```bash
docker-compose exec postgres psql -U pms_user -d pms_dev
```

#### Backup Database
```bash
docker-compose exec postgres pg_dump -U pms_user pms_dev > backup.sql
```

#### Restore Database
```bash
docker-compose exec -T postgres psql -U pms_user pms_dev < backup.sql
```

#### Open Prisma Studio
```bash
# For local setup
npm run db:studio

# For Docker setup
docker-compose exec api npx prisma studio
```

### Using Desktop Tools

- **Adminer** (Web-based):
  - URL: http://localhost:8080 (Docker only)
  - Server: `postgres`
  - Username: `pms_user`
  - Password: `pms_password`

- **pgAdmin** (Docker alternative):
  ```bash
  docker run -d --name pgadmin \
    -e PGADMIN_DEFAULT_EMAIL=admin@example.com \
    -e PGADMIN_DEFAULT_PASSWORD=admin \
    -p 5050:80 \
    --network pms_network \
    dpage/pgadmin4
  ```
  Then access at http://localhost:5050

---

## Troubleshooting 🔧

### Local Setup Issues

#### PostgreSQL Connection Failed
```bash
# Check if PostgreSQL is running
psql --version

# Start PostgreSQL (macOS)
brew services start postgresql

# Check connection
psql -h localhost -U postgres
```

#### Port Already in Use
```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Database Migration Failed
```bash
cd packages/database
npx prisma db push --skip-generate --force-reset
cd ../..
```

### Docker Compose Issues

#### Containers Won't Start
```bash
# Check logs
docker-compose logs

# Rebuild images
docker-compose build --no-cache

# Restart everything
docker-compose down -v
docker-compose up -d
```

#### Database Connection Error
```bash
# Ensure postgres is healthy
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Rebuild
docker-compose rebuild postgres
```

#### Port Conflicts
```bash
# Change port in docker-compose.yml
# Example: change "5432:5432" to "5433:5432" for PostgreSQL

# Or stop other services
docker ps
docker stop <container-id>
```

#### Slow Performance
```bash
# Increase Docker resources
docker system df
docker system prune -a

# Rebuild images
docker-compose build --no-cache
```

#### Out of Disk Space
```bash
# Clean up Docker system
docker system prune -a --volumes

# Remove old images
docker image prune -a
```

---

## Performance Optimization

### For Local Setup

```bash
# TypeScript watch mode (faster compilation)
npm run dev -- --watch

# Run tests in watch mode
npm run test:watch
```

### For Docker Setup

```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1
docker-compose build

# Run specific container
docker-compose up -d postgres redis
docker-compose up api

# Resource limits (in docker-compose.yml)
# services:
#   api:
#     deploy:
#       resources:
#         limits:
#           cpus: '1'
#           memory: 1G
```

---

## Production Deployment

See `docs/` for production deployment guides.

Quick checklist:
- [ ] Set strong JWT_SECRET
- [ ] Use strong DB_PASSWORD and REDIS_PASSWORD
- [ ] Enable HTTPS/TLS
- [ ] Configure proper logging
- [ ] Set up monitoring and alerts
- [ ] Configure backups
- [ ] Enable rate limiting
- [ ] Update environment variables for production

---

## Quick Reference

| Task | Local Command | Docker Command |
|------|---------------|---|
| Install deps | `npm install` | Automatic |
| Start dev | `npm run dev` | `docker-compose up -d` |
| Run tests | `npm test` | `npm test` (inside container) |
| Access DB | `psql ...` | `docker-compose exec postgres psql ...` |
| View logs | Console output | `docker-compose logs -f` |
| Stop all | Ctrl+C | `docker-compose down` |
| Clean up | `rm -rf node_modules` | `docker-compose down -v` |

---

## Support

For issues, check:
1. Logs: `docker-compose logs -f` or console output
2. Troubleshooting section above
3. Docker documentation: https://docs.docker.com/
4. PostgreSQL documentation: https://www.postgresql.org/docs/
5. Redis documentation: https://redis.io/documentation/

---

**Last Updated**: April 19, 2026
**Version**: 2.0 (with Docker support)
