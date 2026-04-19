# Multi-stage build for PMS API

# Stage 1: Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/websocket/package.json ./packages/websocket/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client with all required platform engines
# First, ensure we have OpenSSL libraries available for binary generation
RUN cd packages/database && \
    PRISMA_CLI_BINARY_TARGETS="linux-arm64-openssl-3.0.x,debian-openssl-3.0.x" \
    npx prisma generate || npx prisma generate

# Build projects
RUN npm run build

# Stage 2: Runtime stage
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/websocket/package.json ./packages/websocket/

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/websocket/dist ./packages/websocket/dist

# Copy Prisma client and schema
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -g nodejs -u 1001 -s /bin/false nodejs

USER nodejs

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start both API and WebSocket servers
CMD ["node", "packages/api/dist/index.js"]
