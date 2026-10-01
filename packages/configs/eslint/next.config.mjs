import nextPlugin from '@next/eslint-plugin-next';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import eslintPrettierConfig from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import prettierPlugin from 'eslint-plugin-prettier';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const prettierConfig = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', '..', '.prettierrc'), 'utf-8'),
);

/**
 * @param {string} url the consumer's `import.meta.url`, used to locate its tsconfig.
 */
export default function nextConfig(url) {
  const appDir = dirname(fileURLToPath(url));

  return [
    {
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
        prettier: prettierPlugin,
      },
      rules: {
        ...tsPlugin.configs.recommended.rules,
        '@typescript-eslint/ban-ts-comment': 'warn',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['off', { argsIgnorePattern: '^_' }],
        'prettier/prettier': ['error', prettierConfig, { usePrettierrc: false }],
      },
    },
    {
      plugins: {
        '@next/next': nextPlugin,
      },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      plugins: {
        'react-hooks': reactHooksPlugin,
      },
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
    {
      // Same contract as the nest preset: a package declares what it imports. The admin app
      // is where this matters most — it used to reach for `zod`, `lodash`, `ulid` and
      // `change-case-all` through the root manifest, and nothing here reported it.
      files: ['**/*.ts', '**/*.tsx'],
      plugins: { 'import-x': importX },
      settings: {
        // Required, not an optimisation: `@/…` is a tsconfig path alias, and an unresolved
        // one is indistinguishable from an undeclared external package.
        'import-x/resolver-next': [
          createTypeScriptImportResolver({
            project: resolve(appDir, 'tsconfig.json'),
            alwaysTryTypes: true,
          }),
        ],
      },
      rules: {
        'import-x/no-extraneous-dependencies': [
          'error',
          {
            devDependencies: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
            optionalDependencies: false,
            peerDependencies: false,
          },
        ],
      },
    },
    eslintPrettierConfig,
    {
      ignores: ['.next/', 'node_modules/', 'dist/', 'out/'],
    },
  ];
}
