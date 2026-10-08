import nestVitestConfig from '@packages/configs/vitest/nest.config.mjs';

export default nestVitestConfig(import.meta.url, {
  include: ['test/**/*.e2e-spec.ts'],
});
