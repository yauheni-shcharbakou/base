// ports: abstract <Host><Service>EventBus classes + EventBusHost enum (codegen output)
export * from './generated';
// domain: custom (non-proto) event payloads referenced by the strategy contract
export * from './strategy/events';

// Note: EventBusStrategy (strategy/index.ts) is intentionally NOT exported — it is
// compiler input (parsed by ts-morph), not a runtime contract.
