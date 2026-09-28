# syntax=docker/dockerfile:1.2

FROM node:22-alpine AS base
ENV CI=true
ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
ENV MALLOC_ARENA_MAX=2
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@11.9.0 --activate
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN pnpm add -g turbo@2.10.2
COPY . .
COPY ./turbo.prod.json ./turbo.json
RUN turbo prune backend.auth --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=s/0e139870-5149-4907-9454-d4228002c737-/pnpm/store,target=/pnpm/store \
    pnpm install \
    --store-dir=/pnpm/store \
    --frozen-lockfile \
    --prod=false
COPY --from=prepare /app/out/full/ .
COPY --from=prepare /app/.prettierrc ./.prettierrc
RUN --mount=type=cache,id=s/0e139870-5149-4907-9454-d4228002c737-/app/.turbo,target=/app/.turbo \
    pnpm build
RUN pnpm reset:modules
RUN --mount=type=cache,id=s/0e139870-5149-4907-9454-d4228002c737-/pnpm/store,target=/pnpm/store \
    pnpm install \
    --store-dir=/pnpm/store \
    --frozen-lockfile \
    --prod \
    --offline \
    --no-optional

FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs
COPY --from=builder --chown=nestjs:nodejs /app ./
EXPOSE $PORT
WORKDIR /app/backend/apps/auth
# The image holds no TypeScript loader (devDependencies are pruned), so the CLI is told not to look
# for one: it reads the compiled config either way, and the lookup only prints a warning.
ENV MIKRO_ORM_CLI_PREFER_TS=false
# Migrations first, and a failed one keeps the service down. `exec` hands PID 1 to node, so the
# SIGTERM of a redeploy reaches the app's shutdown hooks instead of stopping at `sh`.
CMD ["sh", "-c", "node_modules/.bin/mikro-orm migration:up --config dist/mikro-orm.config.js && exec node dist/main.js"]
