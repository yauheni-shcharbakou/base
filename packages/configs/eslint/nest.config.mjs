import eslint from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import { dirname, resolve } from 'path';
import typescriptEslint from 'typescript-eslint';
import { fileURLToPath } from 'url';

export default function nestConfig(url) {
  const __filename = fileURLToPath(url);
  const __dirname = dirname(__filename);

  return typescriptEslint.config(
    {
      ignores: [
        'eslint.config.mjs',
        'node_modules/*',
        'dist/*',
        'src/migrations/*',
        'tsdown.config.mts',
      ],
    },
    eslint.configs.recommended,
    ...typescriptEslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    {
      languageOptions: {
        globals: {
          ...globals.node,
        },
        sourceType: 'commonjs',
        parserOptions: {
          projectService: true,
          tsconfigRootDir: __dirname,
        },
      },
    },
    {
      // The plugin is wired rule by rule rather than through `flatConfigs.recommended`: the
      // recommended set turns on `no-unresolved` and friends, which this repo has no appetite for.
      plugins: { 'import-x': importX },
      settings: {
        // The resolver is required, not an optimisation. `@modules/…`, `@common/…` and
        // `@compiler/…` are tsconfig path aliases, but they match the scoped-package pattern,
        // so an unresolved import of one reads as an undeclared external package and the rule
        // below reports every single occurrence.
        'import-x/resolver-next': [
          createTypeScriptImportResolver({
            project: resolve(__dirname, 'tsconfig.json'),
            alwaysTryTypes: true,
          }),
        ],
      },
      rules: {
        // A package must declare what it imports. Until now externals were read from the root
        // manifest, so an undeclared import still resolved through pnpm hoisting; it would break
        // under an isolated node-linker and, since the tsdown factory switched to each package's
        // own manifest, it now lands inside the bundle instead.
        'import-x/no-extraneous-dependencies': [
          'error',
          {
            // Build-time code may reach for devDependencies; `src/` may not. The compiler glob
            // is here because the event-bus adapters lint `compiler/` alongside `src/`.
            devDependencies: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**', '**/compiler/**'],
            optionalDependencies: false,
            peerDependencies: false,
          },
        ],
      },
    },
    {
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        'no-empty': 'off',
        '@typescript-eslint/no-redundant-type-constituents': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/prefer-promise-reject-errors': 'off',
        'prettier/prettier': ['error', { endOfLine: 'auto' }],
      },
    },
  );
}
