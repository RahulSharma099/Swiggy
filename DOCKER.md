# Docker & Containerization Guide

This guide provides comprehensive information about using Docker and Docker Compose for the PMS project.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Docker Compose Services](#docker-compose-services)
3. [Dockerfile Details](#dockerfile-details)
4. [Container Management](#container-management)
5. [Volume Management](#volume-management)
6. [Networking](#networking)
7. [Performance Tuning](#performance-tuning)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 2GB free disk space
- 512MB free RAM

### Start Everything

```bash
# Setup environment
cp .env.docker .env

# Start services
docker-compose up -d

# Verify
docker-compose ps
```

### Access Points

```
API:              http://localhost:3000
WebSocket:        http://localhost:3001
Adminer (DB UI):  http://localhost:8080
Redis Commander:  http://localhost:8081
```

### Stop Everything

```bash
docker-compose down
```

---

## Docker Compose Services

### PostgreSQL

**Purpose**: Primary database

**Configuration** (docker-compose.yml):
```yaml
postgres:
  image: postgres:16-alpine
  ports:
    - "5432:5432"
  environment:
    POSTGRES_USER: pms_user
    POSTGRES_PASSWORD: pms_password
    POSTGRES_DB: pms_dev
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

**Access**:
```bash
# Via psql
docker-compose exec postgres psql -U pms_user -d pms_dev

# Via Adminer
http://localhost:8080
```

**Useful Commands**:
```bash
# Backup
docker-compose exec postgres pg_dump -U pms_user pms_dev > backup.sql

# Restore
docker-compose exec -T postgres psql -U pms_user pms_dev < backup.sql

# Logs
docker-compose logs postgres
```

### Redis

**Purpose**: Caching and Pub/Sub messaging

**Configuration**:
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --requirepass <password>
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

**Access**:
```bash
# Via redis-cli
docker-compose exec redis redis-cli -a redis_password

# Via Redis Commander UI
http://localhost:8081

# Test connection
docker-compose exec redis redis-cli -a redis_password ping
```

**Useful Commands**:
```bash
# Info
docker-compose exec redis redis-cli -a redis_password info

# Monitor
docker-compose exec redis redis-cli -a redis_password monitor

# Memory stats
docker-compose exec redis redis-cli -a redis_password info memory
```

### API Server

**Purpose**: Express REST API and WebSocket server

**Configuration**:
```yaml
api:
  build: .
  ports:
    - "3000:3000"   # API
    - "3001:3001"   # WebSocket
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  volumes:
    - ./packages:/app/packages    # Source code (dev mode)
    - ./node_modules:/app/node_modules
```

**Features**:
- Auto-runs database migrations
- Health checks
- Hot-reload in development mode
- Non-root user for security

**Access**:
```bash
# API health check
curl http://localhost:3000/health

# View logs
docker-compose logs -f api

# Interactive shell
docker-compose exec api /bin/sh
```

### Adminer

**Purpose**: Web-based database management UI

**Access**: http://localhost:8080

**Credentials**:
- Server: `postgres`
- Username: `pms_user`
- Password: `pms_password`
- Database: `pms_dev`

### Redis Commander

**Purpose**: Redis web management UI

**Access**: http://localhost:8081

---

## Dockerfile Details

### Multi-Stage Build Strategy

The Dockerfile uses multi-stage builds for optimization:

**Stage 1: Builder**
- Compiles TypeScript
- Installs all dependencies
- Generates Prisma Client

**Stage 2: Runtime**
- Includes only production dependencies
- Smaller final image (~300MB vs 800MB)
- Better security (fewer attack surface)

### Base Image

```dockerfile
FROM node:20-alpine
```

**Why Alpine?**
- Small size (~150MB vs 900MB for full Node)
- Fast startup
- Sufficient for most applications

### Build Arguments

```bash
# Build with specific Node version
docker-compose build --build-arg NODE_VERSION=20

# Rebuild without cache
docker-compose build --no-cache
```

### Security Considerations

```dockerfile
# Non-root user
USER nodejs

# No /bin/bash
RUN apk add --no-cache dumb-init

ENTRYPOINT ["dumb-init", "--"]
```

---

## Container Management

### View Containers

```bash
# List running containers
docker-compose ps

# List all containers (including stopped)
docker-compose ps -a

# Detailed info
docker-compose ps -a --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
```

### Start/Stop Services

```bash
# Start all
docker-compose up -d

# Start specific service
docker-compose up -d api

# Stop all
docker-compose down

# Stop specific service
docker-compose stop api

# Restart
docker-compose restart api

# Remove and recreate
docker-compose up -d --force-recreate
```

### View Logs

```bash
# All services
docker-compose logs

# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f api

# With timestamps
docker-compose logs -f --timestamps
```

### Execute Commands

```bash
# Run command in running container
docker-compose exec api npm test

# Run as specific user
docker-compose exec -u nodejs api whoami

# Interactive shell
docker-compose exec api /bin/sh

# One-off container
docker-compose run --rm api npm test
```

### Health Checks

```bash
# Check container health
docker-compose ps

# Manual health check
curl http://localhost:3000/health

# Detailed health status
docker inspect pms_api --format='{{.State.Health.Status}}'
```

---

## Volume Management

### Volume Types

1. **Named Volumes** - Persistent data storage
   ```yaml
   postgres_data:
     driver: local
   ```

2. **Bind Mounts** - Mount host directory
   ```yaml
   volumes:
     - ./packages:/app/packages
   ```

### Manage Volumes

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect pms_postgres_data

# Remove volume
docker volume rm pms_postgres_data

# Remove all unused volumes
docker volume prune

# Backup volume
docker run --rm -v pms_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# Restore volume
docker run --rm -v pms_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

### Development Volumes

For hot-reload during development:

```yaml
volumes:
  - ./packages:/app/packages    # Live code changes
  - /app/node_modules           # Keep node_modules
```

---

## Networking

### Network Configuration

```yaml
networks:
  pms_network:
    driver: bridge
```

### DNS Resolution

Container hostnames are automatically resolved:

```bash
# From inside api container
curl http://postgres:5432   # PostgreSQL hostname
curl http://redis:6379      # Redis hostname
```

### Port Mapping

```yaml
ports:
  - "3000:3000"   # host:container
  - "5432:5432"   # Access PostgreSQL on host port 5432
```

### Custom Networks

```bash
# Create custom network
docker network create my_network

# Connect container
docker network connect my_network container_name

# Disconnect
docker network disconnect my_network container_name

# Inspect
docker network inspect my_network
```

---

## Performance Tuning

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### CPU Usage

```bash
# Monitor real-time usage
docker stats

# Check specific container
docker stats pms_api

# Limit CPU
docker update --cpus=1 pms_api
```

### Memory Usage

```bash
# Increase memory
docker update --memory=2g pms_api

# Check memory stats
docker container stats pms_api --no-stream
```

### Build Optimization

```bash
# Enable BuildKit (faster builds)
export DOCKER_BUILDKIT=1
docker-compose build

# Build in parallel
export COMPOSE_PARALLEL_PUSH=1
docker-compose push
```

### Image Size

```bash
# Check image size
docker images | grep pms

# Reduce image size
docker-compose build --no-cache

# Multi-stage builds help reduce size
```

---

## Production Deployment

### Environment

Copy from `.env.docker` and update for production:

```bash
cp .env.docker .env.production
```

Update critical values:

```env
NODE_ENV=production
LOG_LEVEL=warn
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
JWT_SECRET=<strong-secret>
```

### Security

```yaml
# Don't run as root
user: "node:node"

# Mount /tmp as read-only
read_only: true
tmpfs:
  - /tmp

# No privileged mode
privileged: false

# Drop capabilities
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
```

### Scaling

```bash
# Scale api service to 3 instances
docker-compose up -d --scale api=3

# Load balancer configuration needed for multiple instances
```

### Monitoring & Logging

```bash
# Collect logs
docker-compose logs > all_logs.txt

# Monitor resources
docker stats

# Health checks (already configured in Dockerfile)
docker-compose ps
```

### Backup & Restore

```bash
# Full backup
docker-compose exec -T postgres pg_dump -U pms_user pms_dev | gzip > pms_backup.sql.gz

# Restore
gunzip < pms_backup.sql.gz | docker-compose exec -T postgres psql -U pms_user pms_dev

# Volume backup
docker run --rm -v pms_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/volume_backup.tar.gz -C /data .
```

---

## Troubleshooting

### Common Issues

#### Containers Won't Start

```bash
# Check logs
docker-compose logs

# Rebuild
docker-compose build --no-cache

# Full restart
docker-compose down -v
docker-compose up -d
```

#### Database Connection Failed

```bash
# Check postgres is healthy
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U pms_user -d pms_dev

# Restart postgres
docker-compose restart postgres
```

#### Port Conflicts

```bash
# Find process on port
lsof -i :3000

# Use different port in docker-compose.yml
# Change "3000:3000" to "3001:3000"
```

#### Out of Memory

```bash
# Check usage
docker stats

# Clean up
docker system prune -a

# Increase RAM allocation (in Docker Desktop settings)
```

#### Slow Performance

```bash
# Check CPU/Memory
docker stats

# Use BuildKit
export DOCKER_BUILDKIT=1

# Check disk space
docker system df
```

### Debugging

```bash
# Enter container shell
docker-compose exec api /bin/sh

# Check environment variables
docker-compose exec api env

# Test database connection
docker-compose exec api node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.$connect().then(() => console.log('Connected')).catch(e => console.error(e));
"

# View network details
docker inspect pms_api
```

### Clean Up

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Remove images
docker image prune -a

# Remove all unused images, containers, networks
docker system prune -a --volumes
```

---

## Advanced Topics

### Custom Dockerfile

Create `Dockerfile.prod` for production-optimized builds:

```dockerfile
FROM node:20-alpine AS builder
# ... build stage

FROM node:20-alpine
# ... runtime stage with production optimizations
```

Use in docker-compose.yml:

```yaml
build:
  context: .
  dockerfile: Dockerfile.prod
```

### Environment Secrets Management

For production, use Docker Secrets or external secret management:

```bash
# Docker Secrets (Swarm mode)
echo "my-secret" | docker secret create db_password -

# Environment files
docker-compose --env-file .env.production up -d
```

### CI/CD Integration

Example GitHub Actions:

```yaml
- name: Build and push Docker image
  run: |
    docker build -t myregistry.azurecr.io/pms:${{ github.sha }} .
    docker login -u ${{ secrets.REGISTRY_USERNAME }}
    docker push myregistry.azurecr.io/pms:${{ github.sha }}
```

---

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Specification](https://github.com/compose-spec/compose-spec)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PostgreSQL Docker Documentation](https://hub.docker.com/_/postgres)
- [Redis Docker Documentation](https://hub.docker.com/_/redis)

---

**Last Updated**: April 19, 2026  
**Docker Compose Version**: 3.9  
**Status**: Production Ready ✅
