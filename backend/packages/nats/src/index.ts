// ports impl + transports (event-bus codegen output; spans infra/interface)
export * from './generated';
// infrastructure: connection/consumer config, stream registry, DI tokens, types
export * from './infrastructure';
// interface: @NatsController/@NatsEvent decorators, ack/nak interceptor
export * from './interface';
// composition root: forRoot (server+client) / forFeature (bind abstract bus)
export * from './nats.module';
