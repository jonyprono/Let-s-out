# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm@9.15.4

WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json turbo.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy sources
COPY apps/api ./apps/api
COPY packages/types ./packages/types

# Build api
RUN pnpm --filter @letsout/api build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm@9.15.4

WORKDIR /app

COPY pnpm-workspace.yaml package.json turbo.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/types ./packages/types

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["pnpm", "--filter", "@letsout/api", "start"]
