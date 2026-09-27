# CLAUDE.md — @backend/event-bus

Guidance for working inside `backend/packages/event-bus`. The pipeline overview is in the root
`CLAUDE.md` *Event-bus codegen pipeline* section; shared backend package conventions are in
`backend/CLAUDE.md`. This file is the package internals **and the owner of the rules that hold for
the bus as a whole**, regardless of transport.

## Dual nature

This package is **both** the event-bus source of truth + compiler **and** one of the compiler's
outputs. Like `packages/proto`, you hand-edit one part (`strategy/`) and the rest (`generated/`) is
emitted. Unlike `packages/proto`, it emits **only its own** `generated/`: each adapter package
compiles itself, against the build-time API this one publishes as `@backend/event-bus/compiler`.

> **Why one task per package:** [docs/adr/0002-codegen-task-per-package.md](../../../docs/adr/0002-codegen-task-per-package.md)

## Layer map (hexagon)

This package owns the **domain + ports** side of the event-bus hexagon; the concrete adapters live
in `@backend/event-bus-redis` (live) and `@backend/event-bus-nats` (dormant):

- **strategy/** — domain: the `EventBusStrategy` contract + custom (non-proto) event payloads in
  `strategy/events/`. `EventBusStrategy` itself is compiler input (not exported at runtime); only
  `strategy/events` is re-exported.
- **generated/** — ports: abstract `<Service>EventBus` classes (`emit<Event>`/`emitMany<Event>`) +
  the `EventBusHost` enum. Use-cases depend on these abstractions; the adapter packages provide the
  impls.
- **compiler/** — build-time codegen (ts-morph + pug), **not** a runtime layer. Exported separately
  (`@backend/event-bus/compiler`) for the adapter packages.

Two public entrypoints: the runtime barrel `src/index.ts` (`./generated` + `./strategy/events`) at
`.`, and `compiler/index.ts` at `./compiler`. Runtime consumers only ever reach `.`, so ts-morph and
pug stay out of their graph.

## Source of truth — `src/strategy/`

`strategy/index.ts` exports the `EventBusStrategy` interface, shaped `[host][service][event]: PayloadType`
(e.g. `auth.user.create: NestAuth.User`). To add an event, add a key here. Payloads are usually
`@backend/proto` types; custom (non-proto) payloads go in `strategy/events/` (e.g.
`FilePurgeEvent`) and are re-exported.

## Bus-wide semantics

True on **every** transport — an adapter's `CLAUDE.md` describes only how it implements them:

- **Payloads cross the bus as JSON.** A `Date` field arrives as an ISO **string** even though the
  proto type says `Date` (`NestAuth.User.createdAt` is the live example). Treat a timestamp in an
  event payload as a string and parse it if you need a `Date`. This is a property of the bus, not of
  Redis or NATS: BullMQ serializes job data and the NATS client encodes `JSON.stringify` output.
- **Delivery is at-least-once with redelivery**, so **subscriber handlers must be idempotent**.
- **Failure messages go through `resolveErrorMessage()`** from `@backend/common` — a wrapper error
  (a MikroORM `DriverException`, Node's `AggregateError`) carries no message of its own. See that
  package's `CLAUDE.md` for the full reasoning; each adapter passes its own fallback.

## Naming

`serviceId = dot-case(service)`, and the **host is dropped from generated class/interface names**:
`<Service>EventBus`, `Nats<Service>Transport`, `Redis<Service>EventController`, and so on.

> **Service names must be unique across all hosts** in `EventBusStrategy`, or the compiler emits
> colliding class names. This is the one trap of the scheme.

Wire identifiers keep the host: event ids are dot-cased `host.service.event` (`auth.user.create`)
and each adapter shapes them further — NATS kebab-cases them into subjects (`auth-user-create`) and
names streams `host-service-stream` (`auth-user-stream`); Redis uses the id verbatim as a queue name.

> **Why service-scoped:** [docs/adr/0003-service-scoped-naming.md](../../../docs/adr/0003-service-scoped-naming.md)

## Compiler — `compiler/` (`pnpm compile`)

The layout follows the pipeline — `strategy → model → adapter → generated`:

```
compiler/
  strategy/context.ts   # StrategyContext — the strategy file's import graph
  strategy/parser.ts    # StrategyParser → ServiceModel[] / EventModel
  strategy/index.ts     # parseStrategy() → StrategyModel { project, context, services }
  adapters/event-bus.adapter.ts   # EventBusAdapter — base class for the transport emitters
  emitters/ports.emitter.ts       # PortsEmitter — this package's own output
```

`parseStrategy()` parses `EventBusStrategy` with **ts-morph** and returns the `ServiceModel[]` every
emitter works from. `main.ts` hands it to `PortsEmitter`, which writes the abstract
`<Service>EventBus` classes + the `EventBusHost` enum into **this package's** `src/generated/index.ts`.
That is all this package emits — the transports are emitted by the adapter packages themselves.

Adding an adapter means a **new package** with a `compiler/` of its own plus the `compile` script and
turbo task — no edit here. `EventBusAdapter.onInit` creates its output file, so the target package
does not need a committed `generated/` stub. Event ids are exposed raw (`method.eventId`) so each
adapter decides how to shape them.

Both adapters also emit a host-keyed map alongside the transports and the client factory, for the
part of their runtime owned by a host rather than by a subscriber: `REDIS_HOST_EVENTS` (host → event
ids, read by the mediator) and `NATS_HOST_STREAMS` (host → the streams it owns, read by the stream
provisioner). Both come from a `getHosts()` helper on the adapter and a `<name>.registry` template.

## Exports — `src/index.ts`

Re-exports `./generated` (the abstract buses + `EventBusHost`) and `./strategy/events` (custom
payload types). Runtime deps are minimal: only `@backend/proto` + `reflect-metadata` (ts-morph, pug
and compiler-utils are dev-only compiler tooling).

## Exports — `compiler/index.ts`

The build-time API the adapter packages compile against — nine names: `EventBusAdapter`
(+ `EventBusAdapterParams` / `EventBusAdapterFactory`), `parseStrategy` (+ `StrategyModel`),
`StrategyContext`, `ServiceModel` / `EventModel`, and `EVENT_BUS_IMPORT_SPECIFIER`.

`PortsEmitter`, `StrategyParser` and `EventBusAdapterClass` are deliberately **not** exported: the
first is driven only by this package's `main.ts`, the second only through `parseStrategy()`, and the
third is plumbing inside `createFactory`.

**The names are chosen to stay apart from two neighbours.** The proto compiler
(`packages/proto/compiler/`) has its own private `BaseAdapter`, `ContextService`, `Adapter*` and
`CompilerContext` — the last one a `'backend' | 'frontend' | 'all'` union, nothing like the object
this package used to call by that name. And `ServiceEventBus` was one keystroke from the runtime
`<Service>EventBus` classes it exists to generate, so the parsed model is `ServiceModel`. When adding
an export here, check both lists before reaching for a generic name.

Two things this entry constrains:

- **Paths must be repo-anchored, not `__dirname`-relative.** `compiler/constants` derives them from
  `BACKEND_PACKAGES_DIR_ROOT` (`@packages/compiler-utils`) because this module is bundled into
  `dist/compiler.cjs` and read from the adapter packages — a path relative to the emitting file would
  resolve against `dist/` there.
- **`tsdown.config.mts` spreads this package's own deps into `neverBundle`**, on top of the root ones
  every other package uses. ts-morph and pug are declared only here; without them listed, tsdown
  inlines both and `dist/compiler.cjs` grows from ~11 kB to ~13 MB.

## Commands

```bash
pnpm compile          # tsx compiler/main.ts → regenerates THIS package's src/generated, prettier-formatted as it writes
pnpm build            # tsdown: src + compiler → dist/index.cjs + dist/compiler.cjs
pnpm dev              # tsdown --watch (build only — does NOT recompile)
pnpm typecheck        # tsc --noEmit over src + compiler; tsx and tsdown both skip type errors
pnpm lint / format / format:generated / reset
```

Turbo splits stages: `compile` (inputs `src/strategy/**`, `compiler/**` → outputs `src/generated/**`)
vs `build` (→ `dist/**`). `compiler/**` is an input of **both** — the compiler entry ships in `dist`.

From root, `pnpm compile:event-bus` filters `@backend/event-bus*`, matching this package and the two
adapters.

## Gotchas

- A strategy edit invalidates all three `compile` tasks (via the dependency hash), but each writes
  only its own file. An adapter's templates live in **its** package.
- Fix generated-output bugs in the strategy, the compiler services, or the adapter templates — not
  the emitted `.ts`.
- Both writes (`EventBusAdapter.run`, `PortsEmitter.compile`) go through `FormatService` from
  `@packages/compiler-utils`, so the emitted files are prettier-formatted before they reach disk and
  the turbo cache. A plain `sourceFile.save()` would reintroduce raw output on cache hits.
