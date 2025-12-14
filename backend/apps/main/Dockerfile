FROM node:22-alpine AS base

FROM base AS installer
WORKDIR /app
COPY ./backend/apps/main ./backend/apps/main
COPY ./backend/packages ./backend/packages
COPY ./packages ./packages
COPY ./package.json ./package.json
COPY ./.gitignore ./.gitignore
RUN yarn install --mode update-lockfile

FROM base AS builder
RUN apk add protobuf
RUN apk add protobuf-dev
RUN apk update
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=installer /app .
COPY ./turbo.json ./turbo.json
RUN yarn build:backend.main

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=builder /app .
EXPOSE 8000
CMD ["yarn", "prod:backend.main"]
