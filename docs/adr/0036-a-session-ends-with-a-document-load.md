# 0036 — A session ends with a document load, not a soft navigation

**Status:** Accepted (2026-10-01)
**Applies to:** `frontend.admin`

## Context

Signing out was a server action — end the session at the gateway, delete the cookies — followed
by Refine's soft navigation to `/login`. In the same tab the next sign-in was thrown back to
`/login` at once, with "Refresh token is missing" notifications; only a reload cured it.

Three things combined:

- **A list's query key holds the URL's own query parameters.** Refine's `useTable` merges whatever
  the route carries beyond its known ones — here `sortBy` / `sortOrder` — into `meta`, and `meta`
  into the key (`useMeta`).
- **The page left behind is still mounted while the URL changes.** On the way to `/login` the key
  changed, so the list asked once more — now without a session. The 401 raised a notification,
  and stayed in the cache under the key of a URL without parameters.
- **A signed-out status means "sign out" to the auth provider.** `onError` answers
  `{ logout: true }` for a 401, and Refine calls `logout`.

The next sign-in redirects to the list at a URL without parameters. The page mounted onto the
cached 401 before its refetch could replace it, `onError` fired, and the session just opened was
ended. The client state of a finished session — its mounted queries and their cache — outlived it
and acted in the name of the next one.

Rejected alternatives:

- **Clear the query cache on sign-in and sign-out.** The auth provider is a plain object and the
  `QueryClient` is built inside `<Refine>`, so it would take a module-level handle to the client;
  and it leaves the request made after the sign-out, with its notification.
- **Keep the server action and reload after it.** A server action that changes cookies re-renders
  the current route, whose layout redirects to `/login` softly — the stray request can still go
  out before the document is replaced.
- **`GET /logout`.** A side effect on a GET is run by anything that prefetches the link.
- **Scope `onError` to the session that produced the error.** It would stop the sign-out, not the
  stale data: a cache that crosses sessions also shows one user the other's rows until a refetch.

## Decision

- **Signing out is a form post.** `authProvider.logout` submits a form to
  `POST /api/auth/logout` (`LOGOUT_PATH`). The route handler runs `AuthService.logout` — the
  gateway's `logout`, then the cookies — and answers `303` to `/login`, so the browser loads the
  sign-in page as a new document. The provider returns no `redirectTo`: Refine must not navigate
  on its own meanwhile.
- **Every sign-out takes that path**, the one `onError` asks for included: a session found
  expired ends with the same clean load.
- **The handler refuses a cross-site post** (`sec-fetch-site` other than `same-origin`, 403). A
  route handler has none of a server action's origin check.
- **The middleware lets the path through without refreshing.** The session is ended by the
  refresh token it has; a refresh first would spend a rate-limited call and set the cookies the
  handler deletes in the same response.
- The `Location` is relative: behind a proxy `request.url` names the host the server listens on.

## Consequences

- **Nothing of a session reaches the next one** — no cached error, no cached rows, no request in
  flight. The cost is one full page load per sign-out.
- **A sign-out with uploads on their way asks first**: the upload panel's `beforeunload` prompt
  now covers it, where the soft navigation dropped them silently. Declined, the admin stays signed
  in.
- **Signing in is still a soft navigation**, onto a page whose cache is empty because the sign-out
  before it — or the tab's own load — emptied it.
- **The key no longer follows the URL.** The list page now keeps its own `sortBy` / `sortOrder`
  out of `meta`, so a URL change alone asks for nothing — on the way to `/login` included. That
  was never a second fetch on opening: the request under the first key was lost in Next's router
  queue, and the key's change was what loaded the list, so the page also waits for its mount
  navigation before asking (the note at the top of `resource-list.page.tsx`). What it did cost was
  a second fetch on every sort. The decision stands without it: a soft navigation would still
  carry one session's cache and mounted queries into the next.
