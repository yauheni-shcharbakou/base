import { commonConfig } from '@backend/common';
import { JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { validateEnv } from '@packages/common';
import Joi from 'joi';

const env = validateEnv({
  ACCESS_JWT_SECRET: Joi.string().required(),
  REFRESH_JWT_SECRET: Joi.string().required(),
});

const common = commonConfig();
const accessTokenExpiresIn = common.isDevelopment ? '1d' : '10m';
const refreshTokenExpiresIn = common.isDevelopment ? '30d' : '7d';

export const config = () =>
  ({
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
  }) as const;

export type Config = ReturnType<typeof config>;
