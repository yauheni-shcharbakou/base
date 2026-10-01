import nextConfig from '@packages/configs/eslint/next.config.mjs';

const LETTER = '/^[A-Za-z]$/';
const LETTER_KEY_MESSAGE =
  'Match a letter shortcut on getShortcutKey(event), not event.key: under a non-Latin layout ' +
  'event.key is the letter that layout types, and the shortcut stops answering.';

// The keys only an Apple keyboard prints. Arrows and "↵" are everyone's.
const APPLE_KEYS = '/[⌘⌥⌃⇧⌫]/';
const APPLE_KEY_MESSAGE =
  'Write a shortcut through useShortcutLabel() or <MenuShortcut>: these are a Mac’s keys, and ' +
  'any other keyboard is told Ctrl, Shift and Del.';

/**
 * The two rules of the folder browser's shortcuts that a review alone used to hold (CLAUDE.md,
 * "Keys"). Heuristics over the syntax, not the types: they catch the way such a mistake is written.
 */
const shortcutGuard = {
  files: ['src/**/*.ts', 'src/**/*.tsx'],
  // The label table is where the keys are written; a spec names them in its titles.
  ignores: ['src/features/storage/helpers/shortcut-label.ts', '**/*.spec.ts', '**/*.spec.tsx'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: `SwitchStatement[discriminant.property.name="key"] > SwitchCase > Literal.test[value=${LETTER}]`,
        message: LETTER_KEY_MESSAGE,
      },
      {
        selector: `BinaryExpression[left.property.name="key"][right.value=${LETTER}]`,
        message: LETTER_KEY_MESSAGE,
      },
      {
        selector: `BinaryExpression[right.property.name="key"][left.value=${LETTER}]`,
        message: LETTER_KEY_MESSAGE,
      },
      {
        selector: `:matches(Literal[value=${APPLE_KEYS}], TemplateElement[value.raw=${APPLE_KEYS}], JSXText[value=${APPLE_KEYS}])`,
        message: APPLE_KEY_MESSAGE,
      },
    ],
  },
};

export default [...nextConfig(import.meta.url), shortcutGuard];
