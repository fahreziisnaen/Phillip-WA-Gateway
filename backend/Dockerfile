# ── Stage 1: Build (installs native addons) ────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build tools needed for native Node.js addons (better-sqlite3, libsignal, etc.)
RUN apk add --no-cache python3 make g++ git

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ── Stage 2: Production image (lean — no build tools) ─────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy installed modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create non-root user; only grant write access to runtime directories
RUN addgroup -S appgroup \
    && adduser -S appuser -G appgroup \
    && mkdir -p sessions data \
    && chown appuser:appgroup sessions data

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
