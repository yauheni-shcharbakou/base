import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { defineConfig } from 'tsdown';
import { fileURLToPath } from 'url';

/**
 * Shared tsdown config for every buildable package in the workspace.
 *
 * Call it with `import.meta.url` from the package's own `tsdown.config.mts`; the manifest it
 * reads is the one sitting next to that file. That is the whole point: externals have to come
 * from the package's own dependencies, not from the root manifest — an import that is not
 * declared here gets bundled into `dist/`, which is the same defect
 * `import-x/no-extraneous-dependencies` reports on the lint side.
 *
 * @param {string} url the caller's `import.meta.url`.
 * @param {object} [overrides] tsdown options merged over the defaults; `deps` merges by key.
 */
export default function nodePackageConfig(url, overrides = {}) {
  const packageDir = dirname(fileURLToPath(url));
  const pkg = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf-8'));
  const { deps, ...rest } = overrides;

  return defineConfig({
    entry: 'src/index.ts',
    format: ['cjs'],
    dts: true,
    ...rest,
    deps: {
      neverBundle: Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      }),
      ...deps,
    },
  });
}
