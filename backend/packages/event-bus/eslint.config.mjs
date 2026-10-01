import nestConfig from '@packages/configs/eslint/nest.config.mjs';

export default [
  // `src/generated/` is compiler output: the emitted `/* eslint-disable */` header glues
  // nothing here, so `eslint --fix` strips it as an unused directive and the next
  // `pnpm compile:event-bus` puts it back — an endless dirty diff.
  { ignores: ['src/generated/**'] },
  ...nestConfig(import.meta.url),
];
