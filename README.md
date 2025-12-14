# base
My personal website

### Requirements

- Node.js 22+
- Installed protobuf compiler (for development only)
- Installed docker and docker-compose

### Project structure

```shell
.github/
  workflows/ # CI configuration
apps/ # directory for subprojects
  admin/
  backend.api-gateway/
  backend.identity/
packages/ # directory for shared between subprojects packages
  backend.common/ # package with common for backend microservices utils, interfaces, types, enums, etc.
  backend.transport/ # package with transport logic for backend microservices
  common/ # package with common for all subprojects utils, interfaces, types, enums, etc.
  environment/ # environment variables validation & types for all subprojects
  ts-configs/ # shared tsconfig.json files for all subprojects
turbo/
  generators/ # directory with custom code generators
```

### Environment variables

Environment variables should be placed in subproject-specific `.env` files:

```shell
apps/
  admin/
    .env # admin environment variables here
  backend.api-gateway/
    .env # backend api-gateway service environment variables here
  backend.identity/
    .env # backend identity service environment variables here
```

> Admin
>
> - `PORT` port for listen http requests
> - `NODE_ENV`
> - `DATABASE_URL` database connection string
> - `PAYLOAD_SECRET` Payload CMS secret

> Backend api-gateway
> 
> - `PORT` port for listen http requests
> - `NODE_ENV`
> - `FIRST_LOCAL_GRPC_PORT` (optional) port, from which start map gRPC clients ports
> - `IDENTITY_GRPC_URL` (optional) backend identity service gRPC url

> Backend identity
>
> - `NODE_ENV`
> - `DATABASE_URL` database connection string
> - `FIRST_LOCAL_GRPC_PORT` (optional) port, from which start map gRPC clients ports
> - `IDENTITY_GRPC_URL` (optional) backend identity service gRPC url

> Inside docker images
>
> - `PROTOC_PATH` (optional) path to custom protobuf compiler bin file

### Tech stack

> Project
> 
> - Turborepo

> Admin
>
> - Express
> - Payload CMS

> Backend
> 
> - Nest.js
> - gRPC
> - Mongoose

### Usage

```shell
git clone git@github.com:evgenii-shcherbakov/base.git
cd base
yarn install # npx yarn
```

##### Commands for run in development mode

```shell
yarn dev
yarn dev:admin # only admin
yarn dev:backend # only backend
yarn dev:backend.api-gateway # only backend api-gateway
yarn dev:backend.identity # only backend identity
```

##### Commands for build

```shell
yarn build
yarn build:admin # only admin
yarn build:backend # only backend
yarn build:backend.api-gateway # only backend api-gateway
yarn build:backend.identity # only backend identity
```

##### Commands for run in production mode

```shell
yarn prod
yarn prod:admin # only admin
yarn prod:backend # only backend
yarn prod:backend.api-gateway # only backend api-gateway
yarn prod:backend.identity # only backend identity
```

##### Commands for run in docker

```shell
yarn docker # start all services (production mode)
yarn docker:local # start only transport services (local development mode)
```

> For using MongoDB replica-set locally (via `yarn docker:local` command) add to `/etc/hosts`:
>
> ```text
> 127.0.0.1       mongodb1
> 127.0.0.1       mongodb2
> 127.0.0.1       mongodb3
> ```

##### Commands for reset build caches:
```shell
yarn reset
yarn reset:admin # only admin
yarn reset:backend # only backend
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
