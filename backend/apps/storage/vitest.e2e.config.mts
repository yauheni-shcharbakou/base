import nestVitestConfig from '@packages/configs/vitest/nest.config.mjs';

export default nestVitestConfig(import.meta.url, {
  include: ['test/**/*.e2e-spec.ts'],
  env: {
    // `@backend/pg` validates its env when the module loads, so the default has to be in place
    // before any spec is imported. The fallback is the database `pnpm docker:db` starts.
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://admin:password123@localhost:5432',
  },
  // The PDF renderer starts a worker thread on the `.ts` beside it, with these flags: Node's own type
  // stripping would load it as ESM, where pdf.js's asset lookup (`require.resolve`) does not exist.
  execArgv: ['--no-experimental-strip-types', '--require', '@swc-node/register'],
  testTimeout: 30_000,
  // `beforeAll` drops the spec's schema and replays every migration.
  hookTimeout: 60_000,
});
