FROM node:22-alpine AS base
WORKDIR /app

FROM base AS installer
COPY ./backend/apps ./backend/apps
COPY ./backend/packages ./backend/packages
COPY ./packages ./packages
COPY ./package.json ./package.json
COPY ./.gitignore ./.gitignore
RUN yarn install --mode update-lockfile

FROM base AS builder
RUN apk add protobuf protobuf-dev
RUN apk update
ENV PATH="/usr/bin:${PATH}"
ENV PROTO_PATH=protoc
ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
COPY --from=installer /app .
COPY ./turbo.json ./turbo.json
RUN yarn build:grpc
RUN yarn build:backend

FROM base AS runner
ENV NODE_ENV=production
ENV TURBO_TELEMETRY_DISABLED=1
COPY --from=builder /app .
EXPOSE $PORT
CMD ["yarn", "prod:backend"]
