# 0029 — Every refresh replaces the refresh token, and a token spent twice ends its session

**Status:** Accepted (2026-09-30), supersedes the `jti`-kept-across-refreshes half of 0028
**Applies to:** `backend.auth`, `frontend.admin`

## Context

[ADR-0028](0028-refresh-sessions-in-postgres.md) made a refresh token valid only while its session
row exists, but let every token of a session stay valid until it expired. A copy of any of them
refreshed as well as the real one, and nothing noticed two holders. Rotation was held back for one
reason: the admin's middleware refreshed from each of a page's parallel requests, and a rotated
token would be refused to all but the first of them. The admin now spends each refresh token once
(`SingleFlight` in its `AuthService`: concurrent callers share one call, whose result is reused
for 30 s), which removes that obstacle.

Alternatives:

- **Rotate without reuse detection.** A replaced token is simply refused. Whoever refreshes first
  keeps the session: if a thief does, the real user is logged out and the thief stays in.
- **Accept the previous token for a grace period at the backend** (a "reuse interval"). Each accepted
  reuse forks the session into two token chains, and one of them then fails as reuse anyway. It
  also covers what the admin already covers in-process.
- **Keep the `jti` and only shorten the refresh lifetime.** This narrows the window but never
  closes it.

## Decision

- **A refresh token carries two ids.** `sid` is the session row's id and stays the same for the
  session's life. The standard `jti` is the row's `tokenId`, which each refresh replaces with a new
  `randomUUID()`. `parseRefreshTokenPayload` refuses a token without both.
- **`AuthRefreshTokenUseCase` spends the token.** It reads the session by `sid`. If `jti` is not the
  current `tokenId`, the token was replaced already, so this is a reuse and the session is deleted.
  Otherwise it signs new tokens and swaps the `tokenId` with
  `AuthSessionRepository.rotateToken`, one `update … where id = sid and token_id = jti`. Of two
  refreshes racing with one token, exactly one matches. The loser counts as a reuse too, and the
  session is deleted.
- **`AuthLoginUseCase` writes the row before it signs**, because the row's id goes into the token.
  Until the tokens exist, the row's `expiredAt` is the moment of creation, so a sign-in that fails
  in between leaves a row the hourly sweep removes.
- **`AuthLogoutUseCase` deletes by `sid`**, so any token the session ever issued ends it, a replaced
  one included.

## Consequences

- **A stolen refresh token lasts until one of the two holders refreshes after the other.** The
  second refresh with the same token ends the session for both, and both sign in again, which
  only the real user can do.
- **The admin must spend each token exactly once, which ties it to one process.** Two admin
  processes would each refresh the same token and end the session. Running more than one needs the
  single-flight shared between them, for example as a lock in Redis. A request that carries a
  replaced token after the admin's 30 s grace period also ends the session. A browser does not send
  one: its cookie jar holds only the newest token.
- **Tokens issued before this change are refused** (they have no `sid`), so every signed-in user
  signs in once more after the deploy.
- **A sign-in is now two writes to `sessions`** (insert, then `expiredAt`), and a refresh is a read
  plus one conditional update. A detected reuse is logged as a warning naming the session.
