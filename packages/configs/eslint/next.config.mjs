import nextPlugin from '@next/eslint-plugin-next';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintPrettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prettierConfig = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', '..', '.prettierrc'), 'utf-8'),
);

export default function nextConfig() {
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
    eslintPrettierConfig,
    {
      ignores: ['.next/', 'node_modules/', 'dist/', 'out/'],
    },
  ];
}
