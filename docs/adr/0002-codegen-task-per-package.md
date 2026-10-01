# 0002 — One event-bus codegen task per target package

**Status:** Accepted (2026-09-06)
**Applies to:** `@backend/event-bus`, `@backend/event-bus-redis`, `@backend/event-bus-nats`

## Context

The event-bus compiler parses `EventBusStrategy` and emits generated code into three packages: the
abstract buses into `@backend/event-bus`, and a transport adapter into each of the two transport
packages.

The original arrangement was one `compile` task, in `@backend/event-bus`, writing into all three
`src/generated/` directories. Turbo cannot declare task outputs outside the package that owns the
task, so the two adapter files belonged to no task's output set: a cache hit on that single compile
restored an **incomplete** tree, and the adapters' `generated/` survived only because it happened to
be committed.

## Decision

Each target package runs its own `compile` task, with its own `compiler/main.ts`, adapter class and
pug templates, writing to an `outputPath` local to itself
(`join(__dirname, '..', 'src', 'generated', 'index.ts')`).

`@backend/event-bus` publishes the build-time API the adapters compile against —
`EventBusAdapter`, `parseStrategy()`, the parsed `ServiceModel` — as the separate entrypoint
`@backend/event-bus/compiler`. Ordering falls out of the existing turbo graph
(`compile.dependsOn: ["^compile", "^build"]`): the ports package compiles and builds, then the
adapters compile against its `dist/compiler.cjs`.

## Consequences

- Every task declares the output it actually writes, so a cache hit restores a complete tree.
- Each task is a separate process, so the strategy is parsed once per task rather than handed
  between them — roughly 0.5 s repeated three times. That is the price of `pnpm compile` working
  standalone inside any single package.
- Editing an adapter's templates invalidates only that adapter. Editing the strategy invalidates
  all three through the dependency hash.
- Adding a transport means a **new package** carrying its own `compiler/` plus a `compile` script
  and turbo task. `@backend/event-bus` is not edited. `EventBusAdapter.onInit` creates the output
  file, so a new package does not need a committed `generated/` stub.
