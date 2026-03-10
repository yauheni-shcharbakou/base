import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default function nestConfig(url) {
  const __filename = fileURLToPath(url);
  const __dirname = dirname(__filename);

  return typescriptEslint.config(
    {
      ignores: ['eslint.config.mjs', 'node_modules/*', 'dist/*', 'src/migrator/migrations/*'],
    },
    eslint.configs.recommended,
    ...typescriptEslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    {
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.jest,
        },
        sourceType: 'commonjs',
        parserOptions: {
          projectService: true,
          tsconfigRootDir: __dirname,
        },
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
