# CLAUDE.md — @backend/event-bus

Guidance for working inside `backend/packages/event-bus`. The full event-bus codegen flow and runtime wiring (emit/subscribe, `NatsModule`) are documented in the root `CLAUDE.md` *Event-bus codegen pipeline* section — read it first. This file is the package internals.

## Dual nature

This package is **both** the event-bus source of truth + compiler **and** one of the compiler's two outputs. Like `packages/proto`, you hand-edit one part (`strategy/`) and the rest (`generated/`) is emitted.

## Layer map (hexagon)

This package owns the **domain + ports** side of the event-bus hexagon; the
concrete adapter (NATS) lives in `@backend/nats`:

- **strategy/** — domain: the `EventBusStrategy` contract + custom (non-proto)
  event payloads in `strategy/events/`. `EventBusStrategy` itself is compiler
  input (not exported at runtime); only `strategy/events` is re-exported.
- **generated/** — ports: abstract `<Host><Service>EventBus` classes
  (`emit<Event>`/`emitMany<Event>`) + the `EventBusHost` enum. Use-cases depend
  on these abstractions; `@backend/nats` provides the impls. Never hand-edit.
- **compiler/** — build-time codegen (ts-morph + pug), **not** a runtime layer.

Public API is the flat root `src/index.ts` barrel (`./generated` +
`./strategy/events`).

## Source of truth — `src/strategy/`

`strategy/index.ts` exports the `EventBusStrategy` interface, shaped `[host][service][event]: PayloadType` (e.g. `auth.user.create: NestAuth.User`). To add an event, add a key here. Payloads are usually `@backend/proto` types; custom (non-proto) payloads go in `strategy/events/` (e.g. `StorageObjectParentUpdateEvent`) and are re-exported.

## Compiler — `compiler/` (`pnpm compile`)

`main.ts` parses `EventBusStrategy` with **ts-morph** (`ParseStrategyService`), then emits in two stages:
1. `EventBusService` writes abstract `<Host><Service>EventBus` classes (`emit<Event>` / `emitMany<Event>`) + the `EventBusHost` enum into **this package's** `src/generated/index.ts`.
2. The Nats adapter (pug templates in `compiler/adapters/nats/templates/`) writes transports/controllers into **`@backend/nats/src/generated/index.ts`** — a sibling package.

Naming: `serviceId = dot-case(host_service)`; subjects are `host-service-event` (kebab); buses are `<Host><Service>EventBus`.

## Exports — `src/index.ts`

Re-exports `./generated` (the abstract buses + `EventBusHost`) and `./strategy/events` (custom payload types). Runtime deps are minimal: only `@backend/proto` + `reflect-metadata` (ts-morph/pug/compiler-utils are dev-only compiler tooling).

## Commands

```bash
pnpm compile          # tsx compiler/main.ts → regenerates src/generated + @backend/nats/src/generated, then prettier
pnpm build            # tsdown: src → dist (cjs + d.ts)
pnpm dev              # tsdown --watch (build only — does NOT recompile)
pnpm lint / format / format:generated / reset
```

Turbo splits stages: `compile` (inputs `src/strategy/**`,`compiler/**` → outputs `src/generated/**`) vs `build` (→ `dist/**`). From root: `pnpm compile:event-bus`.

## Gotchas

- One compile regenerates **two** packages (this one + `@backend/nats`); rebuild both after editing the strategy. Never hand-edit either `generated/`.
- Fix generated-output bugs in the strategy, the compiler services, or the Nats adapter templates — not the emitted `.ts`.
- cjs-only output; consumers resolve `dist/`, so rebuild after changes (turbo `^build` handles downstream).
