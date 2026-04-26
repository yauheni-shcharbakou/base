# syntax=docker/dockerfile:1.2

FROM node:22-alpine AS base
ENV CI=true
ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
ENV MALLOC_ARENA_MAX=2
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@10.33.2 --activate
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN pnpm add -g turbo@2.9.6
COPY . .
RUN turbo prune backend.storage --docker

FROM base AS builder
RUN apk add --no-cache protobuf protobuf-dev
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV GRPC_COMPILER_CONTEXT=backend
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=s/f6216b5c-c577-42f4-9eea-fcb6e4349f8c-/pnpm/store,target=/pnpm/store \
    pnpm install \
    --store-dir=/pnpm/store \
    --frozen-lockfile \
    --prod=false
COPY --from=prepare /app/out/full/ .
COPY --from=prepare /app/.prettierrc ./.prettierrc
RUN --mount=type=cache,id=s/f6216b5c-c577-42f4-9eea-fcb6e4349f8c-/app/.turbo,target=/app/.turbo \
    pnpm build
RUN --mount=type=cache,id=s/f6216b5c-c577-42f4-9eea-fcb6e4349f8c-/app/.turbo,target=/app/.turbo \
    pnpm reset:modules
RUN --mount=type=cache,id=s/f6216b5c-c577-42f4-9eea-fcb6e4349f8c-/pnpm/store,target=/pnpm/store \
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
WORKDIR /app/backend/apps/storage
CMD ["sh", "-c", "node dist/migrator/main.js -- postgres-migration && node dist/main.js"]
