import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({ SALT_ROUNDS: zod.number().default(10) });

export const bcryptConfig = () => {
  return {
    hashing: {
      saltRounds: env.SALT_ROUNDS,
    },
  } as const;
};

export type BcryptConfig = ReturnType<typeof bcryptConfig>;
