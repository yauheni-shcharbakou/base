# syntax=docker/dockerfile:1.2

FROM node:22-alpine AS base
ENV CI=true
ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV MALLOC_ARENA_MAX=2
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@10.33.0 --activate
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN pnpm add -g turbo@2.9.6
COPY . .
RUN turbo prune frontend.admin --docker

FROM base AS builder
RUN apk add --no-cache protobuf protobuf-dev
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV GRPC_COMPILER_CONTEXT=frontend
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=s/54c53b98-cdee-43f5-a168-473e9d2d690d-/pnpm/store,target=/pnpm/store \
    pnpm install \
    --store-dir=/pnpm/store \
    --frozen-lockfile \
    --prod=false
COPY --from=prepare /app/out/full/ .
COPY --from=prepare /app/.prettierrc ./.prettierrc
RUN --mount=type=cache,id=s/54c53b98-cdee-43f5-a168-473e9d2d690d-/app/.turbo,target=/app/.turbo \
    --mount=type=cache,id=s/54c53b98-cdee-43f5-a168-473e9d2d690d-/app/frontend/apps/admin/.next/cache,target=/app/frontend/apps/admin/.next/cache \
    pnpm build

FROM base AS runner
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/.next/static ./frontend/apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/public ./frontend/apps/admin/public
EXPOSE $PORT
WORKDIR /app/frontend/apps/admin
CMD ["node", "server.js"]
