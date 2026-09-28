// Build-time API consumed by the adapter packages (@backend/event-bus-nats,
// @backend/event-bus-redis), each of which compiles its own transports in its own turbo task.
// Reached as `@backend/event-bus/compiler`; nothing here is part of the runtime entrypoint.
//
// Names are deliberately kept apart from the proto compiler's parallel vocabulary
// (`@packages/proto/compiler` exports its own `BaseAdapter` and `ContextService`) and from this
// package's runtime exports — hence `ServiceModel` rather
// than `ServiceEventBus`, which would read as one of the generated `<Service>EventBus` classes.
//
// `PortsEmitter` and `StrategyParser` stay internal: the first is driven only by this
// package's own `main.ts`, the second only through `parseStrategy()`.
export type { EventBusAdapterFactory, EventBusAdapterParams } from './adapters/event-bus.adapter';
export { EventBusAdapter } from './adapters/event-bus.adapter';
export type { EventModel, ServiceModel, StrategyModel } from './strategy';
export { parseStrategy, StrategyContext } from './strategy';
export { EVENT_BUS_IMPORT_SPECIFIER } from './constants';
