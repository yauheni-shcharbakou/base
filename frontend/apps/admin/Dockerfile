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
ARG YARN_CACHE_ID=frontend-admin-yarn-cache
ARG TURBO_CACHE_ID=frontend-admin-turbo-cache
ARG YARN_CACHE_PATH=/usr/local/share/.cache/yarn
ARG TURBO_CACHE_PATH=/app/.turbo
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV GRPC_COMPILER_CONTEXT=frontend
ENV YARN_CACHE_FOLDER=$YARN_CACHE_PATH
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=$YARN_CACHE_ID,target=$YARN_CACHE_PATH \
    yarn install --ignore-scripts --production=false
COPY --from=prepare /app/out/full/ .
RUN --mount=type=cache,id=$TURBO_CACHE_ID,target=$TURBO_CACHE_PATH \
    yarn build

FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/.next/static ./frontend/apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/public ./frontend/apps/admin/public
EXPOSE $PORT
CMD ["node", "frontend/apps/admin/server.js"]
