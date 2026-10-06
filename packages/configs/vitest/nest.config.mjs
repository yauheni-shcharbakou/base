import { dirname, resolve } from 'path';
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
 * @param {string} url the caller's `import.meta.url`.
 * @param {import('vitest/config').ViteUserConfig['test']} [test] test options merged over the
 *   defaults — `include`, `env`, `globalSetup`, `testTimeout` for an e2e config.
 */
export default function nestVitestConfig(url, test = {}) {
  const root = dirname(fileURLToPath(url));
  const src = resolve(root, 'src');

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
      ...test,
    },
  });
}
