# syntax=docker/dockerfile:1.2

FROM node:22-alpine AS base
ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
ENV MALLOC_ARENA_MAX=2
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN yarn global add turbo@latest
COPY . .
RUN turbo prune backend.auth --docker

FROM base AS builder
RUN apk add --no-cache protobuf protobuf-dev
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV GRPC_COMPILER_CONTEXT=backend
ENV YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=s/0e139870-5149-4907-9454-d4228002c737-/usr/local/share/.cache/yarn,target=/usr/local/share/.cache/yarn \
    yarn install --ignore-scripts --production=false
COPY --from=prepare /app/out/full/ .
RUN --mount=type=cache,id=s/0e139870-5149-4907-9454-d4228002c737-/app/.turbo,target=/app/.turbo \
    yarn build:docker
RUN --mount=type=cache,id=s/0e139870-5149-4907-9454-d4228002c737-/usr/local/share/.cache/yarn,target=/usr/local/share/.cache/yarn \
    yarn install --ignore-scripts --production --frozen-lockfile --offline

FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs
COPY --from=builder --chown=nestjs:nodejs /app ./
EXPOSE $PORT
CMD ["node", "backend/apps/auth/dist/main.js"]
