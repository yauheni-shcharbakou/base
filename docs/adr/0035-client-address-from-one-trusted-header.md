# 0035 — The client address is read from one header the proxy overwrites

**Status:** Accepted (2026-10-01)
**Applies to:** `frontend.admin`, `backend.api-gateway`

## Context

The gateway limits public calls — login, refresh, logout — to 10 a minute per client address
([ADR-0024](0024-gateway-rate-limit-counters-in-redis.md)). Every gRPC call it gets comes from the
admin's Next server, so the address travels as `x-client-ip` metadata, which `AuthService` sets
from the browser's request.

`getHeadersIp` took the **left-most** entry of `x-forwarded-for`, then `x-real-ip`. The left end of
that list is the part the client writes: a proxy appends to what it was sent. A caller sending a
different `X-Forwarded-For` with each attempt got a new bucket each time, so the limit on password
guesses never tripped — and one naming a victim's address could spend that address's bucket.

Rejected alternatives:

- **The right-most `x-forwarded-for` entry, or the N-th from the right for N proxies.** Correct for
  a proxy that appends, but what Railway's edge does with the header is not settled: its own
  support answers say it appends the address, that it strips the list and writes it anew, and that
  it does not populate it. A rule that is right under one of three behaviours is a guess.
- **Count per peer.** The Next server is the only peer, so every visitor would share one bucket and
  ten failed logins by anyone would lock everyone out for a minute.
- **Validate in the gateway.** It sees only what the Next server forwards; which header is
  trustworthy is a fact about the proxy in front of the admin, known where the admin is deployed.

## Decision

- **One header, named by the deployment.** `CLIENT_IP_HEADER` (admin, default `x-real-ip`) names
  the header the proxy in front of the Next server overwrites with the connecting address.
  `getHeadersIp(headers, headerName)` reads that header and no other.
- **Of a list, the last entry** — the one the nearest proxy added — so a deployment whose proxy
  appends to `x-forwarded-for` can name that header and still get the proxy's word.
- **A value that is not an IPv4 or IPv6 address is no address.** The gateway then counts by peer,
  as it does when the header is absent.
- The default is Railway's: its edge sets `X-Real-IP` to the connecting address over whatever the
  client sent.

## Consequences

- **The setting is a claim about the proxy, and nothing checks it.** A header the proxy passes
  through unchanged puts the bypass back. After a change of hosting, send eleven sign-in attempts,
  each with a different forged value of the header: the eleventh must be refused (429).
- **Without a proxy the address is unknown.** Local development has no `x-real-ip`, so every caller
  shares the peer's bucket — ten public calls a minute for the whole machine.
- **Behind another proxy the variable changes, not the code** — `cf-connecting-ip` behind
  Cloudflare, for one.
- **`x-client-ip` is still trusted by the gateway as sent**, because its gRPC port is on the private
  network only. That part is unchanged.
- An IPv6 client owns a whole prefix and can still rotate within it; the limit counts single
  addresses.
