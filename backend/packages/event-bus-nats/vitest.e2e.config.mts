import nestVitestConfig from '@packages/configs/vitest/nest.config.mjs';

export default nestVitestConfig(import.meta.url, {
  include: ['src/**/*.e2e-spec.ts'],
  // `nats.config.ts` validates env at module load, so the overrides live here — applied before
  // any spec is imported — rather than in a hook, which would already be too late.
  env: {
    // A short redelivery ladder instead of the production ten, and the production delivery policy
    // pinned explicitly so the suite does not depend on the developer's environment.
    NATS_MAX_DELIVER: '3',
    NATS_DELIVER_POLICY: 'all',
  },
  globalSetup: ['test/nats-broker.setup.ts'],
  testTimeout: 30_000,
});
