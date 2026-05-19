# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace manifests
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./

# Copy package manifests only (cache layer)
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/api ./apps/api
COPY packages/types ./packages/types

# Generate Prisma client
RUN pnpm --filter api prisma generate

# Build
RUN pnpm --filter api build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile --prod

# Copy build output and Prisma files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "apps/api/dist/server.js"]
