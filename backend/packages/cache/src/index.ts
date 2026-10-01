// domain: the CacheStore port every adapter implements, plus its types
export * from './domain';
// infrastructure: config, connection, serializer, the two stores, CacheService, key helper
export * from './infrastructure';
// composition root: forRoot (driver switch + connection + service)
export * from './cache.module';
