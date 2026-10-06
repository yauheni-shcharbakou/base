import nestVitestConfig from '@packages/configs/vitest/nest.config.mjs';

export default nestVitestConfig(import.meta.url, {
  include: ['src/**/*.e2e-spec.ts'],
  // `cache.config.ts` validates env at module load, so the overrides live here — applied before
  // any spec is imported — rather than in a hook, which would already be too late.
  env: {
    // Its own prefix, so the suite cannot touch what a developer is running locally and its own
    // cleanup is a scan over a known prefix.
    CACHE_KEY_PREFIX: 'cache-e2e',
    // Short enough that an expiry can be waited out inside a test.
    CACHE_TTL: '2',
    CACHE_DRIVER: 'redis',
  },
  globalSetup: ['test/cache-server.setup.ts'],
  testTimeout: 30_000,
});
