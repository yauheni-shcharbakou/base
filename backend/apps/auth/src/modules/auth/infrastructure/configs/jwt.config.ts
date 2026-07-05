import { commonConfig } from '@backend/common';
import { validateEnv } from '@packages/common';
import zod from 'zod';

const env = validateEnv({
  ACCESS_JWT_SECRET: zod.string(),
  REFRESH_JWT_SECRET: zod.string(),
});

export const jwtConfig = () => {
  const common = commonConfig();
  const issuer = common.isDevelopment ? 'Rayan Hosling' : 'Tyler Durden';

  return {
    ...common,
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
  } as const;
};

export type JwtConfig = ReturnType<typeof jwtConfig>;
