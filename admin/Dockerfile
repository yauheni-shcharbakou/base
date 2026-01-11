FROM node:22-alpine AS base
WORKDIR /app

FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN apk update
COPY ./admin/apps ./admin/apps
COPY ./admin/packages ./admin/packages
COPY ./packages ./packages
COPY ./package.json ./package.json
RUN yarn install --mode update-lockfile

FROM base AS builder
ARG DATABASE_URL
ARG PAYLOAD_SECRET
ARG ADMIN_AUTH_PROXY_URL
RUN apk add protobuf protobuf-dev
RUN apk update
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
COPY --from=installer /app .
COPY ./turbo.json ./turbo.json
RUN yarn build:grpc
RUN yarn build:admin

FROM base AS runner

ARG PORT
ARG ADMIN_HOST
ARG ADMIN_AUTH_URL
ARG ADMIN_MAIN_URL

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache supervisor coreutils nginx envsubst
RUN apk update

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /home/nextjs --shell /bin/sh nextjs

RUN mkdir -p /var/log/nginx /var/lib/nginx/tmp /run/nginx /var/log/supervisor /var/run/supervisor
RUN chown -R root:root /var/lib/nginx /var/log/nginx /run/nginx
RUN chown -R nextjs:nodejs /var/log/supervisor /var/run/supervisor /app /home/nextjs
RUN chown nextjs:nodejs /dev/stdout /dev/stderr

COPY ./admin/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY ./admin/apps/proxy/nginx.conf.template /etc/nginx/templates/nginx.conf.template

RUN /bin/sh -c "envsubst '\$PORT \$ADMIN_HOST \$ADMIN_AUTH_URL \$ADMIN_MAIN_URL' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf"
RUN /bin/sh -c "nginx -t"

RUN <<EOF
  for app in auth main; do
    # Set the correct permission for prerender cache
    mkdir -p admin/apps/$app/.next
    chown nextjs:nodejs admin/apps/$app/.next
  done
EOF

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/admin/apps/auth/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/admin/apps/auth/.next/static ./admin/apps/auth/.next/static

COPY --from=builder --chown=nextjs:nodejs /app/admin/apps/main/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/admin/apps/main/.next/static ./admin/apps/main/.next/static

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

EXPOSE $PORT
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
