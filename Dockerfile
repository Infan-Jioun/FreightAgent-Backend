# ==============================================================================
# Multi-Stage Production Dockerfile for FreightAgent Backend
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Prepare Dependencies
# ------------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Install openssl for Prisma engine compatibility
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies first for optimal layer caching
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client (outputs to src/generated/prisma as configured)
RUN npx prisma generate

# Copy source code and build config
COPY . .

# Compile TypeScript and copy template assets
RUN npm run build

# Remove development dependencies to keep production footprint minimal
RUN npm prune --omit=dev

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-slim AS runner

WORKDIR /app

# Install openssl (for Prisma) and curl (for Docker healthcheck)
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Copy production dependencies and generated prisma assets
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Copy built code and templates
COPY --from=builder /app/dist ./dist

# Create uploads directory with appropriate permissions
RUN mkdir -p /app/uploads && chown -R node:node /app

# Run as non-root user for container security
USER node

EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

CMD ["node", "dist/server.js"]

