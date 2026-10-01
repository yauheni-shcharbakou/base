import { validateEnv } from '@packages/common';
import zod from 'zod';

// `coerce`, because a value that comes from `process.env` is always a string: a plain
// `zod.number()` here parses only while SALT_ROUNDS is unset and its default applies.
const env = validateEnv({ SALT_ROUNDS: zod.coerce.number().int().positive().default(10) });

export const bcryptConfig = () => {
  return {
    hashing: {
      saltRounds: env.SALT_ROUNDS,
    },
  } as const;
};

export type BcryptConfig = ReturnType<typeof bcryptConfig>;
