import nestConfig from '@packages/configs/eslint/nest.config.mjs';

export default [
  ...nestConfig(import.meta.url),
  {
    // Layer-direction guard: interface/ → infrastructure/ is allowed, not the reverse.
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/interface', '@/interface/*', '**/interface', '**/interface/*'],
              message:
                'infrastructure/ must not import from interface/ (dependencies flow interface → infrastructure, not the reverse).',
            },
          ],
        },
      ],
    },
  },
];
