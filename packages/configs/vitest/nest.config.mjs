import { readFileSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import swc from 'unplugin-swc';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest config for every backend workspace — the three Nest apps and the
 * `@backend/packages/*` that have specs.
 *
 * Call it with `import.meta.url` from the workspace's own `vitest.config.mts`; the directory of
 * that file is the root the aliases and the spec globs resolve against.
 *
 * Specs are compiled by swc, not by Vite's own transform: Nest's DI reads constructor types from
 * `design:paramtypes`, which only a compiler that emits decorator metadata produces, and oxc does
 * not. The path aliases are the three every backend tsconfig declares (`@/*`, `@modules/*`,
 * `@common/*`), so a workspace needs none of its own.
 *
 * In CI the run's results go to the job summary as one table (`.github/actions/vitest-report`), not
 * as Vitest's own block per run: its `github-actions` reporter keeps the failure annotations with
 * the summary off, and the `json` reporter writes `<package>.<unit|e2e>.json` (the config file's
 * name says which) into `VITEST_REPORT_DIR` when that is set.
 *
 * An e2e suite runs with Nest's static `Logger` switched off (`silence-nest-logger.setup.mjs`);
 * `E2E_LOGS=1` turns it back on.
 *
 * @param {string} url the caller's `import.meta.url`.
 * @param {import('vitest/config').ViteUserConfig['test']} [test] test options merged over the
 *   defaults — `include`, `env`, `globalSetup`, `testTimeout` for an e2e config.
 */
export default function nestVitestConfig(url, test = {}) {
  const root = dirname(fileURLToPath(url));
  const src = resolve(root, 'src');
  const { name } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
  const suite = basename(fileURLToPath(url)).includes('.e2e.') ? 'e2e' : 'unit';
  const reportDir = process.env.VITEST_REPORT_DIR;

  // An explicit list drops the `github-actions` reporter Vitest adds on its own, so it is named
  // here; `default` keeps the console output.
  const reporters = ['default'];
  if (process.env.GITHUB_ACTIONS) {
    reporters.push(['github-actions', { jobSummary: { enabled: false } }]);
  }
  if (reportDir) {
    const outputFile = join(reportDir, `${name.replaceAll('/', '__')}.${suite}.json`);
    reporters.push(['json', { outputFile }]);
  }

  return defineConfig({
    root,
    plugins: [
      swc.vite({
        // Otherwise swc inherits the module type of a `.swcrc` it finds, and Vitest needs ESM.
        module: { type: 'es6' },
        jsc: {
          target: 'es2021',
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
      }),
    ],
    resolve: {
      alias: [
        { find: /^@modules\/(.*)$/, replacement: `${src}/modules/$1` },
        { find: /^@common\/(.*)$/, replacement: `${src}/common/$1` },
        { find: /^@\/(.*)$/, replacement: `${src}/$1` },
      ],
    },
    test: {
      environment: 'node',
      include: ['src/**/*.spec.ts'],
      reporters,
      ...test,
      // Joined, not replaced: a config's own setup files still run after the silenced logger.
      setupFiles: [
        ...(suite === 'e2e'
          ? [fileURLToPath(new URL('./silence-nest-logger.setup.mjs', import.meta.url))]
          : []),
        ...[test.setupFiles ?? []].flat(),
      ],
    },
  });
}
