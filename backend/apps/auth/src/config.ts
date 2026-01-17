import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  ACCESS_JWT_SECRET: zod.string(),
  REFRESH_JWT_SECRET: zod.string(),
});

export const config = () => {
  const common = commonConfig();
  const accessTokenExpiresIn = common.isDevelopment ? '1d' : '10m';
  const refreshTokenExpiresIn = common.isDevelopment ? '30d' : '7d';

  return {
    ...common,
    jwt: {
      accessToken: {
        secret: env.ACCESS_JWT_SECRET,
        signOptions: {
          expiresIn: accessTokenExpiresIn,
          issuer: 'Rayan Hosling',
        },
      },
      refreshToken: {
        secret: env.REFRESH_JWT_SECRET,
        signOptions: {
          expiresIn: refreshTokenExpiresIn,
          issuer: 'Rayan Hosling',
        },
      },
    },
  } as const;
};

export type Config = ReturnType<typeof config>;
