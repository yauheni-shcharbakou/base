# CLAUDE.md — backend.auth

Guidance for working inside `backend/apps/auth`. The 4-layer hexagonal/use-case architecture, the `Either` pattern, gRPC controllers, and the migrator sub-app are described in the root `CLAUDE.md` — and **this service is the reference implementation it points to**, so keep it clean and idiomatic. This file is the service-specific map.

## What this service is

The identity / authentication microservice. gRPC host `auth`, event-bus host `EventBusHost.AUTH`, database `Database.AUTH` (Postgres via `@backend/pg`). Bootstrap (`main.ts`) connects both gRPC and NATS microservices.

## Modules (`src/modules/`)

- **user** — user CRUD. `GrpcUserController` serves `User` / `UserAdmin` / `UserWeb` gRPC services. Emits `AuthUserEventBus` on create (storage subscribes to provision a root folder). `UserRepository.getOneInternal` exposes the password `hash` for login (the public `User` proto never includes it).
- **auth** — `AuthLoginUseCase` (verify password → issue tokens), `AuthRefreshTokenUseCase`, `AuthGetUserByTokenUseCase`. Tokens via `AuthTokenService` → `JwtAuthTokenServiceImpl` (`@nestjs/jwt`, `jwtConfig`). Depends on `UserModule` + `CryptoModule`.
- **crypto** — `CryptoService` → `BcryptCryptoServiceImpl` (`hash` / `compare`), returns `Either`.
- **temp-code** — single-use authorization codes (`randomUUID`, `expiredAt` from `tempCode.expiresInMinutes`, `isActive`). Currently used only to authorize gRPC **stream** requests. CRUD + deactivate use-cases; `CronTempCodeScheduler` deactivates expired codes every minute inside `databaseRunnerService.isolatedRun`. Serves `TempCode` / `Admin` / `Web` gRPC services.

## Migrator (`src/migrator/`)

Separate Nest app via `PgMigrationModule.register` (entities `PgUserEntity`, `PgTempCodeEntity`). The `create-admin` task seeds the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` — this is how a fresh deployment gets its first login.

## Config & env (`src/config.ts`)

Spreads `commonConfig()` and adds `admin.{email,password}` + `tempCode.expiresInMinutes`. Env: `DATABASE_URL`, `AUTH_GRPC_URL`, `NATS_URL`, `ACCESS_JWT_SECRET`, `REFRESH_JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TEMP_TOKEN_EXPIRES_IN_MINUTES`.

## Commands

```bash
pnpm start:dev        # dotenv → nest start --watch service
pnpm build            # nest build (service + migrator)
pnpm migrate          # SQL migrations + data tasks (also :new / :initial / :sql / :tasks)
pnpm lint
```

## Gotchas

- Reference service: new backend code elsewhere should mirror this layout — don't diverge here.
- Cron/event handlers wrap work in `isolatedRun` for a per-run `EntityManager` context.
