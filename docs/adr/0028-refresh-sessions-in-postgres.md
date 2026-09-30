# 0028 — A refresh token is valid only while its session row exists, and keeps its `jti` across refreshes

**Status:** Accepted (2026-09-30); the `jti` kept across refreshes superseded by 0029 (2026-09-30)
**Applies to:** `backend.auth`, `backend.api-gateway`, `frontend.admin`, `@packages/proto`, `@packages/common`

## Context

Refresh tokens were stateless HS256 JWTs. `AuthRefreshTokenUseCase` checked the signature and `exp`
and nothing else, so a logout only deleted the admin's cookies. A copied refresh token stayed
valid for its whole lifetime (7 days in development, 1 hour in production) whatever the user did.
Revoking one needs server-side state, and the choice was where to keep it.

- **A denylist of revoked `jti`s in Redis, through `@backend/cache`.** Revocation would be one
  write with a TTL, and there would be no migration. But the cache fails soft by design
  ([ADR-0010](0010-cache-fails-soft.md)): when Redis is unreachable, a read is a miss and the store
  falls back to per-process memory. A denylist that reads as "not revoked" whenever Redis is down,
  or on another replica, fails open. The gateway's rate-limit counters accept that trade
  ([ADR-0024](0024-gateway-rate-limit-counters-in-redis.md)); a revocation check cannot.
- **An allowlist in Postgres**: a row per signed-in session, which a logout deletes. It fails
  closed: if the database is down, a refresh fails, which is what an unverifiable session should do.
  It costs a migration, one indexed read and one write per refresh, and a sweep of expired rows.
- **Rotating the `jti` on every refresh**, with reuse of an old token treated as theft. This is the
  stricter form of the allowlist. It fails on the admin as it is: `src/middleware.ts` refreshes an
  expired session in every request that arrives without an access token. Several such requests
  arrive at once (the page and Refine's data calls). Each would send the same refresh token; the
  first would rotate it, and the others would be refused, deleting the cookies the first had just
  set.

## Decision

- **`backend.auth` keeps sessions in Postgres**: `PgAuthSessionEntity`, table `sessions`
  (`AuthDatabaseEntity.SESSION`). A row holds `user` (a foreign key with `on delete cascade`),
  `tokenId` (unique) and `expiredAt`.
- **`AuthLoginUseCase` opens a session per sign-in.** It creates a `randomUUID()` `tokenId`, which
  `AuthTokenService.generateTokens` signs into the refresh token as the standard `jti` claim, and
  saves the row with the refresh token's `exp`.
- **`AuthRefreshTokenUseCase` accepts a token only if its session exists and belongs to the token's
  user.** It issues the new tokens with the **same** `jti` and moves `expiredAt` forward. If a
  logout deletes the row between the read and that update, the new tokens are withheld.
  `parseRefreshTokenPayload` refuses a token that has no `jti`.
- **`AuthLogoutUseCase` deletes the session** named by a refresh token's `jti`. It is idempotent: a
  token that no longer verifies, or whose session is already gone, also succeeds. Only a failed
  delete is an error.
- **`logout` is a public RPC** (`AuthService` and `AuthPublicService`, message `AuthLogout`,
  response `google.protobuf.Empty`). The refresh token is the credential, and the access token may
  already have expired. It shares the gateway's public rate limit with login and refresh.
- **`CronAuthSessionScheduler` deletes expired sessions every hour.**
- **The admin's `logout` action calls it before it clears the cookies, as a best effort**
  (`AuthService.logout`). A gateway that is down or rate-limiting does not keep the admin signed in.

## Consequences

- **A logout ends that session everywhere.** A refresh token from a revoked session, including a
  newer one from an earlier refresh of it, is refused as `PERMISSION_DENIED` "Refresh token
  invalid". The admin reads that as signed out.
- **Access tokens are not revoked.** An access token already issued stays valid until its own
  `exp` (10 minutes in production, 1 day in development): the gateway verifies stream calls with the
  public key alone, and `auth.me` does not look at sessions. Revoking access tokens as well would
  mean a session check in `AuthGetUserByTokenUseCase` or a much shorter access lifetime.
- **The `jti` is not rotated**, so a stolen refresh token that is refreshed keeps working until the
  real user logs out, and nothing detects reuse. Rotation becomes possible once the admin refreshes
  once per session instead of once per request, for example with a single-flight lock around the
  middleware's refresh.
- **Every refresh token issued before this change is refused** (it has no `jti`), so each signed-in
  user signs in once more after the deploy.
- **Each sign-in adds a row.** The hourly sweep bounds the table to the sessions still within their
  refresh lifetime. There is no "log out everywhere" yet, but deleting every session of a user is
  now a single `deleteMany` on `sessions` by user.
