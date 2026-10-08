import nestVitestConfig from '@packages/configs/vitest/nest.config.mjs';

export default nestVitestConfig(import.meta.url, {
  include: ['src/**/*.e2e-spec.ts'],
  // `redis.config.ts` validates env at module load, so the overrides live here — applied before
  // any spec is imported — rather than in a hook, which would already be too late.
  env: {
    // Own prefix and namespace, so the suite cannot touch the queues and registries a developer is
    // running locally — and so its own cleanup is a scan over known prefixes.
    REDIS_QUEUE_PREFIX: 'bull-e2e',
    REDIS_EVENT_BUS_NAMESPACE: 'event-bus-e2e',
    // A short redelivery ladder instead of the production ten — walking that one with exponential
    // backoff takes minutes.
    REDIS_JOB_ATTEMPTS: '3',
    REDIS_JOB_BACKOFF_DELAY: '100',
  },
  globalSetup: ['test/redis-server.setup.ts'],
  testTimeout: 30_000,
});
