# 0040 — Backend specs run on Vitest, compiled by swc

**Status:** Accepted (2026-10-07), supersedes 0017
**Applies to:** `backend.auth`, `backend.storage`, `backend.api-gateway`, `@backend/common`, `@backend/grpc`, `@backend/cache`, `@backend/event-bus-redis`, `@backend/event-bus-nats`, `@packages/configs`

## Context

Nest 12 ships every core package as ESM only. A CommonJS application keeps working on it through
Node's `require(esm)`, so the services themselves did not have to change — but their specs did:

- Jest's module runtime implements its own `require`, and that `require` cannot load ESM. Every spec
  that imported `@nestjs/*` failed with `Cannot use import statement outside a module`.
- Nest's migration guide gives two ways out: Jest on Node 24.9 or later, whose runtime can load ESM,
  or Vitest. Moving the whole repository to Node 24 for its test runner was rejected — the runtime
  and the deployed images stay on Node 22.
- The same Jest limitation had already split the backend in two: the database specs of
  `backend.storage` ran on `node:test` under ts-node, because MikroORM 7 is ESM only too
  ([ADR-0017](0017-database-specs-on-node-test.md)). That runner has its own hook semantics, its
  own skip API, and exits 0 on an error thrown in an async suite body.

Vitest loads ESM natively, so it removes both reasons at once. Its default transform does not: Vite
compiles TypeScript with oxc, which emits no decorator metadata, and Nest's DI reads constructor
parameter types from `design:paramtypes`.

## Decision

Every backend workspace runs its unit and e2e specs on Vitest. The frontend admin stays on Jest — it
loads no ESM-only package, and nothing forced the change there.

- One factory, `nestVitestConfig(import.meta.url, test?)` in
  `@packages/configs/vitest/nest.config.mjs`, builds every backend config. It compiles specs with
  **swc** through `unplugin-swc` (legacy decorators plus decorator metadata), maps the `@/*`,
  `@modules/*` and `@common/*` aliases, and includes `src/**/*.spec.ts` by default. A workspace has a
  `vitest.config.mts` and, when it has e2e specs, a `vitest.e2e.config.mts`.
- Specs import `describe`, `it`, `expect`, `vi` and the rest from `vitest` explicitly; there are no
  test globals, so neither a tsconfig `types` list nor an ESLint globals entry is needed.
- A server-backed suite probes its server in a Vitest `globalSetup`, hands the result to the specs
  with `project.provide`, and the spec picks `describe` or `describe.skip` through `inject` at
  module scope. Env the config modules validate at load time is set in the config's `test.env`.
- `backend.storage`'s database specs move onto the same runner. `test/pg.e2e.ts` loads the
  migrations through `import()`, and the PDF renderer's worker thread gets a TypeScript loader from
  the config's `execArgv`.

## Consequences

- One runner and one set of hooks across the backend; ADR-0017's split is gone.
- swc is a second compiler next to `tsc` and `nest build`. It only transpiles, as ts-jest did here:
  `typecheck` stays the only type check of a spec.
- `vi.mock` factories that stand in for a class must return a `function`, not an arrow: Vitest calls
  the mock with `new`, and an arrow is not a constructor.
- A dynamic `import()` of a relative module in a spec needs a `.js` extension under `NodeNext`;
  Vite resolves it to the `.ts`.
- A mock only reaches the module graph Vitest loads. A sibling package arrives as its built CommonJS
  `dist`, which Node requires on its own, so a dependency imported there cannot be replaced with
  `vi.mock` — such a seam is mocked through DI instead.
- A Nest app's `tsconfig.build.json` must exclude `vitest*.config.mts`: `nest build` would otherwise
  compile them, move the root of its output and put `main.js` under `dist/src/`.
