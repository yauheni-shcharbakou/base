FROM node:22-alpine AS base
WORKDIR /app

FROM base AS installer
RUN apk add --no-cache libc6-compat
COPY ./admin/apps/main ./admin/apps/main
COPY ./packages ./packages
COPY ./package.json ./package.json
RUN yarn install --mode update-lockfile

FROM base AS builder
ARG MONGODB_URL
ARG PAYLOAD_SECRET
RUN apk add protobuf
RUN apk add protobuf-dev
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=installer /app .
COPY ./turbo.json ./turbo.json
RUN yarn build:admin.main

FROM base AS runner
ARG PORT
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/admin/apps/main/public ./admin/apps/main/public

# Set the correct permission for prerender cache
RUN mkdir admin/apps/main/.next
RUN chown nextjs:nodejs admin/apps/main/.next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/admin/apps/main/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/admin/apps/main/.next/static ./admin/apps/main/.next/static

USER nextjs
EXPOSE $PORT
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD node admin/apps/main/server.js
