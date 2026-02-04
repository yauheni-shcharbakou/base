# base
My personal website

### Requirements

- Node.js 22+
- Yarn 1.22.22
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
> - Microservices

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
backend/
  apps/{{backend service name}}/
    .env 
frontend/
  apps/{{frontend service name}}/
    .env
```

You can check examples of env variables in service-specific `.env.example` files

### Usage

```shell
git clone git@github.com:yauheni-shcharbakou/base.git
cd base
yarn install # npx yarn
```

##### Commands for run in development mode

```shell
yarn dev
yarn dev:backend # only backend stuff
yarn dev:frontend # only frontend stuff
```

##### Commands for packages compilation

```shell
yarn compile
yarn compile:grpc # run gRPC compiler
```

##### Commands for build

```shell
yarn build
yarn build:backend # only backend stuff
yarn build:frontend # only frontend stuff
yarn build:grpc # only gRPC compiler packages
```

##### Commands for run in production mode

```shell
yarn prod
yarn prod:backend # only backend stuff
```

##### Commands for run in docker

```shell
yarn docker # start all services (production mode)
yarn docker:local # start only transport services (local development mode)
```

##### Commands for reset build caches:
```shell
yarn reset
yarn reset:backend # only backend services
yarn reset:frontend # only frontend services
```

##### For format project with prettier run:
```shell
yarn format
```

### Code generation

For generate new package run:
```shell
yarn gen:package
```
