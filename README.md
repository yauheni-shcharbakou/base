# base

My personal website

### Requirements

- Node.js 22.22.0+
- pnpm 10.33.0
- Installed `protobuf` compiler (for development and gRPC compiler only)
- Installed `docker` and `docker compose` (optional)

### Current tech stack

> Project
>
> - Turborepo
> - gRPC

> Admin panel
>
> - Next.js
> - Refine
> - Material UI

> Backend
>
> - Nest.js
> - Mongoose
> - MikroORM
> - Microservices
> - Nats JetStream

### Project structure

```shell
backend/ # directory for backend stuff
  apps/
    ...backend services (backend.*)
  packages/
    ...backend packages (@backend/*)
frontend/ # directory for frontend stuff
  apps/
    ...frontend services (frontend.*)
  packages/
    ...frontend packages (@frontend/*)
packages/ # directory for common shared packages
  ...common packages (@packages/*)
turbo/
  generators/ # directory with custom code generators
```

### Environment variables

Environment variables should be placed in service-specific `.env` files:

```handlebars
/ .env (env file for docker-compose.yml) backend/ apps/{{backend service name}}/ .env frontend/
apps/{{frontend service name}}/ .env
```

You can check examples of env variables in service-specific `.env.example` files

### Usage

```shell
git clone git@github.com:yauheni-shcharbakou/base.git
cd base
pnpm install
```

##### Commands for run in development mode

```shell
pnpm dev
pnpm dev:backend # only backend stuff
pnpm dev:frontend # only frontend stuff
```

##### Commands for packages compilation

```shell
pnpm compile
pnpm compile:grpc # run gRPC compiler
pnpm compile:transport # run nats compiler
```

##### Commands for build

```shell
pnpm build
pnpm build:backend # only backend stuff
pnpm build:frontend # only frontend stuff
pnpm build:grpc # only gRPC compiler packages
```

##### Commands for run in production mode

```shell
pnpm prod
pnpm prod:backend # only backend stuff
```

##### Commands for run in docker

```shell
pnpm docker # start all services (production mode)
pnpm docker:local # start only transport services (local development mode)
```

##### Commands for reset build caches:

```shell
pnpm reset
pnpm reset:backend # only backend services
pnpm reset:frontend # only frontend services
```

##### Commands for reset node_modules:

```shell
pnpm reset:modules
```

##### For format project with prettier run:

```shell
pnpm format
```

### Code generation

For generate new package run:

```shell
pnpm gen:package
```

### Security audit

For check deps vulnerabilities run:

```shell
pnpm audit
```
