# syntax=docker/dockerfile:1.2

FROM node:22-alpine AS base
ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV MALLOC_ARENA_MAX=2
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN yarn global add turbo@latest
COPY . .
RUN turbo prune frontend.admin --docker

FROM base AS builder
RUN apk add --no-cache protobuf protobuf-dev
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV GRPC_COMPILER_CONTEXT=frontend
ENV YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=s/54c53b98-cdee-43f5-a168-473e9d2d690d-/usr/local/share/.cache/yarn,target=/usr/local/share/.cache/yarn \
    yarn install --ignore-scripts --production=false
COPY --from=prepare /app/out/full/ .
RUN --mount=type=cache,id=s/54c53b98-cdee-43f5-a168-473e9d2d690d-/app/.turbo,target=/app/.turbo \
    yarn build:docker
RUN --mount=type=cache,id=s/54c53b98-cdee-43f5-a168-473e9d2d690d-/usr/local/share/.cache/yarn,target=/usr/local/share/.cache/yarn \
    yarn install --ignore-scripts --production --frozen-lockfile --offline

FROM base AS runner
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/.next/static ./frontend/apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/public ./frontend/apps/admin/public
EXPOSE $PORT
CMD ["node", "frontend/apps/admin/server.js"]
