import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  ACCESS_JWT_SECRET: zod.string(),
  REFRESH_JWT_SECRET: zod.string(),
  SALT_ROUNDS: zod.number().default(10),
  ADMIN_EMAIL: zod.email(),
  ADMIN_PASSWORD: zod.string(),
  TEMP_TOKEN_EXPIRES_IN_MINUTES: zod.coerce.number().default(1),
});

export const config = () => {
  const common = commonConfig();
  const issuer = common.isDevelopment ? 'Rayan Hosling' : 'Tyler Durden';

  return {
    ...common,
    jwt: {
      accessToken: {
        secret: env.ACCESS_JWT_SECRET,
        expiresIn: common.isDevelopment ? '1d' : '10m',
        issuer,
      },
      refreshToken: {
        secret: env.REFRESH_JWT_SECRET,
        expiresIn: common.isDevelopment ? '7d' : '1h',
        issuer,
      },
    },
    hashing: {
      saltRounds: env.SALT_ROUNDS,
    },
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
