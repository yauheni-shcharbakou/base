# CLAUDE.md — backend.auth

Guidance for working inside `backend/apps/auth`. The 4-layer hexagonal/use-case architecture, the `Either` pattern, gRPC controllers, and the migrator sub-app are described in the root `CLAUDE.md` — and **this service is the reference implementation it points to**, so keep it clean and idiomatic. This file is the service-specific map.

## What this service is

The identity / authentication microservice. gRPC host `auth`, event-bus host `EventBusHost.AUTH`, database `Database.AUTH` (Postgres via `@backend/pg`). Bootstrap (`main.ts`) connects both gRPC and Redis (BullMQ event-bus) microservices.

## Modules (`src/modules/`)

- **user** — user CRUD. `GrpcUserController` serves `User` / `UserAdmin` / `UserWeb` gRPC services. Emits `UserEventBus` on create (storage provisions a root folder) and on every delete (storage marks the tree and drops the user's media); `deleteMany` reads the users first and deletes by their ids, so the event names exactly the rows that went. `UserRepository.getOneInternal` exposes the password `hash` for login (the public `User` proto never includes it). Owns the **cache eviction**: `UserUpdateOneUseCase` drops the key of the entity it updated (keyed by the result, not the query — a user may be addressed by email), `UserDeleteUseCase` drops it in `afterSingleDeletion` and clears the whole scope on `deleteMany`. A new write path to a user must evict too, or a stale role survives until `CACHE_TTL`.
- **auth** — `AuthLoginUseCase` (verify password → issue tokens), `AuthRefreshTokenUseCase`, `AuthGetUserByTokenUseCase`. Tokens via `AuthTokenService` → `JwtAuthTokenServiceImpl` (`@nestjs/jwt`, `jwtConfig`). Depends on `UserModule` + `CryptoModule`. **Access tokens are RS256**: signed here with the private key, verified by `api-gateway` with the public key alone, so the payload carries `role` (see `AuthTokenPayload` in `@backend/common`). Refresh tokens stay HS256 — only this service verifies them. Every token also carries its kind as the standard `aud` claim (`AuthTokenAudience`), set and enforced via the jwt `audience` option in `jwtConfig` — so `parse*TokenPayload` reject a token of the wrong kind without a hand-written check. With two different algorithms in play, the key alone no longer separates access from refresh.
- **crypto** — `CryptoService` → `BcryptCryptoServiceImpl` (`hash` / `compare`), returns `Either`.
- **temp-code** — single-use authorization codes (`randomUUID`, `expiredAt` from `tempCode.expiresInMinutes`, `isActive`). CRUD + deactivate use-cases; `CronTempCodeScheduler` deactivates expired codes every minute inside `databaseRunnerService.isolatedRun`. Serves `TempCode` / `Admin` / `Web` gRPC services. **No production consumer**: it used to authorize gRPC stream uploads, which now verify the access token directly — the entity is kept for future use and its admin CRUD.

## Caching the identity read

`AuthGetUserByTokenUseCase` answers the gateway's per-request access check, so its user read goes through `@backend/cache`: `app.module.ts` wires `CacheModule.forRoot({ namespace: 'auth' })`, and `UserModule` provides `USER_CACHE` — the global `CacheService` scoped to `user`, so keys read `cache:auth:user:<id>` and `deleteByPrefix()` clears exactly that scope. The token is the DI seam because `application/` may not import `infrastructure/` under `layerGuard()`; the namespace is therefore chosen once, in the module that owns it.

Two details that look like style but are not:

- **Explicit `get`/`set`, not `cacheService.wrap`.** The factory would return an `Either`, which no JSON round-trip survives; flattening it to `User | null` loses the repository's `NotFoundException` and writes a `null` per request for a deleted user, since the cache does no negative caching ([ADR-0010](../../../docs/adr/0010-cache-fails-soft.md)). The price is no single-flight dedupe on a cold key.
- **Timestamps are rebuilt on the way out.** A cached value crosses as JSON, so `createdAt` returns a **string** while the proto type says `Date` — the same property the event bus has — and the gRPC timestamp wrapper calls `getTime()` on it.

The migrator does not wire `CacheModule`: it holds no `UserModule` and a one-shot CLI has no use for a Redis socket. Writes made there (and any raw SQL) are exactly what `CACHE_TTL` insures against.

> **Why the cache lives here rather than in the gateway's guard:** [docs/adr/0011-identity-cached-in-auth.md](../../../docs/adr/0011-identity-cached-in-auth.md)

## Migrator (`src/migrator/`)

Separate Nest app via `PgMigrationModule.register` (entities `PgUserEntity`, `PgTempCodeEntity`). The `create-admin` task seeds the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` — this is how a fresh deployment gets its first login.

## Config & env (`src/config.ts`)

Spreads `commonConfig()` and adds `admin.{email,password}` + `tempCode.expiresInMinutes`. This service declares `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TEMP_TOKEN_EXPIRES_IN_MINUTES`, the two `JWT_ACCESS_*_KEY_BASE64` halves, `REFRESH_JWT_SECRET` and `SALT_ROUNDS`; the packages it wires add their own. Types, defaults and what a deployment must set: [docs/env.md](../../../docs/env.md).

## Commands

```bash
pnpm start:dev        # dotenv → nest start --watch service
pnpm build            # nest build (service + migrator)
pnpm migrate          # SQL migrations + data tasks (also :new / :initial / :sql / :tasks)
pnpm test             # unit specs (cache read + eviction); single file: pnpm test -- user.delete
pnpm lint
```

## Gotchas

- Reference service: new backend code elsewhere should mirror this layout — don't diverge here.
- **This is the only service with specs**, so its jest block is the one that had to be finished: a `moduleNameMapper` for the `@modules` / `@common` / `@/` aliases (tsconfig paths mean nothing to jest), and `diagnostics.ignoreCodes: [151002]`, ts-jest's complaint about the `NodeNext` module kind — the alternative, `isolatedModules`, is incompatible with `emitDecoratorMetadata` across these apps. `esModuleInterop` is now stated in the shared nest tsconfig for the same reason: `NodeNext` implies it, ts-jest overrides the module to `commonjs` and dropped it, which left `import _ from 'lodash'` undefined in specs only.
- Specs use the real `CacheService` over `MemoryCacheStore` from `@backend/cache` rather than a mock, so the key layout is asserted too. That makes `test` depend on the package's `dist` — turbo's `^build` already covers it.
- Cron/event handlers wrap work in `isolatedRun` for a per-run `EntityManager` context.
- `eslint.config.mjs` wires `@packages/configs` `layerGuard()` alongside `nestConfig` — an inward-only import guard (`interface → infrastructure → application → domain`); it lints clean today, keep new imports pointed inward.
