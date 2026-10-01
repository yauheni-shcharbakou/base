// ports impl + transports (event-bus codegen output; spans infra/interface)
export * from './generated';
// infrastructure: connection, queue client, subscription registry, mediator, config, tokens
export * from './infrastructure';
// interface: @RedisController/@RedisEvent decorators, job context, error interceptor, server strategy
export * from './interface';
// composition root: forRoot (connection + mediator + server) / forFeature (bind abstract bus)
export * from './redis.module';
