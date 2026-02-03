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
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --ignore-scripts --production=false
COPY --from=prepare /app/out/full/ .
RUN --mount=type=cache,target=/app/.turbo \
    yarn build
RUN yarn install --ignore-scripts --production=false

FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/.next/static ./frontend/apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/apps/admin/public ./frontend/apps/admin/public
EXPOSE $PORT
CMD ["node", "frontend/apps/admin/server.js"]
