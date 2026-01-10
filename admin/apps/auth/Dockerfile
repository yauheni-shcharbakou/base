FROM node:22-alpine AS base
WORKDIR /app

FROM base AS installer
RUN apk add --no-cache libc6-compat
COPY ./admin/apps/auth ./admin/apps/auth
COPY ./admin/packages ./admin/packages
COPY ./packages ./packages
COPY ./package.json ./package.json
RUN yarn install --mode update-lockfile

FROM base AS builder
ARG DATABASE_URL
ARG DATABASE_NAME
ARG PAYLOAD_SECRET
RUN apk add protobuf
RUN apk add protobuf-dev
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
COPY --from=installer /app .
COPY ./turbo.json ./turbo.json
RUN yarn build:grpc
RUN yarn build:admin.auth

FROM base AS runner
ARG PORT
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir -p admin/apps/auth/.next
RUN chown nextjs:nodejs admin/apps/auth/.next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/admin/apps/auth/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/admin/apps/auth/.next/static ./admin/apps/auth/.next/static

USER nextjs
EXPOSE $PORT
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "admin/apps/auth/server.js"]



## To use this Dockerfile, you have to set `output: 'standalone'` in your next.config.mjs file.
## From https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile
#
#FROM node:22.17.0-alpine AS base
#
## Install dependencies only when needed
#FROM base AS deps
## Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
#RUN apk add --no-cache libc6-compat
#WORKDIR /app
#
## Install dependencies based on the preferred package manager
#COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
#RUN \
#  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
#  elif [ -f package-lock.json ]; then npm ci; \
#  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
#  else echo "Lockfile not found." && exit 1; \
#  fi
#
#
## Rebuild the source code only when needed
#FROM base AS builder
#WORKDIR /app
#COPY --from=deps /app/node_modules ./node_modules
#COPY . .
#
## Next.js collects completely anonymous telemetry data about general usage.
## Learn more here: https://nextjs.org/telemetry
## Uncomment the following line in case you want to disable telemetry during the build.
## ENV NEXT_TELEMETRY_DISABLED 1
#
#RUN \
#  if [ -f yarn.lock ]; then yarn run build; \
#  elif [ -f package-lock.json ]; then npm run build; \
#  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
#  else echo "Lockfile not found." && exit 1; \
#  fi
#
## Production image, copy all the files and run next
#FROM base AS runner
#WORKDIR /app
#
#ENV NODE_ENV production
## Uncomment the following line in case you want to disable telemetry during runtime.
## ENV NEXT_TELEMETRY_DISABLED 1
#
#RUN addgroup --system --gid 1001 nodejs
#RUN adduser --system --uid 1001 nextjs
#
## Remove this line if you do not have this folder
#COPY --from=builder /app/public ./public
#
## Set the correct permission for prerender cache
#RUN mkdir .next
#RUN chown nextjs:nodejs .next
#
## Automatically leverage output traces to reduce image size
## https://nextjs.org/docs/advanced-features/output-file-tracing
#COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
#COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
#
#USER nextjs
#
#EXPOSE 3000
#
#ENV PORT 3000
#
## server.js is created by next build from the standalone output
## https://nextjs.org/docs/pages/api-reference/next-config-js/output
#CMD HOSTNAME="0.0.0.0" node server.js
