import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  ADMIN_EMAIL: zod.email(),
  ADMIN_PASSWORD: zod.string(),
  TEMP_TOKEN_EXPIRES_IN_MINUTES: zod.coerce.number().default(1),
});

export const config = () => {
  const common = commonConfig();

  return {
    ...common,
    admin: {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    },
    tempCode: {
      expiresInMinutes: env.TEMP_TOKEN_EXPIRES_IN_MINUTES,
    },
  } as const;
};

export type Config = ReturnType<typeof config>;
