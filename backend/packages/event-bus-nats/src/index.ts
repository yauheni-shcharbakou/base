// ports impl + transports (event-bus codegen output; spans infra/interface)
export * from './generated';
// infrastructure: connection, JetStream client, stream provisioner, registries, config, tokens
export * from './infrastructure';
// interface: @NatsController/@NatsEvent decorators, message context, ack/nak interceptor, server strategy
export * from './interface';
// composition root: forRoot (connection + stream provisioner + server) / forFeature (bind abstract bus)
export * from './nats.module';
