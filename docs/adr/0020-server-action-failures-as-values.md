# 0020 — Admin server actions return their failure as a value, and the gateway keeps the callee's status

**Status:** Accepted (2026-09-27)
**Applies to:** `frontend.admin`, `@backend/grpc`, `backend.api-gateway`

## Context

Every admin data call is a Next server action (`features/grpc/actions`, `features/storage/actions`).
A production build does not forward the message of an error thrown in a server action. The client
gets a generic message and a `digest` instead. So every backend refusal reached Refine's notification
without its reason and without a status code. Examples are a rename onto a taken name, or "You can't
delete the root folder". `next dev` does forward the message, which hid the problem. The
storage-object pages worked around it for names only, with a pre-check that could put its error on
the field.

Two backend defects sat behind that, and they decided where the fix goes:

- **The gateway dropped the callee's status.** `GrpcRxPipe.rpcException` turned the grpc-js
  `ServiceError` of a failed downstream call into `RpcException({ code: UNKNOWN, details:
  error.message })`. A storage 400 left the gateway as `UNKNOWN`, with details
  `"3 INVALID_ARGUMENT: You can't delete the root folder"`.
- **A 404 went out as `UNAVAILABLE`.** `GrpcStatusCodeMapper` builds the HTTP → gRPC direction by
  inverting its table. The table paired both `NOT_FOUND` and `UNAVAILABLE` with 404, and the later
  pair won. Every `NotFoundException` left its service as `UNAVAILABLE`, which is also the code a
  client gets when the server is down.

A transport failure cannot simply be forwarded either. Its `details` are written by grpc-js and name
the address it could not reach ("connect ECONNREFUSED 10.0.0.5:8000").

Alternatives:

- **Keep throwing.** The message is gone before the client sees the error. The `digest` only matches
  a line in the server log.
- **Unwrap the gateway's `"N NAME: details"` prefix in the admin.** This ties the admin to the wording
  of a grpc-js message. It also still cannot tell a backend 404, sent as `UNAVAILABLE`, from an
  outage without showing the outage's address.
- **Route handlers instead of server actions.** A JSON body is not stripped, but the whole data path
  would be rewritten and would lose its typed calls.
- **A pre-check per form, as the storage-object pages do.** It covers one rule on one page, and it
  races the write it guards.

## Decision

- **Every admin server action returns `ActionResult<T>`** (`features/grpc/types`): either
  `{ ok: true, value }` or `{ ok: false, error: { message, statusCode } }`. The action runs its body
  through `runAction` (`features/grpc/helpers/run-action.ts`), which catches the failure and maps it.
- **The client throws the failure again with `unwrapActionResult`**
  (`features/grpc/helpers/unwrap-action-result.ts`). It throws an `Error` that carries `statusCode`.
  This is the `HttpError` shape Refine reads for its notifications and `useForm`, so neither changes.
  `grpcDataProvider`, the storage action providers, `uploadViaPresignedUrl` and the multi-upload's
  discard all unwrap.
- **`GrpcErrorMapper` maps the status with the canonical gRPC → HTTP table.**
  - A 4xx keeps the callee's own message, because the backend wrote it for the caller.
  - A 5xx, or an error with no gRPC status, gets a fixed message such as "The service is unavailable,
    try again later" or "Internal server error". `reportError`
    (`features/grpc/helpers/report-error.ts`) logs the original on the Next server.
- **The binary-media route handlers (`app/api/{files,videos}/[id]/…`) use the same mapping.** Their
  JSON body is not stripped, but they used to answer every failure with a 500 and grpc-js's
  `details` verbatim, a transport failure's address included. They now answer through
  `errorResponse` (`features/grpc/helpers/error-response.ts`): `reportError`'s status and message as
  `{ message }`.
- **`GrpcExceptionMapper.toRpcException` (`@backend/grpc`) passes a `ServiceError`'s `code` and
  `details` through**, so the gateway forwards what the callee sent.
- **`GrpcStatusCodeMapper` keeps two tables.**
  - gRPC → HTTP is the canonical mapping, `HTTP_STATUS_BY_GRPC_STATUS` in `@packages/common`. The
    admin's `GrpcErrorMapper` reads the same table, so the two cannot drift. Among
    other things, `UNAVAILABLE` now pairs with 503 instead of 404.
  - HTTP → gRPC is its own table, one entry per status, instead of the first one inverted. The
    inversion cannot be fixed by reordering: several codes rightly share an HTTP status (`UNKNOWN`,
    `INTERNAL` and `DATA_LOSS` are all 500), so all but one of them always lost. The table takes the
    general code for a shared status, so 500 goes out as `INTERNAL`, not `DATA_LOSS`. It also pairs the
    other statuses Nest has an exception for by meaning: 410, 412, 422 and 504 no longer fall back to
    `INTERNAL`.
  - A spec pins both tables and round-trips every code through them.

## Consequences

- **Every caller of an action has to unwrap it.** A result that is not unwrapped reads as a success.
  For example, `Promise.allSettled` no longer sees a rejection. That is why the multi-upload's discard
  unwraps inside each promise.
- **`runAction` loads grpc-js, so no client module may reach it.** A barrel that re-exported it
  beside `unwrapActionResult` would pull grpc-js into the browser bundle. `features/grpc/helpers`
  therefore has no barrel, and every helper there is imported by path.
- **The folder lookups still swallow their errors.** On a failure, `getUserFolders` returns `[]` and
  `isExistsStorageObject` returns `false`. The lookup falls back to its default, and the backend still
  enforces the rule on the write.
- **The storage-object pages keep their name pre-checks, for UX only.** The pre-check puts the error
  on the field. If the name is taken between the check and the save, the backend's message now
  arrives in a notification.
- **The gateway emits real statuses.**
  - A downstream 400, 403 or 404 now leaves the gateway as `INVALID_ARGUMENT`, `PERMISSION_DENIED` or
    `NOT_FOUND`, not as `UNKNOWN`.
  - Every service sends a `NotFoundException` as `NOT_FOUND`. Nothing in the repo branched on the old
    codes.
  - The gateway has no REST routes, so the `RpcExceptionFilter` path (`fromGrpcToHttp`) is unused for
    now.
  - An `InternalServerErrorException` goes out as `INTERNAL`. As `DATA_LOSS` it claimed
    unrecoverable data loss to every log and alert reading gRPC codes. The admin maps both to 500,
    so a page sees no difference.
- **A 4xx message is shown exactly as the backend wrote it.** `PgRepositoryImpl` used to answer a
  miss with "PgStorageObjectEntity not found", an ORM class name. It now names the resource each
  repository declares ("Storage object not found"). The fix for such a message belongs in the
  backend, not in a filter in the admin.
