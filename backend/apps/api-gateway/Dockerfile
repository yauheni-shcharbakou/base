FROM node:22-alpine AS base
ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN yarn global add turbo@latest
COPY . .
RUN turbo prune backend.api-gateway --docker

FROM base AS builder
RUN apk update
RUN apk add protobuf protobuf-dev
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
COPY --from=prepare /app/out/json/ .
RUN yarn install --ignore-scripts --production=false
COPY --from=prepare /app/out/full/ .
RUN yarn build
RUN yarn install --ignore-scripts --production

FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs
COPY --from=builder --chown=nestjs:nodejs /app ./
CMD ["node", "backend/apps/api-gateway/dist/main"]
